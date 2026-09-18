---
title: Blueprint v2 reference
slug: /blueprints/v2/reference
description: Schema-backed reference for Blueprint v2 files, site data, and final setup steps.
---

# Blueprint v2 reference

Start with the question you need to answer:

| Question                                                         | Go to                                                                                      |
| ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| Which top-level field controls this part of the Blueprint?       | [Schema and top-level fields](/blueprints/v2/reference/schema)                             |
| How do I choose WordPress or PHP versions?                       | [Runtime versions](/blueprints/v2/reference/schema#choose-runtime-versions)                |
| How do I choose login, network access, or the landing page?      | [Playground experience](/blueprints/v2/reference/schema#control-the-playground-experience) |
| How do I declare plugins, themes, users, posts, media, or fonts? | [Content and site data](/blueprints/v2/reference/content-and-site-data)                    |
| How do URLs, local files, Git sources, and bundles work?         | [Use files, URLs, and bundles](/blueprints/v2/resources)                                   |
| Which command-like operations can run after site setup?          | [Final setup steps](/blueprints/v2/reference/additional-steps)                             |

Every v2 Blueprint uses the exact JSON number `"version": 2`. The reference
pages explain behavior and common choices. The public
[Blueprint JSON Schema](https://playground.wordpress.net/blueprint-schema.json)
is the machine-readable source for every accepted shape and powers editor
validation and completion.
