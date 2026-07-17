---
title: 'Blueprints 101: a v2 crash course'
slug: /blueprints/v2/blueprints-101
description: Learn how to create, understand, run, and share a Blueprint v2 declaration.
---

# Blueprints 101: a v2 crash course

This short course teaches the complete Blueprint v2 workflow. You will run a
working site, understand how Playground turns a declaration into that site,
and learn how to use the same Blueprint in the website, CLI, and JavaScript.

No local WordPress installation is required. You can complete the first two
lessons in a browser; the CLI and JavaScript sections in lesson 3 are optional.

## What is a Blueprint v2 declaration?

A Blueprint v2 declaration is a JSON description of the WordPress site you
need. It can choose WordPress and PHP versions, install plugins and themes, set
options, and create users and content. The exact numeric field `"version": 2`
selects the v2 schema and runtime.

Unlike v1's ordered setup script, v2 describes site state first. Playground
validates the declaration, builds an execution plan, and applies that plan in a
fixed lifecycle. An imperative tail remains available for work that cannot be
expressed declaratively.

## Take the course

1. [Build and run your first Blueprint v2](/blueprints/v2/blueprints-101/get-started).
   Start with a working site, make one change, and learn the core fields.
2. [Understand how Blueprints v2 work](/blueprints/v2/blueprints-101/how-it-works).
   Learn the declaration lifecycle, execution order, site modes, and imperative tail.
3. [Run and share Blueprints v2](/blueprints/v2/blueprints-101/run). Use the
   website, CLI, JavaScript client, or Blueprints package.

After the course, choose a complete project:

- [Add a Preview to a WordPress.org plugin](/blueprints/v2/tutorials/plugin-preview)
- [Build an interactive WordPress theme demo](/blueprints/v2/tutorials/theme-demo)
- [Create a one-click bug or pull-request reproduction](/blueprints/v2/tutorials/bug-reproduction)

If a declaration does not validate or run as expected, use the
[phase-oriented troubleshooting guide](/blueprints/v2/troubleshooting).
