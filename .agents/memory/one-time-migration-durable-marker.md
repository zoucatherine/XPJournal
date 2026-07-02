---
name: One-time migration state needs a durable marker, not an inferred one
description: Why "is this table empty?" is unsafe as a proxy for "has this one-time migration already run?"
---

Detecting whether a one-time schema/data migration step has already executed
by inspecting incidental state (e.g. "is the users table empty?", "does this
column have any non-null values?") is unsafe whenever that state can later
revert to its pre-migration shape through normal application behavior (row
deletion, cascade deletes, resets, etc).

**Why:** A migration gated this way will re-trigger any time the inferred
condition becomes true again, even though the migration already ran. If the
migration is not idempotent (e.g. it alters primary keys or drops
constraints that no longer exist), the re-run fails. If that failure happens
inside the same transaction as an unrelated user-facing action (e.g. account
signup), the whole action rolls back — and since the failure doesn't change
the inferred state, it repeats forever, permanently breaking that action.

**How to apply:** For any migration/backfill step that must run at most
once, record completion in a dedicated durable marker (a row in a
`schema_migrations`-style table, inserted atomically with
`INSERT ... ON CONFLICT DO NOTHING RETURNING ...` so concurrent/duplicate
calls only proceed once). Gate the step on that marker, not on the shape of
the data it touches. As a secondary safety net, also make the underlying
schema-altering statements idempotent (check current state before
ALTERing) to protect environments that already got stuck in the broken
loop before the marker was introduced.
