# 5rSuites refactor: how to apply

Base commit: 46e91ce ("Admin: redesign with light/dark themes...").  Tests: 43 passing (`npm test`); admin app builds.

## Option A: patch (recommended)
    git apply --check changes.patch && git apply changes.patch

## Option B: copy files
1. Copy everything inside `files/` over your repo (paths match the repo layout).
2. Delete the files in `deleted.txt`:
       xargs rm -f < deleted.txt
3. Stop tracking the Wix export (files stay on disk; history is NOT rewritten):
       git rm -r --cached wix-images
   and make sure .gitignore contains `wix-images/` (it is in the copied .gitignore).

Either way, then run: npm install && npm test

## What changed (one commit each)
  98948cd Admin client: one resources.js API layer; opening a submission no longer writes inside its GET loader
  358eddd Media delete guard: find image uses via the block schema, not a JSON key name
  b860630 Restore: refuse sections that fail validation instead of bypassing the validator
  9be21ce Remove dead code; stop tracking the 187 MB wix-images export
  d63cbbd One source of truth for form types; share the submissions list/export filter
  2dd41bc Admin API: one published()/publishedPage() helper for the save→purge→respond tail

Notes
- Item 5 deviates from the audit suggestion: no media_refs table (it would drift for raw-SQL writers like the Wix import).
  The delete guard now walks image fields via the block schema (collectImageIds).
- Restore now answers 422 (and changes nothing) if a saved section no longer validates; snapshots carry {"v":1}.
- No database migration is needed.
- To purge wix-images from git history entirely you'd need git filter-repo; deliberately not done here.
