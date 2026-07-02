---
name: Multi-tenant apps must clear React Query cache on auth transitions
description: When adding per-user accounts to an app that already uses a long-lived React Query client, login/logout must clear the cache or the next account can briefly see the previous account's data.
---

Adding multi-account auth (JWT-based sign-up/login) to an existing app that
already has a module-level, long-lived `QueryClient` is not enough to
prevent cross-account data leakage on its own. Scoping API responses/DB
queries by `userId` on the server is necessary but not sufficient — the
client still caches server responses under stable query keys (e.g. "entries
for today") that don't include the user identity. When User A logs out and
User B logs in on the same device/browser, User B can briefly render User
A's cached entries/notes/settings before the refetch resolves.

**Why:** This was found by a dedicated code review pass, not caught by
manual testing or curl-based API verification, because API-level tests hit
the server directly and never exercise the client cache. It only manifests
in the UI on account switch.

**How to apply:** Whenever adding or reviewing per-user/multi-tenant auth on
top of an app using React Query (or any client-side cache keyed without the
user id), call `queryClient.clear()` at both:
1. The moment a login/signup succeeds (before the newly authenticated UI
   mounts), and
2. The moment logout fires (before falling back to the auth screen).

Do this even if query keys "look" account-scoped by convention — safest to
just clear on every auth transition rather than rely on key design.
