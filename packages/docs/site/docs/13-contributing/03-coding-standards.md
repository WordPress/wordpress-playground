---
sidebar_position: 1
title: Coding standards
---

# Coding standards

## Error messages

A good error message tells the reader exactly what to do next. This matters especially for errors thrown by Playground public APIs. Any ambiguity in those prompts the developers to open issues in the repo. However, the error message could provide the reader will all the answers.

Consider a network error – can we infer what type of error was that and provide a dedicated message outlining the next steps

-   If it's a network error – say your internet connection twitched and reloading the page should fix the issue.
-   If it's 404 – say file couldn't be found.
-   If it's 403 – say it's probably a private resource.
-   If it's a CORS error, provide a paragraph or two of text to explain it's a browser security thing, provide a link that explains what's CORS, say they need to move their file somewhere else, e.g. GitHub / raw.githubusercontent.com, link out to a resource explaining setting up CORS headers on their existing servers.

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
