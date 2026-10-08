# Private journal images

Journal bodies remain plain text. A separate ordered reference array records
each image ID and UTF-16 insertion offset. Binary image data is stored only in
private object storage. New clients must send the reference array on saves;
older clients are prevented from updating entries with images.

## Limits

- JPEG, PNG, WebP; no animation, SVG, HEIC or arbitrary files.
- Browser originals: 20 MiB and 40 million pixels.
- Stored uploads: 1 MiB, at most 2048 pixels per side and 4 million pixels.
- 10 images per entry; 50 MiB of reserved image storage per account.
- Pending uploads expire after 24 hours; signed PUT URLs last 15 minutes.
- Failed/abandoned uploads and deleted entry/account images are cleaned on
  subsequent authenticated app requests, in bounded retryable sweeps. Cleanup
  is eventual, not an unattended scheduled job. On an idle app cleanup resumes
  when someone next uses it.

Removing a button from a draft does not delete the saved image. Only a
successful entry transaction marks removed images inaccessible. Account
deletion leaves ownerless, inaccessible cleanup records. Storage failures
retain cleanup records for retry. Cleanup waits until signed PUT URLs expire
so a late upload cannot recreate an already-cleaned object.

Finalization decodes and validates the actual uploaded bytes, then writes a
different immutable private object. Reusing a signed PUT URL cannot modify
an already-finalized image. Reads require the existing account bearer token;
no public image route or permanent download URL is provided.

## Replit

App Storage is provisioned in this workspace. The standard private directory
and Replit sidecar credentials are used. No additional user API key is needed
for this hosting configuration.

## Vercel or another external host

Replit's local storage sidecar does **not** exist on Vercel. This implementation
therefore supports a separate Google Cloud Storage bucket for external hosts.
The external host must use its existing externally reachable PostgreSQL too.

Configure the following through the external host's secure environment settings:

- `ATTACHMENT_STORAGE_PROVIDER=gcs`
- `ATTACHMENT_BUCKET`: the name of a merchant/user-owned private GCS bucket.
- `ATTACHMENT_GCS_CREDENTIALS`: the service-account JSON secret, never a frontend
  variable. The account must be able to read/create/delete objects and sign
  upload URLs for that bucket.

The bucket must have public access prevention enabled, uniform bucket-level
access, and CORS allowing PUT from the actual web app origins with Content-Type.
Example CORS policy (replace the origin with your actual published origin):

```json
[{
  "origin": ["https://your-actual-app-domain.example"],
  "method": ["PUT"],
  "responseHeader": ["Content-Type"],
  "maxAgeSeconds": 3600
}]
```

Only browser uploads use signed cloud URLs. All image reads still pass through
the authenticated journal API. Vercel mode is detected automatically and never
falls back to Replit sidecar credentials. If configuration is absent the user
sees an explicit storage-unavailable error and the journal draft is preserved.

There is no automatic migration of image objects between hosting providers.
Do not change buckets/providers for an existing data set without first copying
its objects and updating stored paths as a separate migration.

The Vercel adapter is implemented but cannot be verified against a real
external bucket without that deployment's bucket/credentials configuration.
