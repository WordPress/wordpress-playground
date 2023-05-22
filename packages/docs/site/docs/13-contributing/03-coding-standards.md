---
sidebar_position: 1
title: Coding standards
---

# Coding standards

## Formatting

Formatting is handled automatically by the relevant tools and verified by CI. Relax, sit back, and let the machines do the work.

## Public API

Playground aims to keep the lowest possible API area.

Public APIs are easy to add and hard to remove. It only takes one PR to add a new API, but it may take a thousand to remove it – especially if was already consumed in other projects.

Don't expose anything that is not needed. If you don't need to expose a function, don't. If you don't need to expose a class, don't. If you don't need to expose a constant, don't.

## Blueprints

Blueprints are the main way to interact with the WordPress Playground. They are JSON files that describe a set of steps to perform. The Playground will execute these steps in order.

### Batteries

Blueprint steps are meant to be small and focused – like Unix tools. They should do one thing and do it well.

When it comes to building new steps:

-   It is best not to build it at all
-   If you must build it, try refactoring an existing step first
-   If you cannot do that, make sure the new step opens up an entirely new feature that doesn't do anything that can be achieved with existing steps

### Composability

Blueprint Steps are meant to be composable. This means that you can run them many times over and still get sensible results.

**Don't:**

-   Assume your step won't be run more than once.
-   Assume your step will be run in a specific order.
-   Modify PHP files to define constants.

**Do:**

-   Add unit tests that run your step multiple times.
-   Store constants in virtual JSON files.

### Ease of use

Blueprints are meant to be easy to use and require the minimal amount of effort on the consumer side.

**Don't:**

-   Require arguments that can be made optional.
-   Require complex arguments when simple ones will do. For example, don't require a plugin path when plugin slug will do.

**Do:**

-   Provide a TypeScript type for the Blueprint. JSON Schema is generated from it.
-   Provide a function to handle a blueprint step. Accept argument of the type you defined in the previous step.
-   Provide usage example in the doc string. It is automatically reflected in the docs.
