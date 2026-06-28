import { pgTable, text, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const stickyNotesTable = pgTable("sticky_notes", {
  id: text("id").primaryKey(),
  content: text("content").notNull().default(""),
  color: text("color").notNull().default("yellow"),
  posX: integer("pos_x").notNull().default(200),
  posY: integer("pos_y").notNull().default(200),
  sizeW: integer("size_w"),
  sizeH: integer("size_h"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertStickyNoteSchema = createInsertSchema(stickyNotesTable).omit({
  createdAt: true,
  updatedAt: true,
});

export const updateStickyNoteSchema = z.object({
  content: z.string().optional(),
  color: z.string().optional(),
  posX: z.number().int().optional(),
  posY: z.number().int().optional(),
  sizeW: z.number().int().nullable().optional(),
  sizeH: z.number().int().nullable().optional(),
});

export type InsertStickyNote = z.infer<typeof insertStickyNoteSchema>;
export type UpdateStickyNote = z.infer<typeof updateStickyNoteSchema>;
export type StickyNote = typeof stickyNotesTable.$inferSelect;
