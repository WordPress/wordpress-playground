---
title: Using the WordPress Playground Agent Skill
slug: /guides/agent-skill-wp-playground
description: Install and use the wp-playground agent skill to automate WordPress Playground workflows with your coding agent.
---

# Using the WordPress Playground Agent Skill {#using-wordpress-playground-agent-skill}

Want an AI assistant that already knows how to spin up WordPress instances, run Blueprints, and debug plugins? The **wp-playground** agent skill teaches coding agents the WordPress Playground CLI and browser workflows. You describe what you need in plain language. The agent handles the commands.

Your coding agent reads the skill reference — a document with CLI flags, procedures, and troubleshooting steps — before responding. This ensures Playground commands run correctly.

## Prerequisites {#prerequisites}

Before installing the skill, confirm you have:

| Requirement | Minimum version       | Check command   |
| ----------- | --------------------- | --------------- |
| Node.js     | 20.18                 | `node -v`       |
| npm / npx   | Included with Node.js | `npx --version` |

You also need a coding agent that supports agent skills: Antigravity, Claude Code, Codex, Copilot, Cursor, or Gemini CLI. Make sure your CLI or IDE runs the latest version. Output quality depends on your chosen model.

## Installation {#installation}

### 1. Install via terminal {#install-via-terminal}

Install the skill using the `npx skills` CLI:

```bash
npx skills add wordpress/agent-skills --skill wp-playground
```

### 2. Install manually {#install-manually}

```bash
# Clone agent-skills
git clone https://github.com/WordPress/agent-skills.git
cd agent-skills

# Build the distribution
node shared/scripts/skillpack-build.mjs --clean

# Install into your WordPress project
node shared/scripts/skillpack-install.mjs --dest=../your-wp-project --targets=codex,vscode,claude,cursor,antigravity,gemini
```

This copies skills into:

- `.github/skills/` for VS Code / GitHub Copilot
- `.claude/skills/` for Claude Code
- `.cursor/skills/` for Cursor
- `.agent/skills/` for Antigravity
- `.gemini/skills/` for Gemini CLI
- `.codex/skills/` for Codex

Verify installation by checking the skill directory exists for your agent:

| Agent          | Skill directory                 |
| -------------- | ------------------------------- |
| Claude Code    | `.claude/skills/wp-playground/` |
| Gemini CLI     | `.gemini/skills/wp-playground/` |
| GitHub Copilot | `.github/skills/wp-playground/` |
| Cursor         | `.cursor/skills/wp-playground/` |
| Antigravity    | `.agent/skills/wp-playground/`  |
| Codex          | `.codex/skills/wp-playground/`  |

Some agents also support listing skills directly:

```bash
# Claude Code
claude /skills

# Gemini CLI
gemini /skills list
```

## Use the skill in the terminal {#use-the-skill-in-the-terminal}

With the skill installed, describe your WordPress environment to your coding agent. The agent builds the Blueprint, runs the CLI commands, and starts the server.

Open your coding agent in the terminal and type your request:

```
> Run a WordPress instance with my plugin mounted
```

The agent reads the skill reference, detects your project layout, and runs `server --auto-mount`. The instance starts at `http://localhost:9400`.

### Generating content on the fly {#generating-content-on-the-fly}

Need sample data for testing or a demo? Describe the content structure you want:

```
> Run a WordPress with 10 published posts
```

The agent creates a Blueprint with a `runPHP` step that generates the posts using `wp_insert_post()`.

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

Each prompt produces a complete Blueprint that runs locally, handling user creation, role assignment, post generation, and taxonomy setup through Blueprint steps.

### Version compatibility testing {#version-compatibility-testing}

Does your plugin work on older PHP versions? Ask directly:

```
> Test my plugin on WordPress 6.3 with PHP 7.4
```

```
> Run my theme on the latest WordPress nightly with PHP 8.5
```

The agent adds `--wp` and `--php` flags to match your request. Common combinations:

| Scenario          | What to ask                                                 |
| ----------------- | ----------------------------------------------------------- |
| Latest stable     | "Run a WordPress instance" (defaults to latest WP, PHP 8.3) |
| Minimum supported | "Test my plugin on WordPress 6.3 with PHP 7.4"              |
| Upcoming release  | "Run the WordPress nightly build"                           |
| Legacy PHP        | "Start WordPress with PHP 7.4"                              |

### Complex scenarios {#complex-scenarios}

Combine multiple requirements in a single prompt:

```
> Create a WordPress site with WooCommerce, 3 product categories,
  10 sample products, and 2 customer accounts — running on PHP 8.2
```

```
> Run a WordPress instance with my plugin mounted, debug mode enabled,
  and 5 test posts that include featured images
```

The agent breaks these into the right sequence of Blueprint steps and CLI flags. Each request produces a fully configured, running instance.

## How the skill works {#how-the-skill-works}

The wp-playground skill is a set of Markdown files that your coding agent loads into its context when your request matches Playground-related patterns. The skill includes:

- **SKILL.MD** — The main procedure: guardrails, step-by-step workflows, verification checks, and failure modes.
- **references/cli-commands.md** — A CLI cheatsheet with every flag and default value.
- **references/blueprint.md** — Blueprint structure, common steps, and authoring tips.
- **references/debugging.md** — Xdebug setup, path mapping, and troubleshooting steps.

Your coding agent reads these files before generating commands, ensuring correct flags and warning you about common pitfalls.

## Next steps {#next-steps}

- [WordPress Playground for Plugin Developers](/guides/for-plugin-developers) — Showcase and develop plugins with Playground
- [WordPress Playground for Theme Developers](/guides/for-theme-developers) — Build and demo themes using Playground
- [Upstream Playground documentation](https://wordpress.github.io/wordpress-playground/) — Full reference for APIs, architecture, and advanced configuration
