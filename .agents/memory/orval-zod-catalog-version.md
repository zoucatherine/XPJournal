---
name: Orval Zod catalog version detection
description: Why generated validators can accidentally target Zod 4 in a Zod 3 pnpm catalog workspace.
---

Explicitly match Orval's validator target to the installed Zod major rather than trusting automatic version detection when dependencies use pnpm catalog references.

**Why:** New UUID formats generated top-level Zod 4 validators despite this project's catalog pointing to Zod 3, breaking library typechecking. Regenerating without an explicit version repeated the mismatch.

**How to apply:** When adding schema formats or upgrading code generation, verify the generated validators' major-version compatibility. Keep the generator target and installed runtime aligned; do not patch generated output.
