---
title: Use WordPress Playground with AI assistants through MCP
slug: /guides/ai-assistants-mcp
description: Learn when to use the WordPress Playground MCP server, how it differs from the Playground CLI, and how to run browser-based WordPress demos with an AI assistant.
---

# Use WordPress Playground with AI assistants through MCP

The WordPress Playground MCP server lets an AI assistant connect to a real Playground site running in your browser. After the connection is open, you can ask the assistant to navigate WordPress, inspect pages, reproduce issues, and explain what it finds.

Use this guide if you want to work with Playground through natural language instead of terminal commands. For the technical announcement, architecture, and setup commands, see [Connect AI coding agents to WordPress Playground with MCP](https://make.wordpress.org/playground/2026/03/17/connect-ai-coding-agents-to-wordpress-playground-with-mcp/).

MCP is most useful when the site itself matters: a saved Playground, a persistent browser-backed site, a My WordPress-style site, or a demo where you want the assistant to act like a remote control for the browser. If you are working from a terminal-based coding agent and you mainly need local automation, the Playground CLI is usually simpler and less ambiguous.

## What MCP adds to Playground

MCP, or Model Context Protocol, gives your AI assistant control over the Playground site that is open in your browser. Instead of only describing a task, the assistant can act on the site:

- Open the exact Playground URL needed to connect to the MCP server
- List your available Playground sites
- Open, rename, or save a Playground site
- Switch between browser-managed Playground sites
- Navigate to WordPress admin and front-end URLs
- Follow redirects and report the final URL
- Make authenticated WordPress REST API requests
- Read and write files inside the Playground filesystem
- Run PHP inside the Playground site
- Request pages and inspect the response

This is especially useful when the task depends on the browser state: logged-in admin screens, settings pages, rest API requests, and redirects.

## Good use cases for MCP

Use MCP when you want an assistant to work with a visible, browser-managed WordPress site:

- Guide you through a settings screen: "Show me how to configure this WooCommerce option."
- Create a browser-based demo: "Build a simple recipe page and show me the result."
- Work with a persistent site: "Use my saved Playground site" or "Use the My WordPress site connected to my subscription."
- Reproduce a bug: "Follow these steps and summarize the error."
- Test a redirect or URL: "Open this page and tell me where the browser ends up."
- Inspect a running site: "Find the admin screen that matches this plugin feature."

MCP is less useful when the job is mostly local automation, such as running the same Blueprint repeatedly, mounting a plugin from your filesystem, or testing a version matrix. Use the Playground CLI for those workflows or [write tests using runCli](https://wordpress.github.io/wordpress-playground/guides/e2e-testing-with-playwright#first-test-file).

## Before you start

You need:

- An AI assistant or coding agent with the WordPress Playground MCP server configured
- A browser tab open at [playground.wordpress.net](https://playground.wordpress.net/)
- A Playground site you can safely test with

If your assistant is not configured yet, use the setup instructions in the [MCP announcement post](https://make.wordpress.org/playground/2026/03/17/connect-ai-coding-agents-to-wordpress-playground-with-mcp/). The setup is for the AI assistant environment. Once it is configured, everyday use can happen from the assistant conversation and browser without manually running Playground CLI commands.

<div class="callout callout-tip">

**Save important demos first**

If you are preparing a demo, ask your assistant to save the current Playground site to browser storage before making many changes. Saved Playgrounds can be reopened from the Playground Launch Panel.

</div>

<div class="callout callout-warning">

**Confirm which site the assistant is using**

You can have multiple Playground sites and multiple connected browser tabs. You can also connect more than one server or browser automation tool to the same assistant. That flexibility is useful, but it can get confusing. Before making changes, ask the assistant to list the connected sites and confirm the active site name.

</div>

## Connect an AI assistant to the Playground MCP

1. Open your AI assistant.
2. Ask it to connect to WordPress Playground:

    ```text
    Open WordPress Playground and connect it to the MCP server.
    ```

3. The assistant should provide or open a Playground URL that includes an `mcp-port` parameter.
4. Open that URL in your browser if the assistant does not open it automatically.
5. Ask the assistant to list the available Playground sites:

    ```text
    List my available Playground sites and tell me which one is active.
    ```

6. Choose the Playground site you want to use:

    ```text
    Use my saved WooCommerce demo site and open the WordPress admin dashboard.
    ```

If the assistant says no browser tab is connected, open the MCP Playground URL it provides and try again.

## MCP vs CLI

WordPress Playground has two complementary products: the Playground website and the Playground CLI. The website is the browser experience at [playground.wordpress.net](https://playground.wordpress.net/). The CLI is the local environment for development, scripting, and CI workflows.

The choice depends on what you want the AI assistant to control.

With MCP, the assistant can make authenticated WordPress REST API requests to the connected site without manually configuring authentication. It can also use the `playground_navigate` tool to change the page displayed in the browser and report the final URL after redirects.

From the CLI, comparable HTTP requests usually require a tool such as `curl` and are unauthenticated unless you configure authentication yourself. The CLI also does not control the page displayed in a user's browser.
