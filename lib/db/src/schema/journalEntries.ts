import { pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const journalEntriesTable = pgTable("journal_entries", {
  date: text("date").primaryKey(),
  title: text("title").notNull(),
  body: text("body").notNull(),
  mood: text("mood"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertJournalEntrySchema = createInsertSchema(journalEntriesTable).omit({
  createdAt: true,
  updatedAt: true,
});

export const updateJournalEntrySchema = z.object({
  title: z.string(),
  body: z.string(),
  mood: z.string().nullable().optional(),
});

export type InsertJournalEntry = z.infer<typeof insertJournalEntrySchema>;
export type UpdateJournalEntry = z.infer<typeof updateJournalEntrySchema>;
export type JournalEntry = typeof journalEntriesTable.$inferSelect;
