---
title: How v2 Blueprints work
slug: /blueprints/v2/blueprints-101/how-it-works
description: Learn how Playground turns desired site state into five setup phases and which ordering rules matter.
---

# How v2 Blueprints work

**Lesson 2 of 3 · Browser only**

In lesson 1, you changed a site without writing an installation script. That is
the central v2 idea: describe the result you need, and let Playground work out
the setup commands.

## Follow your Blueprint through setup

Playground checks the Blueprint, resolves the requested WordPress and PHP
runtimes, and turns its fields into an ordered plan. You can understand that
plan as five groups:

| Phase | What Playground does                   | Fields from this course or larger Blueprints                  |
| ----- | -------------------------------------- | ------------------------------------------------------------- |
| 1     | Prepares the starting site and runtime | `wordpressVersion`, `phpVersion`, content and user baselines  |
| 2     | Applies configuration                  | `constants`, `siteOptions`                                    |
| 3     | Installs site assets                   | Must-use plugins, themes, plugins, fonts, media, and language |
| 4     | Creates WordPress data                 | Roles, users, post types, and `content`                       |
| 5     | Runs final setup steps                 | `additionalStepsAfterExecution`                               |

The course Blueprint therefore selects PHP and WordPress, changes the site
options, installs and activates the theme and plugin, and then creates the
Welcome post. Its login runs before these phases, and Playground opens the
WordPress dashboard after them.

### Quick check

In the course JSON, `activeTheme` and `plugins` appear before `siteOptions`.
Which one runs first? `siteOptions` does, because the fixed lifecycle—not JSON
property order—controls the phases. The next rule explains why.

## Remember three ordering rules

### 1. Moving top-level fields does not change setup order

JSON property order is for readability. Moving `plugins` above `siteOptions`
does not make plugin installation happen first; Playground still follows its
fixed lifecycle.

### 2. Items in an array keep their order

If `plugins` contains several entries, Playground installs them from first to
last. The same rule applies to other arrays, including `content` and
final setup steps.

### 3. Final setup steps always run last

Use a top-level v2 field whenever one describes the result you need. Use
`additionalStepsAfterExecution` only when the task needs an explicit command or
must happen after Playground applies all top-level fields. Final setup steps
cannot change the order of the earlier phases.

See the [final setup steps reference](/blueprints/v2/reference/additional-steps)
for supported commands and their v2 shapes.

## If setup fails partway through

A failure stops the remaining work. Playground does not undo changes it has
already made. That is easy to recover from on the disposable browser site used
in this course, but it matters when you
[apply a Blueprint to an existing site](/blueprints/v2/apply-to-existing-site).

## When you move beyond the course

- **Existing sites:** the host reuses mounted or saved WordPress files. Rules
  for clearing a new site's default content and users are skipped, and an
  object-shaped WordPress version constraint can reject an incompatible site.
- **PHP without WordPress:** set `"wordpressVersion": "none"` and limit the
  Blueprint to PHP and filesystem work. Some invalid WordPress-dependent
  combinations are only rejected during execution.
- **Files and bundles:** `https://...` downloads a remote file,
  `./assets/file.zip` and `/assets/file.zip` read beside the Blueprint, and
  `site:wp-content/...` reads from the target WordPress site when that phase
  runs. Learn the full model in
  [files, data sources, and bundles](/blueprints/v2/resources).

<details>

<summary>Reference: exact field execution order</summary>

Playground considers fields in this order. Fields that require no work are
omitted from the final plan:

1. `contentBaseline`
2. `usersBaseline`
3. `constants`
4. `siteOptions`
5. `muPlugins`
6. `themes`
7. `activeTheme`
8. `plugins`
9. `fonts`
10. `media`
11. `siteLanguage`
12. `roles`
13. `users`
14. `postTypes`
15. `content`
16. `additionalStepsAfterExecution`

</details>

## Next lesson

Continue to
[run and share this Blueprint](/blueprints/v2/blueprints-101/run) with the
Playground website, CLI, or JavaScript client.
