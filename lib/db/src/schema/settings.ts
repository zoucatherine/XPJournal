import { pgTable, text, timestamp, uuid, primaryKey } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const settingsTable = pgTable(
  "settings",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    key: text("key").notNull(),
    value: text("value").notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [primaryKey({ columns: [table.userId, table.key] })],
);

export type Setting = typeof settingsTable.$inferSelect;
