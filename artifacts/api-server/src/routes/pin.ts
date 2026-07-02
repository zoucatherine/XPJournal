import { Router } from "express";
import bcrypt from "bcryptjs";
import { db } from "@workspace/db";
import { settingsTable } from "@workspace/db/schema";
import { and, eq } from "drizzle-orm";

const pinRouter = Router();

const PIN_KEY = "pin_hash";
const BCRYPT_ROUNDS = 10;

pinRouter.get("/pin/status", async (req, res) => {
  try {
    const [row] = await db
      .select()
      .from(settingsTable)
      .where(and(eq(settingsTable.userId, req.userId as string), eq(settingsTable.key, PIN_KEY)));
    res.json({ configured: !!row });
  } catch {
    res.status(500).json({ error: "Failed to check PIN status" });
  }
});

pinRouter.post("/pin/set", async (req, res) => {
  try {
    const pin = req.body?.pin;
    if (typeof pin !== "string" || pin.length !== 4 || !/^\d{4}$/.test(pin)) {
      res.status(400).json({ error: "PIN must be exactly 4 digits" });
      return;
    }
    const hash = await bcrypt.hash(pin, BCRYPT_ROUNDS);
    const userId = req.userId as string;
    await db
      .insert(settingsTable)
      .values({ userId, key: PIN_KEY, value: hash })
      .onConflictDoUpdate({
        target: [settingsTable.userId, settingsTable.key],
        set: { value: hash, updatedAt: new Date() },
      });
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: "Failed to set PIN" });
  }
});

pinRouter.post("/pin/verify", async (req, res) => {
  try {
    const pin = req.body?.pin;
    if (typeof pin !== "string") {
      res.status(400).json({ error: "Invalid input" });
      return;
    }
    const [row] = await db
      .select()
      .from(settingsTable)
      .where(and(eq(settingsTable.userId, req.userId as string), eq(settingsTable.key, PIN_KEY)));
    if (!row) {
      res.json({ ok: false });
      return;
    }
    const ok = await bcrypt.compare(pin, row.value);
    res.json({ ok });
  } catch {
    res.status(500).json({ error: "Failed to verify PIN" });
  }
});

pinRouter.delete("/pin/remove", async (req, res) => {
  try {
    await db
      .delete(settingsTable)
      .where(and(eq(settingsTable.userId, req.userId as string), eq(settingsTable.key, PIN_KEY)));
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: "Failed to remove PIN" });
  }
});

export default pinRouter;
