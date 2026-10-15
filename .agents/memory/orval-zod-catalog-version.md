---
name: Orval Zod catalog version detection
description: Orval validator pitfalls with Zod major detection and OpenAPI integer enforcement.
---

Explicitly match Orval's validator target to the installed Zod major rather than trusting automatic version detection when dependencies use pnpm catalog references.

**Why:** New UUID formats generated top-level Zod 4 validators despite this project's catalog pointing to Zod 3, breaking library typechecking. Regenerating without an explicit version repeated the mismatch.

**How to apply:** When adding schema formats or upgrading code generation, verify the generated validators' major-version compatibility. Keep the generator target and installed runtime aligned; do not patch generated output.

## Integer validation

Do not assume an OpenAPI `integer` becomes an integer-only runtime validator.

**Why:** The current generator emitted bounded `number()` validators without `.int()`. Fractional byte counts passed validation and produced a database error instead of an understandable input error.

**How to apply:** Inspect generated validators for numeric request fields and explicitly enforce integer semantics at the API boundary when required. Verify fractional values are rejected before database writes, without hand-editing generated files.
