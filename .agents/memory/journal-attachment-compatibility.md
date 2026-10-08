---
name: Journal attachment compatibility
description: Plain-text and legacy-mobile compatibility requirements for the attachment feature.
---

Keep journal writing independently readable from image metadata, and prevent older clients from editing image-containing entries if they cannot preserve insertion positions.

**Why:** The journal has both web and native clients; introducing inline image buttons must not let a plain-text-only mobile save silently detach or reposition someone's saved photos. Full native attachment editing was deliberately deferred.

**How to apply:** Future mobile attachment editing must round-trip both text and image positions before lifting the read-only protection. Do not replace it with silently keeping stale offsets when text changes.

Personal captions follow the entry's Save/Discard lifecycle, rather than saving immediately when typed. Keep a caption when replacing the image in the same attachment position.

**Why:** A caption is part of the journal draft; discarding edits should not change a saved entry. Replacing a photo can be a correction to the file while the user's description of that journal moment is still valid.

**How to apply:** Future attachment controls should preserve these draft semantics and avoid losing user-written labels during replacement.
