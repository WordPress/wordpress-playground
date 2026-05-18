# Autosaved Default Playgrounds Plan

## Problem

The current saved-by-default branch prevents accidental data loss by creating OPFS-backed Playgrounds on first load. However, the UI currently labels these default Playgrounds as `Saved Playground` while the initial OPFS copy can still show `Saving n/k files`.

That creates two user-facing problems:

- `Saved Playground` sounds like an explicit, durable user decision, but default browser storage is closer to recovery autosave.
- `Saving 3542/3542...` can look broken because the file-copy counter can reach its total while Playground is still flushing writes captured during the background sync.

The product needs two separate concepts:

- **Autosaved Playgrounds**: created by default to prevent data loss, stored in browser OPFS, kept only as the latest recovery set.
- **Saved Playgrounds**: explicitly preserved by the user, kept indefinitely unless deleted by the user.

## Evidence From The Repository

- [#1438](https://github.com/WordPress/wordpress-playground/issues/1438) asks for saving Playgrounds by default to avoid refresh data loss, while also noting that default-saved browser sites may create a list-management problem.
- [#3145](https://github.com/WordPress/wordpress-playground/issues/3145) calls out the current save flow as modal-heavy and progress-heavy, and explicitly asks what happens if users close the tab before saving completes.
- [#3169](https://github.com/WordPress/wordpress-playground/issues/3169) shows that users struggle to find saved Playgrounds, so storage state and access points need to be obvious.
- [#1659](https://github.com/WordPress/wordpress-playground/issues/1659) identifies site metadata as the right place for creation/storage details and leaves `last active` style timestamps as an open need.
- [#3409](https://github.com/WordPress/wordpress-playground/issues/3409) reinforces that browser-managed storage can be cleared by browser/platform policies, so it should not be framed as equivalent to an intentionally preserved export or local filesystem copy.

## UX Pattern Comparison

Known autosave products separate safety from intention:

- Google Docs exposes save state and version history. Its help docs describe a visible last-edit/version-history affordance, named versions, and limits on version history.
- Figma keeps the current file updated automatically, groups autosave checkpoints, and lets users create or name versions for intentional milestones. See Figma's version history docs: https://help.figma.com/hc/en-us/articles/360038006754-View-a-file-s-version-history
- Slack automatically saves unsent text as drafts, but "draft" is not presented as a sent or intentionally saved message. See Slack's message docs: https://slack.com/help/articles/201457107-Send-and-read-messages

The useful pattern for Playground is:

- Autosave copy: low-friction, automatic, recoverable, retention-limited.
- Explicit save/keep action: user intent, durable until deleted.
- Status text should describe the current operation, not expose misleading implementation counters after the copy phase has completed.

## Proposed UX

### Browser Chrome Status

- Temporary site: `Unsaved Playground` with the existing `Save` button.
- Autosaved site, idle: `Autosaved Playground` with a `Keep` button.
- Autosaved site, initial sync active: `Autosaving...` or `Finalizing autosave...`.
- Explicitly preserved site: `Saved Playground`.
- OPFS sync error on autosaved site: `Autosave failed`.
- OPFS sync error on explicit saved site: `Save failed`.

This avoids saying "Saved Playground" before the user has explicitly kept it.

### Your Playgrounds Overlay

Show all non-temporary browser/local sites in `Your Playgrounds`, but label their lifecycle:

- Autosaved rows: `Autosaved · kept with the latest 5 autosaves`
- Explicit rows: `Saved in this browser` or `Saved in a local directory`

Autosaved rows should include a `Keep` action in the row menu. Keeping promotes the site to the explicit saved lifecycle.

### Site Manager Details

- Autosaved OPFS sites should say: `Autosaved in this browser. Kept with the latest 5 autosaves.`
- Explicit OPFS sites should continue to say: `Saved in this browser`.
- Local filesystem sites should continue to say: `Saved in a local directory`.
- Autosaved sites should expose a `Keep` action near the standard site actions.

## Data Model

Add metadata that distinguishes lifecycle from storage medium:

```ts
type SitePersistence = 'autosave' | 'explicit';

interface SiteMetadata {
	storage: 'opfs' | 'local-fs' | 'none';
	persistence?: SitePersistence;
	whenCreated?: number;
	whenLastUsed?: number;
}
```

Rules:

- `persistence: 'autosave'` only applies to OPFS browser storage created by default.
- `persistence: 'explicit'` applies to user-preserved OPFS sites and local filesystem sites.
- Missing `persistence` means explicit. This protects all existing saved Playgrounds from accidental pruning.
- `whenLastUsed` supports pruning the latest autosaved sites by actual use, with `whenCreated` as fallback.

## Retention

Keep only the latest 5 autosaved Playgrounds. Do not prune:

- Explicitly saved OPFS sites.
- Local filesystem sites.
- Legacy sites without lifecycle metadata.
- Temporary sites.
- The active/newly created autosaved site while it is being selected.

Run pruning after creating a new default autosaved site, and keep the helper reusable so it can later be invoked after OPFS metadata loading if product wants immediate cleanup on page load.

## Sync Progress

Extend OPFS sync progress with a phase:

- `copying`: file count is meaningful.
- `flushing`: file copy is complete and Playground is flushing filesystem writes captured during the copy.

In UI, once progress is in the flush phase, show `Finalizing autosave...` or `Finalizing save...` instead of `Saving 3542/3542...`.

## Implementation Steps

1. Add site lifecycle helpers and metadata fields in `slice-sites.ts`.
2. Create default Playgrounds as `autosave`; make explicit save flows and local filesystem saves `explicit`.
3. Add `preserveSite` / `keepSite` API that promotes an autosaved site to explicit.
4. Prune autosaved sites to the latest 5 after creating a new autosaved site.
5. Update browser chrome, overlay, and Site Manager text/actions to distinguish autosaved from saved.
6. Add OPFS sync progress phase for copy vs flush.
7. Add focused unit/Playwright coverage for lifecycle, retention, promotion, and status text.

## Verification

Run focused checks first:

```bash
npx nx test playground-website --testFile=packages/playground/website/src/lib/state/redux/slice-sites.spec.ts
npx nx test php-wasm-web --testFile=packages/php-wasm/web/src/lib/directory-handle-mount.spec.ts
npx nx run playground-website:typecheck
npx playwright test --config=packages/playground/website/playwright/playwright.config.ts --project=chromium -g "Default Playground storage"
```

Then rely on the PR's full CI matrix for browser coverage.
