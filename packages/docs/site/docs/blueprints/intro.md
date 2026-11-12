---
title: WordPress Playground Blueprints
slug: /blueprints
id: introduction
description: Choose Blueprint v2 for new WordPress Playground setups or find the legacy v1 documentation and migration guide.
---

# WordPress Playground Blueprints

Blueprints are JSON files that tell Playground which WordPress site to create.
Use one to share a repeatable demo, plugin preview, bug reproduction, or
development site—including its WordPress and PHP versions, plugins, theme,
settings, and content.

## Start with Blueprint v2

V2 is the recommended format for new work. You describe the finished site;
Playground works out the setup order.

[Run in Playground](https://playground.wordpress.net/?blueprint-url=https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/src/examples/blueprints-v2/quickstart.json)

The starter opens the WordPress dashboard with a theme, plugin, custom site
title, and published post. Nothing is installed on your computer. In
Playground, open **Dock → Blueprint** to inspect or edit the JSON.

New to Blueprints? Take the
[Blueprints 101 crash course](/blueprints/v2/blueprints-101). It starts in the
browser and makes the command-line and JavaScript paths optional.

## Choose your task

| If you want to…                          | Start here                                                          |
| ---------------------------------------- | ------------------------------------------------------------------- |
| Learn Blueprint v2 from the beginning    | [Blueprints 101](/blueprints/v2/blueprints-101)                     |
| Add a plugin Preview on WordPress.org    | [Plugin Preview tutorial](/blueprints/v2/tutorials/plugin-preview)  |
| Build an interactive theme demo          | [Theme demo tutorial](/blueprints/v2/tutorials/theme-demo)          |
| Share a bug or pull-request reproduction | [Reproduction tutorial](/blueprints/v2/tutorials/bug-reproduction)  |
| Run in a browser, CLI, or JavaScript     | [Run and share v2 Blueprints](/blueprints/v2/blueprints-101/run)    |
| Use local files or a portable bundle     | [Use files, URLs, and bundles](/blueprints/v2/resources)            |
| Update a local existing site             | [Existing-site safety guide](/blueprints/v2/apply-to-existing-site) |

See the [Blueprint v2 overview](/blueprints/v2) for the support matrix, mental
model, and complete learning path.

## Choose a version

|                | Blueprint v2                                           | Blueprint v1                                |
| -------------- | ------------------------------------------------------ | ------------------------------------------- |
| Version marker | Exact numeric `"version": 2`                           | No `version` field                          |
| How it works   | Describes the site; Playground chooses the setup order | Runs setup steps in the order you list them |
| Recommendation | Use for new work                                       | Keep existing files while you migrate       |
| Documentation  | [V2 overview](/blueprints/v2)                          | [V1 legacy guide](/blueprints/v1)           |

Current Playground runners still accept v1. Its existing deep documentation
URLs remain available and are clearly marked as legacy. Do not add `version: 2`
to an unchanged v1 file; use the
[manual migration guide](/blueprints/v2/migrate-from-v1).

## Reference and help

- [V2 schema reference](/blueprints/v2/reference/schema)
- [V2 final setup steps](/blueprints/v2/reference/additional-steps)
- [V2 content and site data](/blueprints/v2/reference/content-and-site-data)
- [V2 troubleshooting](/blueprints/v2/troubleshooting)
- [Blueprints Gallery](https://github.com/WordPress/blueprints/blob/trunk/GALLERY.md)

The documentation only claims support on tested Playground surfaces. Check the
[V2 support matrix](/blueprints/v2#current-support) before assuming another
WordPress product or host runs the same Blueprint.
