---
name: Artifact services already have workflows
description: Registered artifacts' services are already backed by a running workflow; check before creating a duplicate.
---

Registering an artifact (via createArtifact or an earlier session) automatically creates and starts a workflow for each of its services, typically named `artifacts/<slug>: <service-name>` (e.g. `artifacts/api-server: API Server`, `artifacts/calendar-journal: web`, `artifacts/journal-mobile: expo`).

If `restart_workflow` fails with `RUN_COMMAND_NOT_FOUND` for a name you expected (e.g. the artifact's plain title), don't assume no workflow exists — call `listWorkflows()` first. The real workflow is usually already running under the `artifacts/<slug>: <service>` naming convention.

**Why:** Blindly calling `configureWorkflow()` to "bootstrap" a service that's already running creates a duplicate workflow that fights over the same port and fails to start (port conflicts, `PORT` env mismatches), producing confusing FAILED workflow logs that look like app bugs but are just duplicate-workflow noise.

**How to apply:** Before configuring any workflow for a service that belongs to a registered artifact, run `listWorkflows()` (or check `getWorkflowStatus`) for a name matching `artifacts/<slug>: ...`. Only use `configureWorkflow` for genuinely new, non-artifact processes. If you did create a duplicate, `removeWorkflow` it and restart the real one instead.
