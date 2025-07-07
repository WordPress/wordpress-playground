---
slug: /contributing/coding-standards
---

# Coding principles

## Error messages

A good error message tells the user what to do next. Any ambiguity in errors thrown by Playground public APIs will prompt the developers to open issues.

Consider a network error, for example—can we infer the type of error and display a relevant message summarizing the next steps?

-   **Network error**: "Your internet connection twitched. Try to reload the page.
-   **404**: "Could not find the file".
-   **403**: "The server blocked access to the file".
-   **CORS**: clarify it's a browser security feature and add a link to a detailed explanation (on MDN or another reliable source). Suggest the user move their file somewhere else, like raw.githubusercontent.com, and link to a resource explaining how to set up CORS headers on their servers.

We handle code formatting and linting automatically. Relax, type away, and let the machines do the work.

## Public API

Playground aims to keep the narrowest possible API scope.

Public APIs are easy to add and hard to remove. It only takes one PR to introduce a new API, but it may take a thousand to remove it, especially if other projects have already consumed it.

-   Don't expose unnecessary function, class, constant, or other components.

## Blueprints

Blueprints are the primary way to interact with Playground. These JSON files describe a set of steps that Playground executes in order.

### Guidelines

Blueprint steps should be **concise and focused**. They should do one thing and do it well.

-   If you need to create a new step, try refactoring an existing one first.
-   If that's not enough, ensure the new step delivers a new capability. Don't replicate the functionality of existing steps.
-   Assume the step would be called more than once.
-   Assume it would run in a specific order.
-   Add unit tests to verify that.

Blueprints should be **intuitive and straightforward**.

-   Don't require arguments that can be optional.
-   Use plain argument. For example, `slug` instead of `path`.
-   Define constants in virtual JSON files—don't modify PHP files.
-   Define a TypeScript type for the Blueprint. That's how Playground generates its JSON schema.
-   Write a function to handle a Blueprint step. Accept the argument of the type you defined.
-   Provide a usage example in the doc string. It's automatically reflected in the docs.
