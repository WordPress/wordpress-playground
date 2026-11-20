---
slug: /developers/apis/javascript-api/wordpress-abilities
---

# WordPress abilities

Open **Dev Tools → Abilities** on the Playground website to search registered PHP abilities, inspect their schemas, and run them with JSON input. Abilities are grouped by namespace, which usually identifies their plugin. The list also includes abilities that are not exposed through the WordPress REST API.

Sign in to WordPress first. Calls use the current user and retain WordPress's input validation and permission checks. The [Abilities API](https://developer.wordpress.org/apis/abilities-api/) must be available in the running installation; WordPress 6.9 and later include it.

## Use the browser client

The browser's `PlaygroundClient` exposes the same operations:

```ts
const { available, user, abilities } = await client.listAbilities();
const result = await client.executeAbility('my-plugin/lookup', { id: 123 });
```

`listAbilities()` returns availability, the current user, and ability descriptors. `executeAbility()` accepts any JSON value; omit its second argument for an ability that takes no input.

Successful execution returns `{ success: true, data: ... }`. An ability failure returns `{ success: false, errors: [{ code, message, data }] }`. Transport and authentication failures reject the promise. Execution is never retried automatically: a connection or navigation failure can happen after an ability has already changed the site.

## Expose abilities to agents

The **Agents** switches expose individual abilities or an entire namespace through WebMCP in supported browsers and through a connected [Playground MCP server](/guides/ai-assistants-mcp). Manual execution remains available without either connection.

All switches start off. Selections are remembered per site until the Playground page reloads. Closing the pane keeps selected tools available; switching sites exposes only the active site's selections. These switches are independent of WebMCP tools registered directly by plugins.

Tools are named `wp_ability_<namespace>.<slug>`, replacing the WordPress namespace separator with a dot. A WebMCP call passes the ability input in an `input` property, for example `{ "input": { "id": 123 } }`. MCP calls also require `siteId`.

When several sites expose the same ability name with different descriptions, schemas, or safety hints, MCP advertises generic input without shared safety hints. Inspect the ability on the target site before calling it; WordPress still validates its input and permissions.

## Refresh after changes

Use **Refresh** after changing plugin code. The pane also refreshes after WordPress navigation and reloads. Client integrations can observe document navigations, including same-URL reloads, with `client.onNavigation(callback, { includeReloads: true })`. The default reports URL changes only.
