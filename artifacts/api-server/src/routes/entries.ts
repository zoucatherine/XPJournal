import { Router } from "express";
import { db } from "@workspace/db";
import { journalEntriesTable, insertJournalEntrySchema, updateJournalEntrySchema } from "@workspace/db/schema";
import { eq, or, ilike } from "drizzle-orm";

const entriesRouter = Router();

// Helper to handle date serialization safely
function formatEntry(entry: typeof journalEntriesTable.$inferSelect) {
  if (!entry) return null;
  return {
    date: entry.date,
    title: entry.title,
    body: entry.body,
    mood: entry.mood ?? null,
    createdAt: entry.createdAt instanceof Date ? entry.createdAt.toISOString() : new Date(entry.createdAt).toISOString(),
    updatedAt: entry.updatedAt instanceof Date ? entry.updatedAt.toISOString() : new Date(entry.updatedAt).toISOString(),
  };
}

// 1. Standard List Route
entriesRouter.get("/entries", async (_req, res) => {
  try {
    const entries = await db.select().from(journalEntriesTable).orderBy(journalEntriesTable.date);
    res.json(entries.map(formatEntry).filter(Boolean));
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
        .where(or(ilike(journalEntriesTable.title, pattern), ilike(journalEntriesTable.body, pattern)))
        .orderBy(journalEntriesTable.date);
      res.json(entries.map(formatEntry).filter(Boolean));
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
      .where(eq(journalEntriesTable.date, req.params.date));
    
    if (!entry) {
      res.status(404).json({ error: "Entry not found" });
    } else {
      res.json(formatEntry(entry));
    }
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch entry" });
  }
});

// 4. POST Route
entriesRouter.post("/entries", async (req, res) => {
  try {
    const parsed = insertJournalEntrySchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid input" });
    } else {
      const existing = await db
        .select()
        .from(journalEntriesTable)
        .where(eq(journalEntriesTable.date, parsed.data.date));
        
      if (existing.length > 0) {
        res.status(409).json({ error: "Entry already exists for that date" });
      } else {
        const [entry] = await db.insert(journalEntriesTable).values(parsed.data).returning();
        res.status(201).json(formatEntry(entry));
      }
    }
  } catch (err) {
    res.status(500).json({ error: "Failed to create entry" });
  }
});

// 5. PUT Route
entriesRouter.put("/entries/:date", async (req, res) => {
  try {
    const parsed = updateJournalEntrySchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid input" });
    } else {
      const [entry] = await db
        .update(journalEntriesTable)
        .set({ ...parsed.data, updatedAt: new Date() })
        .where(eq(journalEntriesTable.date, req.params.date))
        .returning();
        
      if (!entry) {
        res.status(404).json({ error: "Entry not found" });
      } else {
        res.json(formatEntry(entry));
      }
    }
  } catch (err) {
    res.status(500).json({ error: "Failed to update entry" });
  }
});

// 6. DELETE Route
entriesRouter.delete("/entries/:date", async (req, res) => {
  try {
    const [deleted] = await db
      .delete(journalEntriesTable)
      .where(eq(journalEntriesTable.date, req.params.date))
      .returning();
      
    if (!deleted) {
      res.status(404).json({ error: "Entry not found" });
    } else {
      res.status(204).send();
    }
  } catch (err) {
    res.status(500).json({ error: "Failed to delete entry" });
  }
});

export default entriesRouter;
