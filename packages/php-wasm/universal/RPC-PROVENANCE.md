<!-- SPDX-License-Identifier: GPL-2.0-or-later -->

# WordPress Playground RPC provenance record

This is an engineering evidence log for reviewers and counsel. It does not claim
legal clearance, non-infringement, or that the process satisfies any legal
definition of clean-room development.

## Environment and scope history

The task initially required a sanitized source export. That precondition was not
met because the named legacy RPC files and repository history were present. The
root implementation session reported that fact and did not open the named legacy
implementation. The user then directed the session to delete that file without
looking at it and proceed in the current worktree.

The first draft replaced the repository-wide RPC integration. It was committed in
five reviewable commits and pushed to draft PR #4251. After review, the scope was
narrowed: the legacy package-root implementation was mechanically restored and is
again used by most of the repository, while only Playground CLI imports the new
`@php-wasm/universal/playground-rpc` subpath. The initial commits remain in history;
no history rewrite or force-push was used.

The legacy implementation, adapter, and test were restored with a path-limited
`git restore --source=HEAD~5` command. The root session did not print or inspect
their contents. Their presence in the final tree is intentional for the staged
rollout requested in review.

## Design inputs

The new implementation was authored from:

1. the behavioral specification in the task conversation;
2. the supplied repository `AGENTS.md` instructions;
3. current Playground consumer call sites, public types, and build/test
   configuration listed below; and
4. official Node.js release information, used only to choose validation runtimes.

No upstream RPC-library source, documentation, issues, patches, diffs, wire
layouts, algorithms, type declarations, or test cases were intentionally used as
design inputs. No child agent authored the RPC engine. The root session authored
the engine, API facade, codecs, lifecycle and transport design, protocol, and
synchronous implementation.

## Deviations and incidents

### Unsanitized worktree

The implementation was not created in the separate sanitized repository proposed
by the original specification. Counsel should treat that as an unresolved process
deviation rather than infer a clean-room attestation from this report.

### Delegated searches

An early read-only transport-audit agent ran an overly broad repository search
that surfaced a few lines from the legacy test before excluding that path. The
agent did not implement the engine and reported that the snippet was not used. The
root session did not request or rely on it. The exact output remains in the agent
transcript.

During the scope-reduction review, a read-only acceptance agent used Git diff and
search commands. A broad diff surfaced integration fragments from the prior
`api.ts` version. The agent did not inspect the legacy implementation or author
engine code; its recommendations concerned package and CLI boundaries.

### Required repository skill

The root session read
`.agents/skills/playground-website-debugging/SKILL.md` before the initial browser
validation because the agent runtime required that skill. It contained operating
instructions and a high-level reference to the former library, but no engine or
wire implementation. It was not used to design the RPC code.

### Automatic formatting of restored files

The repository's pre-commit hook automatically invoked the uncommitted-file
formatter after the legacy paths had been staged. It processed two restored
legacy files without displaying their contents and changed their bytes. A first
correction used a moving `HEAD~5` reference after new commits had advanced
`HEAD`, which briefly produced an incorrect intermediate commit. The root session
then resolved the fixed pre-change commit (`635bb912170393c3d27425f88f8d0b5670007657`),
restored all three legacy paths from that commit, and committed with
`--no-verify`. Non-content comparisons confirmed all three final files are
byte-identical to that baseline. The transient correction commits were
consolidated into the coexistence commit before they were first pushed. No
published commit was rewritten and no force-push was used.

## External pages and network resources

Access dates: 2026-08-06 and 2026-08-07.

| Resource                                                                                  | Purpose                                                                  |
| ----------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| `https://nodejs.org/en/about/previous-releases`                                           | Identify supported/current Node majors for the original matrix.          |
| `https://nodejs.org/en/download/current`                                                  | Select the then-current Node release for validation.                     |
| Official Node 20.20.2 and 26.5.1 binary download URLs under `nodejs.org/dist`             | Install validation runtimes with `nvm`.                                  |
| npm registry endpoints selected by the committed lockfile                                 | Install repository dependencies; no RPC source was intentionally opened. |
| `https://github.com/WordPress/wordpress-playground/pull/4251` and its review/API endpoint | Create and inspect the draft PR and reviewer request.                    |
| GitHub Actions check and log endpoints for PR #4251                                       | Triage failures in built-package, browser RPC, and unrelated unit jobs.  |

The GitHub review requested a CLI-only first rollout. The old revision's browser
failures exercised the now-reverted browser integration. Its built-package
CommonJS CLI timeout remained relevant and was selected for local reproduction.

## Repository files consulted

The command and agent transcripts are the authoritative detailed record. The
following groups list files opened directly, returned as material search results,
or reported by delegated audits.

### Instructions, workspace, build, and CI

- the user-supplied root `AGENTS.md` and
  `.agents/skills/playground-website-debugging/SKILL.md`;
- `.nvmrc`, `package.json`, `package-lock.json`, `nx.json`,
  `tsconfig.base.json`, and `LICENSE`;
- `.github/workflows/ci.yml` and the built-package test workflow/scripts;
- `packages/php-wasm/universal/{package.json,project.json,README.md,vite.config.ts,vite.rpc-test.config.ts,tsconfig.json,tsconfig.lib.json,tsconfig.spec.json}`;
- `packages/playground/cli/{package.json,project.json,vite.config.ts}` and its
  built-package fixtures;
- relevant package/project/Vite configuration for PHP web, PHP node, Playground
  client, remote, website, service worker, and Nx extensions;
- `packages/nx-extensions/src/executors/package-json/executor.ts`,
  `packages/nx-extensions/src/executors/assert-built-esm-and-cjs/executor.ts`,
  `packages/nx-extensions/src/executors/package-for-self-hosting/executor.ts`, and
  `tools/scripts/publish.mjs`;
- `packages/meta/src/node-es-module-loader/loader.mts`; and
- Node's installed `child_process.d.ts`, consulted only for platform typing.

### New implementation, API facade, tests, and records

- `packages/php-wasm/universal/src/playground-rpc.ts`;
- `packages/php-wasm/universal/src/lib/playground-rpc.ts`;
- `packages/php-wasm/universal/src/lib/rpc.ts`;
- `packages/php-wasm/universal/src/lib/rpc-node-process-adapter.ts`;
- `packages/php-wasm/universal/src/test/rpc.spec.ts`;
- `packages/php-wasm/universal/src/test/rpc-protocol.spec.ts`;
- `packages/php-wasm/universal/src/test/rpc-transports.spec.ts`;
- `packages/php-wasm/universal/src/test/rpc-sync.spec.ts`;
- the `rpc-*` fixtures under
  `packages/php-wasm/universal/src/test/fixtures/`;
- `packages/php-wasm/universal/src/test/file-lock-manager-in-memory.spec.ts`;
- `packages/php-wasm/universal/RPC-PROTOCOL.md`;
- `packages/php-wasm/universal/RPC-COMPATIBILITY.md`; and
- this provenance record.

The names of the mechanically restored legacy implementation and test appeared in
status/diff/restore commands. Their contents were not a design input for the root
session.

### Playground APIs and integration call sites

- universal API and PHP model files including `src/lib/api.ts`, `src/index.ts`,
  `src/lib/index.ts`, `php-response.ts`, `php.ts`, `php-worker.ts`,
  `universal-php.ts`, `sandboxed-spawn-handler-factory.ts`,
  `file-lock-manager-composite.ts`, `object-pool-proxy.ts`, and
  `error-reporting.ts`;
- all five CLI boundary files changed by the final rollout:
  `blueprints-v1-handler.ts`, `worker-thread-v1.ts`,
  `blueprints-v2-handler.ts`, `worker-thread-v2.ts`, and `run-cli.ts`;
- CLI tests, especially `blueprints-v2-handler.spec.ts`, `run-cli.spec.ts`, and
  file-locking/worker fixtures;
- browser client, remote, web worker, website, personal-site, Blueprint compiler,
  service-worker, and PHP file-lock call sites examined during the original
  dependency audit; and
- the browser lifecycle fixtures and tests created for the first draft and later
  removed when browser adoption was taken out of this PR.

Repository-wide `rg` results were used only to inventory dependencies on
assignment, construction, finalization, proxy marking, special `bind`, RPC
imports, and endpoint ownership.

## Sessions, models, and tools

The service did not expose precise backend build identifiers. Sessions used the
inherited Codex GPT-5-family coding model; no model override was requested.

| Session                                                     | Role                                                                   | Tools                                                                                                                          |
| ----------------------------------------------------------- | ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `/root`                                                     | Engine, tests, integration, validation, commits, PR and provenance     | shell/Git, `rg`, `sed`, `apply_patch`, Nx, npm, `nvm`, GitHub CLI/API, web lookup, browser tests, plan and collaboration tools |
| `/root/provenance_skeleton` (Lagrange)                      | Initial provenance outline                                             | shell and `apply_patch`                                                                                                        |
| `/root/rpc_docs` (Confucius)                                | Documentation and later scope audit; no engine work                    | shell, `rg`, `sed`, Git diff, Nx/TypeScript, `apply_patch`                                                                     |
| `/root/source_wording_cleanup` (Harvey)                     | Terminology cleanup and later CLI-boundary audit                       | shell, `rg`, `sed`, Git diff, Prettier, Nx/Vitest/Playwright, `apply_patch`                                                    |
| `/root/acceptance_audit` (Galileo)                          | Acceptance, packaging, and CI validation audits; no engine work        | shell, `rg`, `sed`, Git diff/status, Nx/npm, collaboration tools                                                               |
| Early consumer, transport, and build/package audit sessions | Read-only call-site, lifecycle, build, license, and matrix inventories | repository search/read tools and official Node lookup                                                                          |

No inherited-context agent implemented the RPC engine.

## Authorship and licensing

New implementation, protocol, test, and fixture files carry
`SPDX-License-Identifier: GPL-2.0-or-later` headers. The universal package build
copies the repository's complete `LICENSE` into the published artifact.

The root session authored the engine and tests in this worktree. Documentation
agents authored only bounded records and wording changes reviewed by root. No
third-party code was intentionally copied into the new implementation.

## Validation evidence

The original broad draft was tested across Node 20, 22, 24, and 26 and across
Chromium, Firefox, and WebKit. Those results demonstrate engine development but
do not describe the final integration scope, because browser/client/remote changes
were later reverted.

For the narrowed CLI rollout:

- `php-wasm-universal:typecheck`, `playground-cli:typecheck`, and both package
  lint targets passed;
- `php-wasm-universal:build` and `playground-cli:build` passed;
- universal tests passed on Node 20.20.2 and Node 22.23.1 with 225 tests passed
  and four legacy tests skipped; the same suite passed all 229 tests on Node
  24.11.1 and Node 26.5.1;
- the complete Playground CLI suite passed: 13 files and 188 tests; and
- both CLI self-hosting package targets passed.

The prior PR revision's built-package CommonJS job timed out in every PHP version.
That failure was reproduced from the packed artifacts on Node 22.23.1 and traced
to a synchronous request being ignored when a genuine `SharedArrayBuffer` came
from Jest's VM realm. The transport validators now use intrinsic brand checks for
cross-realm `SharedArrayBuffer`, `ArrayBuffer`, `Uint8Array`, and
`ReadableStream` values. A `node:vm` regression test covers the boundary. After
the fix, the built-package CommonJS suite passed all 89 tests, including all seven
PHP versions, and its separate bundle checks passed Node `require`, Node dynamic
`import`, and Chromium web loading.

The build emits separate ESM and CommonJS `playground-rpc` entries, declarations,
source maps, and the repository GPL license. Both packed subpath formats imported
successfully. The packed CLI license is byte-identical to the repository license
(18,092 bytes; SHA-256
`8177f97513213526df2cf6184d8ff986c675afb514d4e68a404010521b880643`). The
package root remains the legacy entry; its bundles do not contain the new protocol
marker. Because this staged PR intentionally retains the legacy implementation,
it does not claim a repository-wide or package-wide removal scan.

Fresh post-push CI results are recorded in the PR and timestamped task log.

## Attestation boundary

Engineering review can decide whether the implementation meets its tests and the
staged compatibility record. Legal conclusions remain for qualified counsel. In
particular, counsel should review the unsanitized-worktree direction, the delegated
search incidents, and the fact that the legacy files were mechanically restored to
meet the reviewer's staged-rollout request.
