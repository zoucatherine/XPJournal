import { Router } from "express";
import { db, pool } from "@workspace/db";
import { journalEntriesTable, insertJournalEntrySchema, updateJournalEntrySchema } from "@workspace/db/schema";
import { and, eq, or, ilike } from "drizzle-orm";
import { AttachmentError, type AttachmentRow, attachmentMetadata, lockAccount, validateReferences, commitReferences } from "../lib/attachments.js";

const entriesRouter = Router();

// Helper to handle date serialization safely
async function formatEntry(entry: typeof journalEntriesTable.$inferSelect) {
  if (!entry) return null;
  const refs = entry.attachmentRefs ?? [];
  const images = refs.length ? await pool.query<AttachmentRow>(
    "SELECT * FROM journal_attachments WHERE user_id=$1 AND id=ANY($2::uuid[]) AND deleted_at IS NULL",
    [entry.userId, refs.map(ref => ref.id)],
  ) : { rows: [] };
  const metadata = new Map(images.rows.map(row => [row.id, attachmentMetadata(row)]));
  return {
    date: entry.date,
    title: entry.title,
    body: entry.body,
    attachments: refs.map(ref => ({ ...metadata.get(ref.id), id: ref.id, offset: ref.offset })),
    mood: entry.mood ?? null,
    createdAt: entry.createdAt instanceof Date ? entry.createdAt.toISOString() : new Date(entry.createdAt).toISOString(),
    updatedAt: entry.updatedAt instanceof Date ? entry.updatedAt.toISOString() : new Date(entry.updatedAt).toISOString(),
  };
}

// 1. Standard List Route
entriesRouter.get("/entries", async (req, res) => {
  try {
    const entries = await db
      .select()
      .from(journalEntriesTable)
      .where(eq(journalEntriesTable.userId, req.userId as string))
      .orderBy(journalEntriesTable.date);
    res.json((await Promise.all(entries.map(formatEntry))).filter(Boolean));
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch entries" });
  }
});

// 2. FIXED: Moved Search ABOVE the dynamic :date route so it isn't shadowed
entriesRouter.get("/entries/search", async (req, res) => {
  try {
    const q = typeof req.query.q === "string" ? req.query.q.trim() : "";
    if (!q) {
      res.json([]);
    } else {
      const pattern = `%${q}%`;
      const entries = await db
        .select()
        .from(journalEntriesTable)
        .where(
          and(
            eq(journalEntriesTable.userId, req.userId as string),
            or(ilike(journalEntriesTable.title, pattern), ilike(journalEntriesTable.body, pattern)),
          ),
        )
        .orderBy(journalEntriesTable.date);
      res.json((await Promise.all(entries.map(formatEntry))).filter(Boolean));
    }
  } catch (err) {
    res.status(500).json({ error: "Failed to search entries" });
  }
});

// 3. FIXED: Catch-all parameter placed after explicit strings
entriesRouter.get("/entries/:date", async (req, res) => {
  try {
    const [entry] = await db
      .select()
      .from(journalEntriesTable)
      .where(and(eq(journalEntriesTable.userId, req.userId as string), eq(journalEntriesTable.date, req.params.date)));

    if (!entry) {
      res.status(404).json({ error: "Entry not found" });
    } else {
      res.json(await formatEntry(entry));
    }
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch entry" });
  }
});

// 4. POST Route
entriesRouter.post("/entries", async (req, res) => {
  const client = await pool.connect();
  try {
    const parsed = insertJournalEntrySchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid input" });
    } else {
      const userId = req.userId as string;
      await client.query("BEGIN");
      await lockAccount(client, userId);
      const existing = await client.query("SELECT 1 FROM journal_entries WHERE user_id=$1 AND date=$2", [userId, parsed.data.date]);

      if (existing.rowCount) {
        await client.query("ROLLBACK");
        res.status(409).json({ error: "Entry already exists for that date" });
      } else {
        const refs = parsed.data.attachments ?? [];
        await validateReferences(client, userId, parsed.data.date, parsed.data.body, refs);
        await client.query(
          `INSERT INTO journal_entries(user_id,date,title,body,mood,attachment_refs) VALUES($1,$2,$3,$4,$5,$6::jsonb)`,
          [userId, parsed.data.date, parsed.data.title, parsed.data.body, parsed.data.mood ?? null, JSON.stringify(refs)],
        );
        await commitReferences(client, userId, parsed.data.date, [], refs);
        await client.query("COMMIT");
        const [entry] = await db.select().from(journalEntriesTable)
          .where(and(eq(journalEntriesTable.userId, userId), eq(journalEntriesTable.date, parsed.data.date)));
        res.status(201).json(await formatEntry(entry));
      }
    }
  } catch (err) {
    await client.query("ROLLBACK");
    res.status(err instanceof AttachmentError ? err.status : 500).json({ error: err instanceof AttachmentError ? err.message : "Failed to create entry" });
  } finally { client.release(); }
});

// 5. PUT Route
entriesRouter.put("/entries/:date", async (req, res) => {
  const client = await pool.connect();
  try {
    const parsed = updateJournalEntrySchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid input" });
    } else {
      await client.query("BEGIN");
      const userId = req.userId as string;
      const date = req.params.date as string;
      await lockAccount(client, userId);
      const existing = await client.query("SELECT attachment_refs FROM journal_entries WHERE user_id=$1 AND date=$2 FOR UPDATE", [userId, date]);
      if (!existing.rowCount) {
        await client.query("ROLLBACK");
        res.status(404).json({ error: "Entry not found" });
      } else {
        const previous = existing.rows[0].attachment_refs;
        if (previous.length && parsed.data.attachments === undefined) {
          throw new AttachmentError("This entry has image attachments. Edit it in the web journal to keep their positions safe.", 409);
        }
        const refs = parsed.data.attachments ?? [];
        await validateReferences(client, userId, date, parsed.data.body, refs);
        await client.query(
          `UPDATE journal_entries SET title=$3,body=$4,mood=CASE WHEN $5 THEN $6 ELSE mood END,
           attachment_refs=$7::jsonb,updated_at=NOW() WHERE user_id=$1 AND date=$2`,
          [userId, date, parsed.data.title, parsed.data.body, parsed.data.mood !== undefined, parsed.data.mood ?? null, JSON.stringify(refs)],
        );
        await commitReferences(client, userId, date, previous, refs);
        await client.query("COMMIT");
        const [entry] = await db.select().from(journalEntriesTable).where(and(eq(journalEntriesTable.userId, userId), eq(journalEntriesTable.date, date)));
        res.json(await formatEntry(entry));
      }
    }
  } catch (err) {
    await client.query("ROLLBACK");
    res.status(err instanceof AttachmentError ? err.status : 500).json({ error: err instanceof AttachmentError ? err.message : "Failed to update entry" });
  } finally { client.release(); }
});

// 6. DELETE Route
entriesRouter.delete("/entries/:date", async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await lockAccount(client, req.userId as string);
    const deleted = await client.query("DELETE FROM journal_entries WHERE user_id=$1 AND date=$2 RETURNING date", [req.userId, req.params.date]);

    if (!deleted.rowCount) {
      await client.query("ROLLBACK");
      res.status(404).json({ error: "Entry not found" });
    } else {
      await client.query("UPDATE journal_attachments SET deleted_at=NOW() WHERE user_id=$1 AND date=$2 AND deleted_at IS NULL", [req.userId, req.params.date]);
      await client.query("COMMIT");
      res.status(204).send();
    }
  } catch (err) {
    await client.query("ROLLBACK");
    res.status(500).json({ error: "Failed to delete entry" });
  } finally { client.release(); }
});

export default entriesRouter;
