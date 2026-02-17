---
title: Using the WordPress Playground Agent Skill
slug: /guides/agent-skill-wp-playground
description: Install and use the wp-playground agent skill to automate WordPress Playground workflows with Claude Code.
---

# Using the WordPress Playground Agent Skill

Want an AI assistant that already knows how to spin up WordPress instances, run Blueprints, and debug plugins? The **wp-playground** agent skill teaches Claude Code the WordPress Playground CLI and browser workflows. You describe what you need in plain language. The agent handles the commands.

Claude Code reads the skill reference — a document with CLI flags, procedures, and troubleshooting steps — before responding. This context ensures it runs Playground commands correctly.

## Prerequisites

Before installing the skill, confirm you have:

| Requirement                                | Minimum version       | Check command   |
| ------------------------------------------ | --------------------- | --------------- |
| Node.js                                    | 20.18                 | `node -v`       |
| npm / npx                                  | Included with Node.js | `npx --version` |
| Claude Code / Codex / Copilot / Gemini CLI | Latest                |                 |

:::caution Node.js version matters
The Playground CLI requires Node.js 20.18 or later. Earlier versions will fail silently or produce confusing errors. Run `node -v` before proceeding.
:::

## Installation

Install the skill using the `npx skills` CLI:

```bash
npx skills add anthropics/skills --skill wp-playground -a claude-code
```

:::info Repository path may vary
The command above assumes the skill is published in the `anthropics/skills` repository. If the skill lives in `WordPress/playground-content`, adjust the path accordingly:

```bash
npx skills add WordPress/playground-content --skill wp-playground -a claude-code
```

:::

Verify the installation succeeded by checking that the skill file exists:

```bash
ls .claude/skills/wp-playground/SKILL.MD
```

The command prints the file path. Claude Code loads this skill automatically when your request matches Playground-related patterns.

## Use the skill in the terminal

With the skill installed, describe your WordPress environment to Claude Code. The agent builds the Blueprint, runs the CLI commands, and starts the server.

Open Claude Code in your terminal and type your request:

```
> Run a WordPress instance with my plugin mounted
```

Claude Code reads the skill reference, detects your project layout, and runs `server --auto-mount`. The instance starts at `http://localhost:9400`.

### Generating content on the fly

Need sample data for testing or a demo? Describe the content structure you want:

```
> Run a WordPress with 10 published posts
```

Claude Code creates a Blueprint with a `runPHP` step that generates the posts using `wp_insert_post()`.

More examples:

```
> Run a WordPress with 3 users where each user has 3 posts
```

```
> Start a WordPress instance with 5 pages and a custom menu linking to all of them
```

```
> Create a WordPress site with 20 posts across 4 categories
```

Each prompt produces a complete Blueprint that runs locally, handling user creation, role assignment, post generation, and taxonomy setup through `runPHP` steps.

### Installing plugins and themes

Describe the stack you need:

```
> Run a WordPress with WooCommerce and Storefront theme
```

```
> Start a Playground with Contact Form 7 and Jetpack installed
```

```
> Create a WordPress site with the Twenty Twenty-Four theme and starter content
```

Claude Code generates `installPlugin` and `installTheme` Blueprint steps with the download URLs from the WordPress.org repository.

### Version compatibility testing

Does your plugin work on older PHP versions? Ask directly:

```
> Test my plugin on WordPress 6.3 with PHP 7.4
```

```
> Run my theme on the latest WordPress nightly with PHP 8.3
```

Claude Code adds `--wp` and `--php` flags to match your request. Common combinations:

| Scenario          | What to ask                                                 |
| ----------------- | ----------------------------------------------------------- |
| Latest stable     | "Run a WordPress instance" (defaults to latest WP, PHP 8.3) |
| Minimum supported | "Test my plugin on WordPress 6.3 with PHP 7.4"              |
| Upcoming release  | "Run the WordPress nightly build"                           |
| Legacy PHP        | "Start WordPress with PHP 7.4"                              |

### Debugging with Xdebug

Start a debugging session with a single prompt:

```
> Run my plugin with Xdebug enabled
```

Claude Code starts the server with the `--xdebug` flag and shows the host, port, and IDE key. Connect VS Code or PhpStorm to that address and set your breakpoints.

:::caution Path mappings
Your IDE needs to map the Playground virtual filesystem paths to your local project paths. Check the CLI output for the exact VFS mount points and configure your debugger's path mappings accordingly.
:::

### Complex scenarios

Combine multiple requirements in a single prompt:

```
> Create a WordPress site with WooCommerce, 3 product categories,
  10 sample products, and 2 customer accounts — running on PHP 8.2
```

```
> Start a multisite WordPress with 2 subsites, each with a different theme
```

```
> Run a WordPress instance with my plugin mounted, debug mode enabled,
  and 5 test posts that include featured images
```

Claude Code breaks these into the right sequence of Blueprint steps and CLI flags. Each request produces a fully configured, running instance.

## Browser-only workflows

Some workflows skip the CLI entirely. Launch Playground directly in the browser with a Blueprint URL:

**Using a URL parameter:**

```
https://playground.wordpress.net/?blueprint-url=https://example.com/my-blueprint.json
```

**Using a URL fragment (base64-encoded Blueprint):**

```
https://playground.wordpress.net/#eyJzdGVwcyI6W119
```

The [Blueprint Editor](https://playground.wordpress.net/) at playground.wordpress.net provides schema-aware editing with autocomplete. Paste your JSON, iterate, and copy a shareable link when you're ready.

## How the skill works

The wp-playground skill is a set of Markdown files that Claude Code loads into its context when your request matches Playground-related patterns. The skill includes:

- **SKILL.MD** — The main procedure: guardrails, step-by-step workflows, verification checks, and failure modes.
- **references/cli-commands.md** — A CLI cheatsheet with every flag and default value.
- **references/blueprint.md** — Blueprint structure, common steps, and authoring tips.
- **references/debugging.md** — Xdebug setup, path mapping, and troubleshooting steps.

Claude Code reads these files before generating commands, so it uses correct flags, respects version defaults (PHP 8.3 since July 2025), and warns you about common pitfalls.

## Troubleshooting

| Problem                          | Cause                                  | Fix                                                      |
| -------------------------------- | -------------------------------------- | -------------------------------------------------------- |
| CLI exits with a Node.js error   | Node.js version below 20.18            | Upgrade Node.js to 20.18+                                |
| Mounted plugin not visible       | Relative path or wrong directory       | Use absolute paths in `--mount`; add `--verbosity=debug` |
| Blueprint can't read local files | Security sandbox blocks adjacent reads | Add `--blueprint-may-read-adjacent-files`                |
| Port 9400 already in use         | Another process occupies the port      | Use `--port=<free-port>`                                 |
| Slow or frozen UI                | Multi-worker instability               | Disable `--experimental-multi-worker`                    |
| Breakpoints not hit              | IDE path mappings don't match VFS      | Check CLI output for mount paths; update IDE config      |
| Skill not loading                | SKILL.MD missing or misplaced          | Verify `.claude/skills/wp-playground/SKILL.MD` exists    |

## Next steps

- [Export to Production](/guides/export-to-production) — Deploy your Playground work to real hosting
- [WordPress Playground for Plugin Developers](/guides/for-plugin-developers) — Showcase and develop plugins with Playground
- [WordPress Playground for Theme Developers](/guides/for-theme-developers) — Build and demo themes using Playground
- [Upstream Playground documentation](https://wordpress.github.io/wordpress-playground/) — Full reference for APIs, architecture, and advanced configuration
