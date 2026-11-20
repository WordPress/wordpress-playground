---
title: Blueprints v2
slug: /blueprints/v2
description: Describe a WordPress site with Blueprint v2 and run it in the Playground website, CLI, or JavaScript client.
---

# Blueprints v2: describe the site you need

A v2 Blueprint is a JSON file that describes the Playground site you want: its
WordPress and PHP versions, theme, plugins, settings, users, and content.
Playground checks the file, works out the setup order, and sets up the site.

Use v2 for new Blueprint work.

## Start with a working site

[Run the course Blueprint in Playground](https://playground.wordpress.net/?blueprint-url=https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/src/examples/blueprints-v2/quickstart.json).
It opens the WordPress dashboard with a theme, a plugin, a custom site title,
and a published post. Nothing is installed on your computer.

Ready to make it your own? Take the
[Blueprints 101 crash course](/blueprints/v2/blueprints-101).

## Choose your path

| If you want to…                          | Start here                                                         |
| ---------------------------------------- | ------------------------------------------------------------------ |
| Learn v2 from the beginning              | [Blueprints 101](/blueprints/v2/blueprints-101)                    |
| Add a plugin Preview on WordPress.org    | [Plugin Preview tutorial](/blueprints/v2/tutorials/plugin-preview) |
| Build an interactive theme demo          | [Theme demo tutorial](/blueprints/v2/tutorials/theme-demo)         |
| Share a bug or pull-request reproduction | [Reproduction tutorial](/blueprints/v2/tutorials/bug-reproduction) |
| Update an existing v1 Blueprint          | [Migration guide](/blueprints/v2/migrate-from-v1)                  |
| Look up an exact field                   | [Schema reference](/blueprints/v2/reference/schema)                |

## Why v2 is different

V2 describes the result instead of asking you to write every setup command.
For example, declare a plugin in `plugins`, a theme in `activeTheme`, or posts
in `content`; Playground puts that work in the correct order.

Every v2 Blueprint includes `"version": 2`. Use the number `2`, not the string
`"2"`. The same public `$schema` URL supports editor completion and validation
for both Blueprint versions.

Playground-only behavior, such as automatic login and the page shown after
setup, belongs under `applicationOptions`. If a task cannot be described with
the top-level v2 fields, `additionalStepsAfterExecution` provides final setup
steps that always run last.

## Where v2 runs {#current-support}

Current Playground builds detect `version: 2` without an experimental flag on
these surfaces:

| Surface                                 | V2 support                  | Notes                                                    |
| --------------------------------------- | --------------------------- | -------------------------------------------------------- |
| Playground website and Blueprint editor | Supported                   | Inline Blueprints, remote JSON, and ZIP bundles          |
| `@wp-playground/cli`                    | Supported                   | New sites, existing sites, headless runs, and snapshots  |
| `@wp-playground/client`                 | Supported                   | `startPlaygroundWeb()` selects v2 automatically          |
| `@wp-playground/blueprints`             | Supported                   | Version-aware validation and compilation APIs            |
| PHP without WordPress                   | Supported subset            | Select with `wordpressVersion: "none"`                   |
| WordPress Studio and PersonalWP         | Not documented as supported | Confirm support with the target before relying on parity |

These docs cover the listed Playground surfaces; they do not claim that every
WordPress host can run v2. The
[schema reference](/blueprints/v2/reference/schema) documents current fields,
defaults, and implementation limits.

## Coming from v1

V1 Blueprints have no `version` field, and current Playground runners still
accept them. The [v1 documentation](/blueprints/v1) remains available for
existing projects, but new work should use v2. No v1 removal release or
end-of-support date has been announced.

Migration is manual. The
[migration guide](/blueprints/v2/migrate-from-v1) covers renamed fields,
resource syntax, the networking-default change, lifecycle differences, and
operations with no direct equivalent.

## After the basics

Learn how v2 finds [files and bundles](/blueprints/v2/resources), then review
[security and repeatability](/blueprints/v2/security) before running a
third-party Blueprint or applying one to valuable data. If a run fails, start
with the [troubleshooting guide](/blueprints/v2/troubleshooting).
