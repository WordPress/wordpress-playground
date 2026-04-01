# Site Management API Tasks

## Follow-up: Add UI error handling for PlaygroundSitesAPI errors

The `PlaygroundSitesAPI` methods throw errors that are properly surfaced to MCP consumers, but UI components don't display them to the user. Before this API, these operations were inline Redux dispatches that also didn't handle errors — so this is not a regression, but an improvement opportunity.

### Call sites that need error handling:

- ~~**Rename modal** (`rename-site-modal/index.tsx`) — has try-catch but doesn't show the error~~
- ~~**Delete** (`saved-playgrounds-overlay/index.tsx`) — no try-catch~~
- ~~**Save** — no try-catch in some paths~~
- **setActiveSite** — errors already feed into the Site Error Modal

### Options considered:

- Universal snackbar: too broad, some errors are programming errors not meant for users
- Per-component handling: more work but gives appropriate UX per operation

---

## Remaining PR feedback from adamziel on #3401

### ~~Comment 5: Document where error strings are displayed~~ ✅

File: `site-management-api-middleware.ts:150`

> We need documentation. What purpose does each of these functions fulfill? Do they cause a full page reload? Redirect to a different URL? Change any persisted metadata? It's unclear at the moment.

**Done.** Added JSDoc comments to every method on the `PlaygroundSitesAPI` interface with `@param`, `@returns`, and `@throws` tags.

### ~~Comment 6: persistTemporarySite should throw on failure~~ ✅

File: `site-management-api-middleware.ts:168`

> When would that happen? It seems like `persistTemporarySite()` should throw in these scenarios, otherwise it gives the consumer a wrong impression that the operation succeeded when it actually failed.

**Done.** Removed the try/catch around `showDirectoryPicker` in `persistTemporarySite` so errors propagate naturally. Removed the post-persist `if (storage === 'none')` safety-net checks from `saveInBrowser` and `saveToLocalFileSystem` since `persistTemporarySite` now throws on any failure path. Also removed the `@TODO: Handle errors` comment.
