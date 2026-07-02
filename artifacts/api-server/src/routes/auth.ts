import { Router } from "express";
import bcrypt from "bcryptjs";
import { db, pool } from "@workspace/db";
import {
  usersTable,
  signupSchema,
  loginSchema,
  changeUsernameSchema,
  changePasswordSchema,
} from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { signSessionToken, requireAuth } from "../middleware/auth.js";
import { backfillFirstUser } from "../migrate.js";

const authRouter = Router();

const BCRYPT_ROUNDS = 10;
const USERNAME_RE = /^[a-zA-Z0-9_.-]{3,32}$/;

authRouter.post("/auth/signup", async (req, res) => {
  const parsed = signupSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid username or password" });
    return;
  }

  const { username, password } = parsed.data;
  if (!USERNAME_RE.test(username)) {
    res.status(400).json({ error: "Username must be 3-32 characters (letters, numbers, _ . -)" });
    return;
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const existing = await client.query("SELECT 1 FROM users WHERE username = $1", [username]);
    if ((existing.rowCount ?? 0) > 0) {
      await client.query("ROLLBACK");
      res.status(409).json({ error: "That username is already taken" });
      return;
    }

    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    const insertResult = await client.query(
      "INSERT INTO users (username, password_hash) VALUES ($1, $2) RETURNING id, username",
      [username, passwordHash],
    );
    const user = insertResult.rows[0] as { id: string; username: string };

    // Safe to call on every signup: backfillFirstUser tracks completion via
    // a durable schema_migrations row and is a no-op after the first
    // successful run, instead of relying on "is the users table empty?"
    // (which regresses if the sole user account is ever deleted).
    await backfillFirstUser(client, user.id);

    await client.query("COMMIT");

    const token = signSessionToken(user.id);
    res.status(201).json({ token, username: user.username });
  } catch (err) {
    await client.query("ROLLBACK");
    res.status(500).json({ error: "Failed to create account" });
  } finally {
    client.release();
  }
});

authRouter.post("/auth/login", async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid username or password" });
    return;
  }

  try {
    const [user] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.username, parsed.data.username));

    if (!user) {
      res.status(401).json({ error: "Invalid username or password" });
      return;
    }

    const ok = await bcrypt.compare(parsed.data.password, user.passwordHash);
    if (!ok) {
      res.status(401).json({ error: "Invalid username or password" });
      return;
    }

    const token = signSessionToken(user.id);
    res.json({ token, username: user.username });
  } catch {
    res.status(500).json({ error: "Failed to log in" });
  }
});

authRouter.get("/auth/me", requireAuth, async (req, res) => {
  try {
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.userId as string));
    if (!user) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    res.json({ username: user.username });
  } catch {
    res.status(500).json({ error: "Failed to fetch account" });
  }
});

// Changing credentials keeps the caller's current session (and any other
// signed-in devices) valid — sessions are stateless JWTs verified only by
// signature/expiry, not by comparing against the stored password hash, so
// rotating the username or password does not invalidate outstanding tokens.
authRouter.patch("/auth/username", requireAuth, async (req, res) => {
  const parsed = changeUsernameSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request" });
    return;
  }

  const { currentPassword, newUsername } = parsed.data;
  if (!USERNAME_RE.test(newUsername)) {
    res.status(400).json({ error: "Username must be 3-32 characters (letters, numbers, _ . -)" });
    return;
  }

  try {
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.userId as string));
    if (!user) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const ok = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!ok) {
      res.status(401).json({ error: "Current password is incorrect" });
      return;
    }

    if (newUsername === user.username) {
      res.json({ username: user.username });
      return;
    }

    const existing = await db
      .select({ id: usersTable.id })
      .from(usersTable)
      .where(eq(usersTable.username, newUsername));
    if (existing.length > 0) {
      res.status(409).json({ error: "That username is already taken" });
      return;
    }

    await db
      .update(usersTable)
      .set({ username: newUsername, updatedAt: new Date() })
      .where(eq(usersTable.id, user.id));

    res.json({ username: newUsername });
  } catch (err: any) {
    if (err?.code === "23505") {
      res.status(409).json({ error: "That username is already taken" });
      return;
    }
    res.status(500).json({ error: "Failed to update username" });
  }
});

authRouter.patch("/auth/password", requireAuth, async (req, res) => {
  const parsed = changePasswordSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request" });
    return;
  }

  const { currentPassword, newPassword } = parsed.data;

  try {
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.userId as string));
    if (!user) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const ok = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!ok) {
      res.status(401).json({ error: "Current password is incorrect" });
      return;
    }

    const passwordHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
    await db
      .update(usersTable)
      .set({ passwordHash, updatedAt: new Date() })
      .where(eq(usersTable.id, user.id));

    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: "Failed to update password" });
  }
});

export default authRouter;
