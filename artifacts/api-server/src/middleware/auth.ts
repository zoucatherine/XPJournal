import jwt from "jsonwebtoken";

const JWT_SECRET: string = (() => {
  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    throw new Error("SESSION_SECRET must be set to sign and verify session tokens.");
  }
  return secret;
})();

export const AUTH_TOKEN_EXPIRY = "30d";

export function signSessionToken(userId: string): string {
  return jwt.sign({ sub: userId }, JWT_SECRET, { expiresIn: AUTH_TOKEN_EXPIRY });
}

export function verifySessionToken(token: string): string | null {
  try {
    const payload = jwt.verify(token, JWT_SECRET) as string | (jwt.JwtPayload & { sub?: string });
    if (typeof payload === "object" && payload && typeof payload.sub === "string") {
      return payload.sub;
    }
    return null;
  } catch {
    return null;
  }
}

export function requireAuth(req: any, res: any, next: any) {
  const header = req.headers.authorization;
  const token = typeof header === "string" && header.startsWith("Bearer ") ? header.slice(7) : null;

  if (!token) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const userId = verifySessionToken(token);
  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  req.userId = userId;
  next();
}
