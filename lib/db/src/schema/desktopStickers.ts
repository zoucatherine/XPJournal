import { pgTable, uuid, text, integer, timestamp, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

export const desktopStickersTable = pgTable("desktop_stickers", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").references(() => usersTable.id, { onDelete: "set null" }),
  name: text("name").notNull(),
  size: integer("size").notNull(),
  uploadSize: integer("upload_size").notNull(),
  imageWidth: integer("image_width"),
  imageHeight: integer("image_height"),
  posX: integer("pos_x").notNull().default(16),
  posY: integer("pos_y").notNull().default(16),
  displaySize: integer("display_size").notNull().default(160),
  objectPath: text("object_path").notNull(),
  uploadPath: text("upload_path").notNull(),
  uploadCleaned: boolean("upload_cleaned").notNull().default(false),
  status: text("status").notNull().default("pending"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  uploadExpiresAt: timestamp("upload_expires_at", { withTimezone: true }).notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
});

export const insertDesktopStickerSchema = createInsertSchema(desktopStickersTable);
export type DesktopStickerRow = typeof desktopStickersTable.$inferSelect;
export type InsertDesktopSticker = z.infer<typeof insertDesktopStickerSchema>;
