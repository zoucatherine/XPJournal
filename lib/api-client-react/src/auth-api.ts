import { customFetch } from "./custom-fetch";

export interface AuthResult {
  token: string;
  username: string;
}

export interface AuthMe {
  username: string;
}

export async function signup(input: { username: string; password: string }): Promise<AuthResult> {
  return customFetch<AuthResult>("/api/auth/signup", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function login(input: { username: string; password: string }): Promise<AuthResult> {
  return customFetch<AuthResult>("/api/auth/login", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function getMe(): Promise<AuthMe> {
  return customFetch<AuthMe>("/api/auth/me", { method: "GET" });
}
