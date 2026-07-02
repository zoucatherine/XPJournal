import { Router } from "express";
import { db } from "@workspace/db";
import { stickyNotesTable, insertStickyNoteSchema, updateStickyNoteSchema } from "@workspace/db/schema";
import { and, eq } from "drizzle-orm";

const notesRouter = Router();

notesRouter.get("/notes", async (req, res) => {
  try {
    const notes = await db
      .select()
      .from(stickyNotesTable)
      .where(eq(stickyNotesTable.userId, req.userId as string))
      .orderBy(stickyNotesTable.createdAt);
    res.json(notes.map(formatNote));
  } catch {
    res.status(500).json({ error: "Failed to fetch notes" });
  }
});

notesRouter.post("/notes", async (req, res) => {
  try {
    const parsed = insertStickyNoteSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid input" });
      return;
    }
    const [note] = await db
      .insert(stickyNotesTable)
      .values({ ...parsed.data, userId: req.userId as string })
      .returning();
    res.status(201).json(formatNote(note));
  } catch {
    res.status(500).json({ error: "Failed to create note" });
  }
});

notesRouter.put("/notes/:id", async (req, res) => {
  try {
    const parsed = updateStickyNoteSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid input" });
      return;
    }
    const [note] = await db
      .update(stickyNotesTable)
      .set({ ...parsed.data, updatedAt: new Date() })
      .where(and(eq(stickyNotesTable.userId, req.userId as string), eq(stickyNotesTable.id, req.params.id)))
      .returning();
    if (!note) {
      res.status(404).json({ error: "Note not found" });
      return;
    }
    res.json(formatNote(note));
  } catch {
    res.status(500).json({ error: "Failed to update note" });
  }
});

notesRouter.delete("/notes/:id", async (req, res) => {
  try {
    const [deleted] = await db
      .delete(stickyNotesTable)
      .where(and(eq(stickyNotesTable.userId, req.userId as string), eq(stickyNotesTable.id, req.params.id)))
      .returning();
    if (!deleted) {
      res.status(404).json({ error: "Note not found" });
      return;
    }
    res.status(204).send();
  } catch {
    res.status(500).json({ error: "Failed to delete note" });
  }
});

function formatNote(note: typeof stickyNotesTable.$inferSelect) {
  return {
    id: note.id,
    content: note.content,
    color: note.color,
    posX: note.posX,
    posY: note.posY,
    sizeW: note.sizeW ?? null,
    sizeH: note.sizeH ?? null,
    createdAt: note.createdAt.toISOString(),
    updatedAt: note.updatedAt.toISOString(),
  };
}

export default notesRouter;
