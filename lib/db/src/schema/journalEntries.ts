import { pgTable, text, timestamp, uuid, primaryKey, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

export const journalEntriesTable = pgTable(
  "journal_entries",
  {
    date: text("date").notNull(),
    userId: uuid("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    body: text("body").notNull(),
    attachmentRefs: jsonb("attachment_refs").$type<{ id: string; offset: number }[]>().notNull().default([]),
    mood: text("mood"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [primaryKey({ columns: [table.userId, table.date] })],
);

export const insertJournalEntrySchema = createInsertSchema(journalEntriesTable).omit({
  userId: true,
  createdAt: true,
  updatedAt: true,
  attachmentRefs: true,
}).extend({
  attachments: z.array(z.object({ id: z.string().uuid(), offset: z.number().int().nonnegative() })).max(10).optional(),
});

export const updateJournalEntrySchema = z.object({
  title: z.string(),
  body: z.string(),
  mood: z.string().nullable().optional(),
  attachments: z.array(z.object({ id: z.string().uuid(), offset: z.number().int().nonnegative() })).max(10).optional(),
});

export type InsertJournalEntry = z.infer<typeof insertJournalEntrySchema>;
export type UpdateJournalEntry = z.infer<typeof updateJournalEntrySchema>;
export type JournalEntry = typeof journalEntriesTable.$inferSelect;
