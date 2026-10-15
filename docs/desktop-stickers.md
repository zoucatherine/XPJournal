# Desktop PNG stickers

The web journal's Start menu provides **Add sticker** and **Manage stickers**.
Stickers are private account data, not journal attachments. The native Expo app
does not currently display or edit them.

## Images and limits

- PNG input only, up to 20 MiB and 40 megapixels; animation is rejected before
  browser bitmap decoding.
- The browser preserves alpha and PNG format, re-encodes and, when necessary,
  downscales to at most 1024 pixels per edge and 1 MiB. No source upscaling.
- The server independently validates PNG chunks, rejects APNG, fully decodes
  pixels, strips ancillary metadata by lossless PNG re-encoding, and rechecks
  the 1 MiB limit. Alpha is never flattened.
- Each account can have up to 50 active/pending stickers and 25 MiB of reserved
  or stored PNG data. Reservations expire after 24 hours.
- Position and proportional display size are database metadata. Actual PNGs
  live in private object storage; no image data is stored in database rows or
  browser localStorage.

## Storage and privacy

The existing private image adapter supplies storage, including the existing
external GCS option documented in `journal-attachments.md`. No new credentials
are needed for a working Replit private-storage setup.

Uploads use a 15-minute signed PUT URL pointing to a staging key. Finalize
verifies and re-encodes the staged image and writes a separate immutable key.
Reusing a staging URL cannot change a saved sticker. All metadata and image
reads, updates, finalization, and deletion require the current account's bearer
token and ownership. API responses never expose object paths. Image responses
are `private, no-store`, and browser blob URLs are revoked when unmounted.

The `desktop_stickers` table and dedicated object prefixes are independent
of journal attachments. Removing journal entries cannot remove stickers.

## Removal and cleanup

Removal immediately hides the sticker and denies subsequent image reads.
Durable tombstones retain private object paths until deletion succeeds.
Deleting an account nulls sticker ownership, immediately denying all access.
Expired reservations are also eligible for cleanup.

Cleanup waits until all signed PUT URLs have expired so that an old URL cannot
recreate a deleted staging object. It deletes expired staging files for live
stickers too. Storage failures retain cleanup records for retry.

The long-lived API server runs a cleanup sweep on startup and every minute,
and authenticated API traffic also triggers a throttled sweep. Each sweep
processes up to 20 records with row locks and skips records another sweep owns.
While the server is stopped, records remain private and cleanup resumes on
restart. Serverless hosts cannot rely on in-process timers: on those hosts,
cleanup is driven by authenticated requests unless the host is configured to
schedule cleanup separately. This feature does not provision a host-specific
cron service.

## Verification

Backend tests use a throwaway database schema and mocked private-object
operations; no real user data is mutated. They cover authentication, PNG decode
and alpha preservation, metadata bounds, immutable finalization, account
isolation, quota enforcement, durable cleanup retries, and account deletion.
Browser verification should also exercise actual signed uploads, movement,
resize, reload, removal, and a narrow viewport.
