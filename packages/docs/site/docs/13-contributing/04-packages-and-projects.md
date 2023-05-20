---
sidebar_position: 1
title: NX – Packages and Projects
---

# NX: Packages and Projects

WordPress Playground uses a tool called [nx](https://nx.dev/) to manage the repository.

Why?

The dependencies between Playground packages [are too complex](https://github.com/WordPress/wordpress-playground/pull/151) to manage with a bundler like webpack. Nx is the right tool for the job. Just look at this dependency graph:

![Dependency graph](@site/static/img/dependencies.png)

## Getting started with nx

Start by reviewing the [Nx documentation](https://nx.dev/getting-started/intro). It's a good idea to install the Nx VS Code extension – it makes many common tasks easier.

## Projects

Nx uses the term "project" which is different from an npm "package". A project can be an npm package, a VS Code plugin, a web app that isn't published on npm, or even a directory with nothing more than a Dockerfile and a project.json file.

## Tasks

Every project needs a set of tasks so it can be built, tested, type-checked and so on. Tasks are stored in `project.json` files. Learn more about [tasks in nx documentation](https://nx.dev/core-features/run-tasks).

## Add a new project / package

Nx uses generators to create new packages. There are generators for Node.js libraries, web apps, angular apps, and more.

For example, here's how you can create a new project containing a Node.js app:

```bash
nx g @nrwl/node:application
```

Nx will then ask you many questions about the project. For example, it will ask you to choose a build tool. You can answer them in the terminal, or you can use the VS Code extension to answer them in a GUI – the latter is much easier.

### Which tools to choose?

In the Playground repository, we use the following tools:

-   TypeScript for type-checking
-   Vite or esbuild for building both web apps and node.js apps
-   Vitest for testing

### After you create a new project

Follow this checklist:

-   Add a new `workspaces` in the top-level `package.json` file if needed. Otherwise TypeScript won't work correctly and Lerna won't pick up your package for publishing.
-   Add a `typecheck` task to the `project.json` file in the new project. You can copy it from another project in this repo.
-   Run `nx typecheck <project name>` to make sure TypeScript is set up correctly.

## Move a project to a different directory

Use the [@nx/workspace:move](https://nx.dev/packages/workspace/generators/move) generator:

```bash
nx g @nx/workspace:move --projectName=<project name> --destination=<new directory>
```

Or use the VS Code extension – again, that's much easier than remembering all the commands.

## Rename a project

Same as above.

## Delete a project

Use the [@nx/workspace:remove](https://nx.dev/packages/workspace/generators/remove) generator:

```bash
nx g @nx/workspace:remove --projectName=<project name>
```

## Publish a project on npm

See the [publishing](./05-publishing.md) guide.
