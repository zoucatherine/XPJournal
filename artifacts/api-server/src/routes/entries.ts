import { Router } from "express";
import { db } from "@workspace/db";
import { journalEntriesTable, insertJournalEntrySchema, updateJournalEntrySchema } from "@workspace/db/schema";
import { eq, or, ilike } from "drizzle-orm";

const entriesRouter = Router();

entriesRouter.get("/entries", async (_req, res) => {
  try {
    const entries = await db.select().from(journalEntriesTable).orderBy(journalEntriesTable.date);
    res.json(entries.map(formatEntry));
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch entries" });
  }
});

entriesRouter.get("/entries/search", async (req, res) => {
  try {
    const q = typeof req.query.q === "string" ? req.query.q.trim() : "";
    if (!q) {
      res.json([]);
      return;
    }
    const pattern = `%${q}%`;
    const entries = await db
      .select()
      .from(journalEntriesTable)
      .where(or(ilike(journalEntriesTable.title, pattern), ilike(journalEntriesTable.body, pattern)))
      .orderBy(journalEntriesTable.date);
    res.json(entries.map(formatEntry));
  } catch (err) {
    res.status(500).json({ error: "Failed to search entries" });
  }
});

entriesRouter.get("/entries/:date", async (req, res) => {
  try {
    const [entry] = await db
      .select()
      .from(journalEntriesTable)
      .where(eq(journalEntriesTable.date, req.params.date));
    if (!entry) {
      res.status(404).json({ error: "Entry not found" });
      return;
    }
    res.json(formatEntry(entry));
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch entry" });
  }
});

entriesRouter.post("/entries", async (req, res) => {
  try {
    const parsed = insertJournalEntrySchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid input" });
      return;
    }
    const existing = await db
      .select()
      .from(journalEntriesTable)
      .where(eq(journalEntriesTable.date, parsed.data.date));
    if (existing.length > 0) {
      res.status(409).json({ error: "Entry already exists for that date" });
      return;
    }
    const [entry] = await db.insert(journalEntriesTable).values(parsed.data).returning();
    res.status(201).json(formatEntry(entry));
  } catch (err) {
    res.status(500).json({ error: "Failed to create entry" });
  }
});

entriesRouter.put("/entries/:date", async (req, res) => {
  try {
    const parsed = updateJournalEntrySchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid input" });
      return;
    }
    const [entry] = await db
      .update(journalEntriesTable)
      .set({ ...parsed.data, updatedAt: new Date() })
      .where(eq(journalEntriesTable.date, req.params.date))
      .returning();
    if (!entry) {
      res.status(404).json({ error: "Entry not found" });
      return;
    }
    res.json(formatEntry(entry));
  } catch (err) {
    res.status(500).json({ error: "Failed to update entry" });
  }
});

entriesRouter.delete("/entries/:date", async (req, res) => {
  try {
    const [deleted] = await db
      .delete(journalEntriesTable)
      .where(eq(journalEntriesTable.date, req.params.date))
      .returning();
    if (!deleted) {
      res.status(404).json({ error: "Entry not found" });
      return;
    }
    res.status(204).send();
  } catch (err) {
    res.status(500).json({ error: "Failed to delete entry" });
  }
});

function formatEntry(entry: typeof journalEntriesTable.$inferSelect) {
  return {
    date: entry.date,
    title: entry.title,
    body: entry.body,
    createdAt: entry.createdAt.toISOString(),
    updatedAt: entry.updatedAt.toISOString(),
  };
}

export default entriesRouter;
