# Contributing to WordPress Playground

Thanks for wanting to contribute to [WordPress Playground](https://github.com/WordPress/wordpress-playground) — the project that runs WordPress and PHP entirely in the browser via WebAssembly. It's a broad open-source project: code, documentation, translations, design, and issue triage are all welcome, and no WebAssembly expertise is required to get started.

This guide brings together the project's own contributing docs, its `AGENTS.md`, and its coding-standards page into one place. For anything this file simplifies, the [full contributing docs](https://wordpress.github.io/wordpress-playground/contributing) are the source of truth.

## Contents

- [Code of Conduct](#code-of-conduct)
- [Ways to Contribute](#ways-to-contribute)
- [Development Setup](#development-setup)
- [Project Structure](#project-structure)
- [Coding Principles](#coding-principles)
- [Testing](#testing)
- [Submitting a Pull Request](#submitting-a-pull-request)
- [Documentation and Translation Contributions](#documentation-and-translation-contributions)
- [WordCamp Contributor Day](#wordcamp-contributor-day)
- [Contributing with an AI Coding Agent](#contributing-with-an-ai-coding-agent)
- [Getting Help](#getting-help)

## Code of Conduct

All contributors are expected to follow the WordPress project's [Community Code of Conduct](https://make.wordpress.org/handbook/community-code-of-conduct/). Please read it before opening issues, discussions, or pull requests.

## Ways to Contribute

You don't need to write code to help:

- **Code** — fix bugs, build features, or review open PRs. See [Development Setup](#development-setup).
- **Documentation** — improve or add pages to the docs site. See [Documentation and Translation Contributions](#documentation-and-translation-contributions).
- **Translations** — help translate the documentation into other languages.
- **Triage** — work through [open issues](https://github.com/WordPress/wordpress-playground/issues?q=is%3Aopen+is%3Aissue), try to reproduce bugs, and leave a comment with what you find (a fix, a reliable repro, or just useful context).
- **Bug reports** — [open a new issue](https://github.com/WordPress/wordpress-playground/issues/new) with clear reproduction steps.
- **Ideas and design** — start a [GitHub Discussion](https://github.com/WordPress/wordpress-playground/discussions).

If you're new here, look for issues labeled [`Good First Issue`](https://github.com/WordPress/wordpress-playground/issues?q=is%3Aopen+is%3Aissue+label%3A%22Good+First+Issue%22).

Worth skimming before you dive in:

- [Architecture overview](https://wordpress.github.io/wordpress-playground/developers/architecture)
- [Vision and philosophy](https://github.com/WordPress/wordpress-playground/issues/472)
- [Roadmap](https://github.com/WordPress/wordpress-playground/issues/525)

There's also a sister repository, [WordPress/playground-tools](https://github.com/WordPress/playground-tools), for tools built on top of Playground (a VS Code extension, a Gutenberg interactive code block, and more). Almost everything below applies there too.

## Development Setup

### Requirements

Node.js — the required version is pinned in `.nvmrc`. If you use `nvm`, run `nvm use` before anything else.

### Fork, clone, and install

[Fork the repository](https://github.com/WordPress/wordpress-playground/fork) on GitHub, then:

```bash
git clone -b trunk --single-branch --depth 1 --recurse-submodules \
  git@github.com:YOUR-GITHUB-USERNAME/wordpress-playground.git
cd wordpress-playground
nvm use
npm install
```

`trunk` is the default branch and the base for all work. The `--single-branch --depth 1` flags skip years of history, which otherwise makes cloning painfully slow. (For an install that matches `package-lock.json` exactly, use `npm ci` instead of `npm install`.)

### Run it locally

```bash
npm run dev
```

This starts the dev server and opens a client-side WordPress site at `http://127.0.0.1:5400/`. Edits to `.ts` files hot-reload automatically; changes to a `Dockerfile` need a full rebuild.

Working on the CLI specifically? `npx nx dev playground-cli server` runs it straight from source.

### Common commands

| Command | What it does |
|---|---|
| `npm run dev` | Start the website dev server |
| `npm run dev:docs` | Serve the documentation site locally |
| `npm run build` | Build all packages |
| `npm run build:website` | Build just the main website |
| `npx nx build <package-name>` | Build one specific package |
| `npm test` | Run all tests |
| `npx nx test <package-name>` | Run tests for one package |
| `npx nx e2e playground-website` | Run Cypress end-to-end tests |
| `npx nx run playground-website:e2e:playwright:ci` | Run Playwright end-to-end tests |
| `npm run lint` | Lint all packages |
| `npm run typecheck` | Type-check all packages |
| `npm run format` | Format code with Prettier |
| `npm run format:uncommitted` | Format only the files you've changed |

PHP itself is already compiled and checked into the repo — most contributors will never need the `recompile:php:*` scripts; see `AGENTS.md` if you're the exception.

### Debugging

- **VS Code + Chrome:** open the project folder, then Run → Start Debugging (`F5`).
- **PHP errors:** logged to the browser console after every PHP request.

### Troubleshooting

**Linux: `ENOSPC: System limit for number of file watchers reached`.** The repo has more files than the default watcher limit allows. Check your limit, then raise it:

```bash
cat /proc/sys/fs/inotify/max_user_watches
# if 65536 or lower:
sudo sysctl fs.inotify.max_user_watches=131070
sudo sysctl -p
```

**Testing WordPress Multisite locally.** Multisite has [restrictions when run locally](https://developer.wordpress.org/advanced-administration/multisite/prepare-network/#restrictions) — you'll need either a non-default port (`npx @wp-playground/cli@latest start --port=80`) or a local HTTPS test domain (a tool like [Laravel Valet](https://laravel.com/docs/11.x/valet) makes this easy).

## Project Structure

Playground is an [Nx](https://nx.dev/) monorepo using npm workspaces, organized in layers:

- **`packages/php-wasm/*`** (`@php-wasm/*`) — the Emscripten-compiled PHP runtime, built separately for the browser and for Node.js.
- **`packages/playground/*`** (`@wp-playground/*`) — WordPress-specific tooling: the client/remote iframe bridge, Blueprints, storage and sync, the CLI, and the website itself.
- **`packages/docs/*`** — the Docusaurus documentation site.
- **`packages/meta/*`, `packages/nx-extensions/*`** — internal tooling: a shared ESLint plugin, changelog automation, and custom Nx build executors.

Most tasks can also be run per-package with `npx nx <target> <package-name>` instead of the root `npm run` scripts. See the [architecture overview](https://wordpress.github.io/wordpress-playground/developers/architecture) for how the pieces fit together.

**Blueprints** are declarative JSON files describing a sequence of setup steps (`installPlugin`, `login`, `runPHP`, and so on) and are the main way anything configures a Playground instance. If you're adding one, see [Coding Principles](#coding-principles) below.

## Coding Principles

- **Formatting and linting are automatic.** Run `npm run format` rather than hand-formatting, and let ESLint/Prettier handle the rest.
- **Keep the public API narrow.** A public function, class, or constant is easy to add and hard to remove once something else depends on it — don't expose more than necessary.
- **Error messages should point to the next step**, not just describe the failure — for example, distinguishing a transient network error from a 404 from a CORS issue, and suggesting what to do about each.
- **Module boundaries are enforced by lint rules** — for example, PHP-runtime-independent packages can't depend on packages that ship PHP binaries. A boundary error usually means a dependency belongs in a different layer, not that the rule is wrong.
- **Type imports must be explicit:** `import type { Foo } from 'bar'` (required for Node's type-stripping support).
- **No TypeScript parameter properties** in constructors, for the same type-stripping reason.
- Comments are capped at **100 characters per line** (ESLint-enforced), and `console.log` is disallowed outside tests and `bin/` scripts.
- **Path handling:** use the POSIX-safe helpers in `@php-wasm/util` (`joinPaths`, `dirname`, `normalizePath`, etc.) instead of Node's `path` module or hand-written string/regex logic, to keep paths consistent across platforms.
- **Ordering conventions:** callers are defined before the functions they call; within a class, public members come before protected, which come before private.

### Adding a Blueprint step

- Try extending or refactoring an existing step before adding a new one, and don't duplicate a capability another step already provides.
- Assume it'll run more than once and in a specific order relative to other steps, and add tests that confirm both.
- Keep required arguments to a minimum, and prefer plain ones (`slug`, not `path`).
- Define a TypeScript type for the step's arguments — Playground's JSON schema is generated from it — and include a doc-string usage example, which gets pulled into the docs automatically.

## Testing

- Test files sit next to the code they cover, named `*.spec.ts`.
- Most packages use Vitest; a handful still use Jest.
- End-to-end coverage runs on Playwright and Cypress against the website.
- Fix a failing test rather than skipping it.
- Not every change needs a new test, and tests aren't a box to check for completeness. Before adding one, make sure you can articulate three things: exactly what stable behavior it protects, a realistic way that behavior could accidentally break, and which separate piece of code would be responsible if that happened. If you can't answer all three, leave the test out. Skip testing static markup, copy, CSS values, or anything that would only fail because someone deliberately changed the design.

## Submitting a Pull Request

1. Branch off `trunk`.
2. Make your change, following the conventions above.
3. Run the relevant tests, `npm run lint`, and `npm run typecheck` locally.
4. Push to your fork and open a PR against `trunk`.
5. If the change breaks backward compatibility, say so explicitly in the PR description. Breaking changes are sometimes fine during active development, but reviewers need to see them called out — Telex, Studio, and wp-env all build on this project and need to know.

**On licensing:** WordPress Playground is licensed under **GPLv2 (or later)**. You keep copyright over your own contribution, but opening a PR means agreeing to license it under the same GPL terms as the rest of the project. If that raises questions, the WordPress.org [GPL primer](https://make.wordpress.org/community/handbook/wordcamp-organizer/planning-details/gpl-primer/) is a friendlier read than the license text, and the [`#playground` Slack channel](https://make.wordpress.org/chat) is a good place to ask.

## Documentation and Translation Contributions

Docs live in `packages/docs/site/docs` (English) and `packages/docs/site/i18n` (translations), built with Docusaurus. The easiest path for a small fix is directly through the GitHub UI: open the file, click the pencil icon, edit, and GitHub walks you through forking and opening a PR. For anything bigger, edit locally like any other change and preview it with `npm run dev:docs`.

More detail: [Documentation Contributions](https://wordpress.github.io/wordpress-playground/contributing/documentation) and [Contributions to Translations](https://wordpress.github.io/wordpress-playground/contributing/translations).

## WordCamp Contributor Day

If you're contributing as part of a WordCamp Contributor Day, there's a [dedicated guide](https://wordpress.github.io/wordpress-playground/contributing/contributor-day) with setup shortcuts and good starting tasks — documentation, Blueprints, and manual testing are all approachable if you're new to the codebase. Sustained contributors can also work toward a [Playground Contributor Badge](https://wordpress.github.io/wordpress-playground/contributing/contributor-badge) on their WordPress.org profile.

## Contributing with an AI Coding Agent

This repository ships its own [`AGENTS.md`](https://github.com/WordPress/wordpress-playground/blob/trunk/AGENTS.md) with more detailed, agent-oriented context — build commands, architecture notes, and conventions in more depth than this file covers. If you're working with Claude Code, Cursor, Gemini CLI, GitHub Copilot, or similar, point it at that file too.

## Getting Help

- [GitHub Discussions](https://github.com/WordPress/wordpress-playground/discussions) for ideas, questions, and proposals.
- `#playground` on [Making WordPress Slack](https://make.wordpress.org/chat).
- The [full contributing docs](https://wordpress.github.io/wordpress-playground/contributing) and the community-maintained [Awesome WordPress Playground](https://github.com/akirk/awesome-wordpress-playground) list for more resources.

Thank you for contributing! 🎉
