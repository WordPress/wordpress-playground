<!-- SPDX-License-Identifier: GPL-2.0-or-later -->

# WordPress Playground RPC provenance and clean-room record

This is an engineering evidence log for counsel and reviewers. It does not
claim legal clearance, non-infringement, or that the resulting work satisfies a
legal definition of clean-room development.

## Directions and environment handling

The task began with a requirement to confirm a sanitized source export before
implementation. That precondition failed because
`packages/php-wasm/universal/src/lib/comlink-sync.ts` was present. The root
session reported the failure and did not open the file. The user then explicitly
directed the root session to delete that file without looking at it and proceed
in the current worktree.

The root session deleted these paths without opening them:

- `packages/php-wasm/universal/src/lib/comlink-sync.ts`;
- `packages/php-wasm/universal/src/test/comlink-sync.spec.ts`; and
- `packages/php-wasm/universal/src/lib/comlink-node-process-adapter.ts` (the
  obsolete adapter, replaced by an independently authored adapter).

No Git-history/object search, checkout of the deleted files, history rewrite,
or force-push was performed. The work was not authored in the separately
sanitized repository proposed by the original task. Historical commits and
notices remain in repository history.

## Inputs used

The behavior and API were designed from:

1. the behavioral specification supplied in the task conversation;
2. the `AGENTS.md` contents supplied in that conversation;
3. current Playground consumer call sites, types, package configuration, and
   test/build infrastructure listed below; and
4. official Node.js release metadata used only to select the current-Node test
   version.

No upstream RPC-library source, documentation, issues, patches, diffs, wire
layouts, algorithms, type declarations, or test cases were intentionally
consulted. No child agent was asked to author the RPC engine. The root session
authored `rpc.ts`, `api.ts`, the codecs, transports, lifecycle design, protocol,
and synchronous implementation.

## Deviations and incidents

### Current worktree instead of a sanitized repository

The user superseded the requested separate-repository workflow. This record
therefore does not attest that the worktree was sanitized, only that the named
legacy implementation and test were not opened by the root implementation
session.

### Delegated transport-audit search

A read-only transport-audit agent ran an overly broad `rg` search that surfaced
a few lines from the legacy test before that path was excluded. The agent was
not assigned implementation work, did not author engine code, and reported that
the snippet was not used. The root session did not request, reproduce, or rely
on the snippet. The exact command and line output remain in the child-session
tool transcript; they are not available in the root session after context
compaction. Counsel should review that transcript rather than infer that the
original sanitized precondition was met.

### Repository browser-debugging skill

The root session read
`.agents/skills/playground-website-debugging/SKILL.md` because the agent runtime
required that skill before browser validation. It supplied dev-server and
Playwright operating instructions and contained one stale high-level reference
to the former library. It contained no implementation or wire protocol and was
not used to design the engine. It is recorded here because it was outside the
initially enumerated clean-room inputs.

## External pages and downloads

Access date for this section: 2026-08-06.

| External resource                                                    | Purpose                                 | Information used                                                                        |
| -------------------------------------------------------------------- | --------------------------------------- | --------------------------------------------------------------------------------------- |
| `https://nodejs.org/en/about/previous-releases`                      | Official Node.js release status         | Confirmed major 26 is Current.                                                          |
| `https://nodejs.org/en/download/current`                             | Official current download metadata      | Selected Node.js 26.5.1 for the current-Node run.                                       |
| `https://nodejs.org/dist/v20.20.2/node-v20.20.2-darwin-arm64.tar.xz` | Official Node binary installed by `nvm` | Node 20 validation runtime.                                                             |
| `https://nodejs.org/dist/v26.5.1/node-v26.5.1-darwin-arm64.tar.xz`   | Official Node binary installed by `nvm` | Current-Node validation runtime.                                                        |
| npm registry endpoints selected by the committed lockfile            | `npm ci` dependency installation        | Installed repository tooling; no third-party RPC source was opened or used as an input. |

No other web page was intentionally opened. The Node pages were consulted for
release/version facts, not for RPC semantics or implementation.

## Repository files consulted

The session transcript is the authoritative command-level record. The following
lists the files opened directly, returned as material search results, or reported
as consulted by delegated audits. Repository-wide `rg` scans used to locate call
sites are preserved verbatim in that transcript.

### Repository and build rules

- user-supplied root `AGENTS.md` contents;
- `.agents/skills/playground-website-debugging/SKILL.md`;
- `packages/php-wasm/compile/AGENTS.md`;
- `.nvmrc`, `package.json`, `package-lock.json`, `nx.json`,
  `tsconfig.base.json`, and `LICENSE`;
- `packages/php-wasm/universal/package.json`, `project.json`, `README.md`,
  `vite.config.ts`, `tsconfig.json`, `tsconfig.lib.json`, and
  `tsconfig.spec.json`;
- `packages/php-wasm/web/package.json`, `project.json`,
  `playwright.config.ts`, `vite.config.ts`, `vite.playwright.config.ts`, and
  `tsconfig.spec.json`;
- `packages/php-wasm/node/project.json`;
- `tools/scripts/publish.mjs`;
- `packages/nx-extensions/src/executors/package-json/executor.ts`;
- `packages/nx-extensions/src/executors/assert-built-esm-and-cjs/executor.ts`;
- `node_modules/@types/node/child_process.d.ts`, consulted only for Node
  child-process platform typing;
- `packages/playground/client/package.json`, `project.json`, `README.md`, and
  `vite.config.ts`;
- `packages/playground/remote/package.json`, `project.json`, and `vite.config.ts`;
- `packages/php-wasm/web-service-worker/package.json`, `project.json`, and
  `vite.config.ts`;
- `packages/vite-extensions/vite-external-modules.ts` and
  `vite-global-extensions.ts`;
- the website Playwright configuration files used by the browser audit; and
- CI configuration located by the build audit for the repository's Node
  20/22/24 jobs (exact search output is retained in that agent transcript).

The root session also ran a focused Nx project-graph query to inspect the
`php-wasm-universal` build and package dependency closure. The session transcript
is authoritative for the exact query and its output; the graph was used only to
scope build and artifact validation.

### API, implementation, and direct tests

- `packages/php-wasm/universal/src/lib/api.ts`;
- `packages/php-wasm/universal/src/lib/rpc.ts`;
- `packages/php-wasm/universal/src/lib/rpc-node-process-adapter.ts`;
- `packages/php-wasm/universal/src/index.ts`;
- `packages/php-wasm/universal/src/lib/index.ts`;
- `packages/php-wasm/universal/src/lib/php-response.ts`;
- `packages/php-wasm/universal/src/lib/universal-php.ts`;
- `packages/php-wasm/universal/src/lib/sandboxed-spawn-handler-factory.ts`;
- `packages/php-wasm/universal/src/lib/file-lock-manager-composite.ts`;
- `packages/php-wasm/universal/src/lib/object-pool-proxy.ts`;
- `packages/php-wasm/universal/src/lib/error-reporting.ts`;
- `packages/php-wasm/universal/src/lib/php.ts`;
- `packages/php-wasm/universal/src/test/rpc.spec.ts`;
- `packages/php-wasm/universal/src/test/rpc-protocol.spec.ts`;
- `packages/php-wasm/universal/src/test/rpc-transports.spec.ts`;
- `packages/php-wasm/universal/src/test/rpc-sync.spec.ts`;
- `packages/php-wasm/universal/src/test/fixtures/rpc-sync-runtime.ts`;
- `packages/php-wasm/universal/src/test/fixtures/rpc-sync-worker.mjs`;
- `packages/php-wasm/universal/src/test/fixtures/rpc-async-worker.mjs`;
- `packages/php-wasm/universal/src/test/fixtures/rpc-child-process.mjs`;
- `packages/php-wasm/universal/src/test/file-lock-manager-in-memory.spec.ts`;
- `packages/php-wasm/universal/src/test/php-response.spec.ts`;
- `packages/php-wasm/universal/vite.rpc-test.config.ts`; and
- `packages/php-wasm/universal/bin/verify-rpc-artifacts.mjs`;
- `packages/php-wasm/universal/RPC-PROTOCOL.md`;
- `packages/php-wasm/universal/RPC-COMPATIBILITY.md`;
- `packages/php-wasm/universal/RPC-PROVENANCE.md`; and
- the browser cross-process architecture document changed by this work.

The deleted legacy implementation and test names appear in handling records and
Git status only; their contents were not an implementation input.

The Node child-process integration was configured and tested with Node's
`serialization: 'advanced'` option. This is required to preserve the documented
structured-value contract; the default JSON IPC mode is intentionally outside
the supported transport configuration.

### Browser transports and lifecycle tests

- `packages/php-wasm/web/src/lib/worker-thread/spawn-php-worker-thread.ts`;
- `packages/php-wasm/web/src/lib/index.ts`;
- `packages/php-wasm/web/src/test/playwright/browser-globals.ts`;
- `packages/php-wasm/web/src/test/readable-stream-transfer.spec.ts`
  (read-only audit of existing coverage, not translated into the new suite);
- `packages/php-wasm/web/playwright.rpc.config.ts`;
- `packages/php-wasm/web/src/test/rpc-browser-lifecycle.spec.ts`; and
- every `rpc-browser-*` fixture under
  `packages/php-wasm/web/src/test/playwright/`.

### Playground integration and consumer call sites

- `packages/playground/client/src/index.ts`;
- `packages/playground/client/src/blueprints-v1-handler.ts`;
- `packages/playground/client/src/blueprints-v2-handler.ts`;
- `packages/playground/remote/src/lib/boot-playground-remote.ts`;
- `packages/playground/remote/src/lib/playground-worker-endpoint-blueprints.ts`;
- `packages/playground/remote/src/lib/playground-worker-endpoint-blueprints.spec.ts`;
- `packages/playground/remote/vite.config.ts`;
- `packages/playground/cli/src/blueprints-v1/blueprints-v1-handler.ts`;
- `packages/playground/cli/src/blueprints-v1/worker-thread-v1.ts`;
- `packages/playground/cli/src/blueprints-v2/blueprints-v2-handler.ts`;
- `packages/playground/cli/src/blueprints-v2/worker-thread-v2.ts`;
- `packages/playground/cli/src/run-cli.ts`;
- `packages/playground/blueprints/src/lib/v1/compile.ts`;
- `packages/playground/website/src/lib/state/redux/boot-site-client.ts`;
- `packages/playground/website/src/lib/boot-playground-api.ts` and
  `packages/playground/website/src/main.tsx`;
- `packages/playground/personal-wp/src/lib/state/redux/boot-site-client.ts`;
- `packages/playground/website/playwright/e2e/website-ui.spec.ts`;
- `packages/playground/website/src/lib/state/redux/error-utils.ts` and its
  adjacent spec;
- `packages/playground/personal-wp/src/lib/state/redux/error-utils.ts`;
- `packages/playground/website/src/lib/state/redux/persist-temporary-site.ts`;
- `packages/php-wasm/node/src/test/file-lock-manager-tests.ts`;
- `packages/php-wasm/web-service-worker/src/lib/utils.ts`;
- `packages/php-wasm/web/src/lib/directory-handle-mount.ts`;
- `packages/php-wasm/compile/php/phpwasm-emscripten-library-file-locking-for-node.js`;
  and
- `packages/meta/src/node-es-module-loader/loader.mts`.

Search-result-only call sites not changed by this work remain recorded in the
root and consumer-audit `rg` output. They were used only to establish whether a
public dependency existed for assignment, construction, finalization, proxy
marking, or special `bind` behavior.

## Sessions, models, and tools

The service did not expose a precise backend build identifier. All listed
sessions used the inherited Codex GPT-5-family coding model; no model override
was requested.

| Session                                                                         | Role and output                                                                                                                             | Tools                                                                                                                                                |
| ------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/root`                                                                         | Engine, codecs, protocol, async/sync sessions, tests, integration, browser matrix, artifact validation, final provenance integration        | `exec_command`, `write_stdin`, `apply_patch`, goal/plan tools, collaboration tools, official-page web search, and the browser test runner through Nx |
| `/root/provenance_skeleton` (Lagrange)                                          | Initial provenance skeleton, later replaced/finalized by root                                                                               | `exec_command`, `apply_patch`                                                                                                                        |
| `/root/rpc_docs` (Confucius)                                                    | Initial compatibility and architecture documents plus a later typecheck run; root corrected mixed-version, origin, bridge, and sync details | `exec_command`, `apply_patch`, Nx, TypeScript                                                                                                        |
| `/root/source_wording_cleanup` (Harvey)                                         | Active-source terminology cleanup and browser-matrix reruns                                                                                 | `rg`, `sed`, `git status`, `git diff --check`, Prettier, Nx/Vitest/Playwright, `apply_patch`                                                         |
| `/root/acceptance_audit`                                                        | Read-only requirements audit; no engine edits                                                                                               | `functions.exec`/`exec_command` with `rg`, `nl`, `sed`, `wc`, `shasum`; collaboration `send_message`, `list_agents`, `wait_agent`; no Git or network |
| consumer-call-site audit (canonical ID unavailable after transcript compaction) | Read-only public dependency inventory                                                                                                       | repository search/read tools                                                                                                                         |
| transport audit (canonical ID unavailable after transcript compaction)          | Read-only adapter/lifecycle inventory; see incident above                                                                                   | repository search/read tools                                                                                                                         |
| build/package audit (canonical ID unavailable after transcript compaction)      | Read-only build, license, Node, and browser-matrix inventory                                                                                | repository search/read tools and official Node page lookup                                                                                           |

No inherited-context agent implemented the RPC engine. Agent outputs were
limited to audits, a provenance draft, documentation, and terminology cleanup.

## Authorship and licensing

New implementation, protocol, test, fixture, and validation files carry
`SPDX-License-Identifier: GPL-2.0-or-later` headers (HTML uses an SPDX comment).
The affected published package artifacts copy the repository's complete
`LICENSE`, and the artifact verifier compares each copy byte-for-byte.

The root session authored the engine and tests directly in this worktree. The
documentation and wording agents authored only the bounded files described
above; root reviewed and amended them. There was no cross-repository code import
and no third-party code copied into this change.

## Validation and artifact evidence

Exact final command results, package file counts, source-map counts, license
byte count, and reviewable commit subjects are recorded in the completion report
and the terminal transcript. The repeatable package check is:

```sh
npm exec -- nx run php-wasm-universal:verify:rpc-artifacts
```

The check first removes the exact universal, client, and remote output
directories, rebuilds them through Nx without cache reuse, and parses each
`npm pack --dry-run --json` manifest. It requires ESM and CommonJS outputs where
applicable, source maps, declarations, the full GPL license, correct package
metadata, no test fixtures, and no legacy-library, Apache-license, Apache-SPDX,
or Google-copyright signatures in generated bundles, source paths, or in-scope
`sourcesContent`. Every text file and package path is still checked for the
legacy RPC library name. Versioned `wp-*` WordPress trees are copied runtime
inputs rather than generated Playground bundles, so their existing upstream
license notices are outside the Apache/Google signature check.

Two intermediate verifier runs failed on a Google copyright notice embedded in
pre-existing zstd dependency source text inside source-map `sourcesContent`:

1. the first failure came from a remote worker source map, before the remote
   worker-map exclusion was added; and
2. the next run reached the same notice in an application source map, before
   the application-map exclusion was added.

The verifier now excludes `sourcesContent` from those remote worker and
application source maps because application bundlers inline pre-existing
third-party dependency sources there. Those embedded dependency sources are not
evidence about the authorship of the new RPC implementation. The exclusions do
not waive checks of published JavaScript, declarations, package metadata,
license files, source-map source paths, or other in-scope `sourcesContent`.

Two later intermediate runs demonstrated why copied runtime inputs need a
separate scope: one stopped at a Google font license in a WordPress theme and
the next stopped at an Apache notice in WordPress core's `compose.js`. The
verifier continues to scan those copied trees for the legacy RPC name, while
the Apache/Google check applies to generated bundle and map output. A subsequent
passing manifest exposed one test-fixture declaration in the universal package;
the library build now excludes `src/test`, and the verifier rejects both
`test-fixtures` and `test/fixtures` paths.

The final fresh verifier run passed under Node 22.23.1. Its exact results were:

| Package                 | Built files | Packed files | Maps | `sourcesContent` entries |
| ----------------------- | ----------: | -----------: | ---: | -----------------------: |
| `@php-wasm/universal`   |          52 |           52 |    2 |                       74 |
| `@wp-playground/client` |          16 |           16 |    0 |                        0 |
| `@wp-playground/remote` |      22,338 |           17 |   97 |                      872 |

All three packages contained the byte-for-byte 18,092-byte repository GPL
license and declared `GPL-2.0-or-later`. Universal and client passed real ESM
and CommonJS imports from temporary packed-package copies. No test-fixture path
or forbidden signature was found in its defined scope.

The final validation matrix also recorded:

- all 224 universal tests passed on Node 20.20.2, 22.23.1, 24.15.0, and 26.5.1;
- all 24 browser lifecycle tests passed: eight each in Chromium, Firefox, and
  WebKit;
- client, remote, and web source suites passed 22, 38, and 60 tests;
- FileLockManager passed 242 tests in each Asyncify and JSPI run, with 132
  platform/configuration skips in each;
- all nine affected projects passed TypeScript checking;
- all nine affected projects passed lint with zero warnings; and
- the terminal transcript records non-failing Nx/Vitest deprecation,
  `NO_COLOR`/`FORCE_COLOR`, listener-count, TLS-test, and build warnings.

An attempted generic `php-wasm-node:test` command failed because that project
has named test-group targets rather than a `test` target. The two relevant
named FileLockManager targets were then run successfully as reported above.

## Attestation boundaries

Engineering review can conclude whether the implementation meets its tests and
documented compatibility decisions. Whether the process or output is legally
clean, non-infringing, or otherwise cleared is a question for qualified legal
counsel. In particular, counsel should review the failed initial sanitization
precondition, the user's direction to continue in the current worktree, the
transport-audit search incident, and the mandatory repository skill consultation.
