import { pgTable, uuid, text, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

// Objects survive account deletion only as inaccessible cleanup records.
export const journalAttachmentsTable = pgTable("journal_attachments", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").references(() => usersTable.id, { onDelete: "set null" }),
  date: text("date").notNull(),
  name: text("name").notNull(),
  size: integer("size").notNull(),
  contentType: text("content_type").notNull(),
  objectPath: text("object_path").notNull(),
  uploadPath: text("upload_path").notNull(),
  status: text("status").notNull().default("pending"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  uploadExpiresAt: timestamp("upload_expires_at", { withTimezone: true }).notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
});
export const insertJournalAttachmentSchema = createInsertSchema(journalAttachmentsTable);
export type JournalAttachment = typeof journalAttachmentsTable.$inferSelect;
export type InsertJournalAttachment = z.infer<typeof insertJournalAttachmentSchema>;
