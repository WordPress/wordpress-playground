---
title: Usa WordPress Playground con asistentes de IA mediante MCP
slug: /guides/ai-assistants-mcp
description: Aprende cuándo usar el servidor MCP de WordPress Playground, en qué se diferencia de la CLI de Playground y cómo ejecutar demostraciones de WordPress en el navegador con un asistente de IA.
---

<!--
# Use WordPress Playground with AI assistants through MCP
-->

# Usa WordPress Playground con asistentes de IA mediante MCP

<!--
The WordPress Playground MCP server lets an AI assistant connect to a real Playground site running in your browser. After the connection is open, you can ask the assistant to navigate WordPress, inspect pages, reproduce issues, and explain what it finds.
-->

El servidor MCP de WordPress Playground permite que un asistente de IA se conecte a un sitio real de Playground que se ejecuta en tu navegador. Una vez establecida la conexión, puedes pedirle al asistente que navegue por WordPress, inspeccione páginas, reproduzca problemas y explique lo que encuentra.

<!--
Use this guide if you want to work with Playground through natural language instead of terminal commands. For the technical announcement, architecture, and setup commands, see [Connect AI coding agents to WordPress Playground with MCP](https://make.wordpress.org/playground/2026/03/17/connect-ai-coding-agents-to-wordpress-playground-with-mcp/).
-->

Usa esta guía si quieres trabajar con Playground mediante lenguaje natural en lugar de comandos de terminal. Para el anuncio técnico, la arquitectura y los comandos de configuración, consulta [Connect AI coding agents to WordPress Playground with MCP](https://make.wordpress.org/playground/2026/03/17/connect-ai-coding-agents-to-wordpress-playground-with-mcp/).

<!--
MCP is most useful when the site itself matters: a saved Playground, a persistent browser-backed site, a My WordPress-style site, or a demo where you want the assistant to act like a remote control for the browser. If you are working from a terminal-based coding agent and you mainly need local automation, the Playground CLI is usually simpler and less ambiguous.
-->

MCP es más útil cuando el propio sitio importa: un Playground guardado, un sitio persistente respaldado por el navegador, un sitio del estilo My WordPress o una demostración en la que quieres que el asistente actúe como un mando a distancia del navegador. Si trabajas desde un agente de código basado en terminal y necesitas principalmente automatización local, la CLI de Playground suele ser más sencilla y menos ambigua.

<!--
## What MCP adds to Playground
-->

## Qué aporta MCP a Playground

<!--
MCP, or Model Context Protocol, gives your AI assistant tools for the Playground site that is open in your browser. Instead of only describing a task, the assistant can act on the site:
-->

MCP, o Model Context Protocol, le da a tu asistente de IA herramientas para el sitio de Playground que está abierto en tu navegador. En lugar de solo describir una tarea, el asistente puede actuar sobre el sitio:

<!--
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
-->

- Abrir la URL exacta de Playground necesaria para conectarse al servidor MCP
- Listar tus sitios de Playground disponibles
- Abrir, renombrar o guardar un sitio de Playground
- Cambiar entre sitios de Playground gestionados por el navegador
- Navegar a las URL del administrador y de la parte pública de WordPress
- Seguir redirecciones e informar de la URL final
- Realizar peticiones autenticadas a la API REST de WordPress
- Leer y escribir archivos dentro del sistema de archivos de Playground
- Ejecutar PHP dentro del sitio de Playground
- Solicitar páginas e inspeccionar la respuesta

<!--
This is especially useful when the task depends on the browser state: logged-in admin screens, settings pages, and redirects.
-->

Esto es especialmente útil cuando la tarea depende del estado del navegador: pantallas de administración con la sesión iniciada, páginas de ajustes y redirecciones.

<!--
## Good use cases for MCP
-->

## Buenos casos de uso para MCP

<!--
Use MCP when you want an assistant to work with a visible, browser-managed WordPress site:
-->

Usa MCP cuando quieras que un asistente trabaje con un sitio de WordPress visible y gestionado por el navegador:

<!--
- Guide you through a settings screen: "Show me how to configure this WooCommerce option."
- Create a browser-based demo: "Build a simple recipe page and show me the result."
- Work with a persistent site: "Use my saved Playground site" or "Use the My WordPress site connected to my subscription."
- Reproduce a bug: "Follow these steps and summarize the error."
- Test a redirect or URL: "Open this page and tell me where the browser ends up."
- Inspect a running site: "Find the admin screen that matches this plugin feature."
-->

- Guiarte por una pantalla de ajustes: «Muéstrame cómo configurar esta opción de WooCommerce.»
- Crear una demostración basada en el navegador: «Crea una página de recetas sencilla y muéstrame el resultado.»
- Trabajar con un sitio persistente: «Usa mi sitio de Playground guardado» o «Usa el sitio My WordPress conectado a mi suscripción.»
- Reproducir un error: «Sigue estos pasos y resume el error.»
- Probar una redirección o URL: «Abre esta página y dime dónde acaba el navegador.»
- Inspeccionar un sitio en ejecución: «Encuentra la pantalla de administración que corresponde a esta función del plugin.»

<!--
MCP is less useful when the job is mostly local automation, such as running the same Blueprint repeatedly, mounting a plugin from your filesystem, or testing a version matrix. Use the Playground CLI for those workflows.
-->

MCP es menos útil cuando el trabajo consiste principalmente en automatización local, como ejecutar el mismo Blueprint repetidamente, montar un plugin desde tu sistema de archivos o probar una matriz de versiones. Usa la CLI de Playground para esos flujos de trabajo.

<!--
## Before you start
-->

## Antes de empezar

<!--
You need:
-->

Necesitas:

<!--
- An AI assistant or coding agent with the WordPress Playground MCP server configured
- A browser tab open at [playground.wordpress.net](https://playground.wordpress.net/)
- A Playground site you can safely test with
-->

- Un asistente de IA o agente de código con el servidor MCP de WordPress Playground configurado
- Una pestaña del navegador abierta en [playground.wordpress.net](https://playground.wordpress.net/)
- Un sitio de Playground con el que puedas probar de forma segura

<!--
If your assistant is not configured yet, use the setup instructions in the [MCP announcement post](https://make.wordpress.org/playground/2026/03/17/connect-ai-coding-agents-to-wordpress-playground-with-mcp/). The setup is for the AI assistant environment. Once it is configured, everyday use can happen from the assistant conversation and browser without manually running Playground CLI commands.
-->

Si tu asistente aún no está configurado, usa las instrucciones de configuración del [artículo de anuncio de MCP](https://make.wordpress.org/playground/2026/03/17/connect-ai-coding-agents-to-wordpress-playground-with-mcp/). La configuración es para el entorno del asistente de IA. Una vez configurado, el uso diario puede realizarse desde la conversación con el asistente y el navegador, sin ejecutar manualmente comandos de la CLI de Playground.

<!--
<div class="callout callout-tip">

**Save important demos first**

If you are preparing a demo, ask your assistant to save the current Playground site to browser storage before making many changes. Saved Playgrounds can be reopened from the Playground Launch Panel.

</div>
-->

<div class="callout callout-tip">

**Guarda primero las demostraciones importantes**

Si estás preparando una demostración, pídele a tu asistente que guarde el sitio actual de Playground en el almacenamiento del navegador antes de hacer muchos cambios. Los Playgrounds guardados pueden reabrirse desde el Panel de Lanzamiento de Playground.

</div>

<!--
<div class="callout callout-warning">

**Confirm which site the assistant is using**

You can have multiple Playground sites and multiple connected browser tabs. You can also connect more than one server or browser automation tool to the same assistant. That flexibility is useful, but it can get confusing. Before making changes, ask the assistant to list the connected sites and confirm the active site name.

</div>
-->

<div class="callout callout-warning">

**Confirma qué sitio está usando el asistente**

Puedes tener varios sitios de Playground y varias pestañas del navegador conectadas. También puedes conectar más de un servidor o herramienta de automatización del navegador al mismo asistente. Esa flexibilidad es útil, pero puede generar confusión. Antes de hacer cambios, pídele al asistente que liste los sitios conectados y confirme el nombre del sitio activo.

</div>

<!--
## Connect an AI assistant to Playground
-->

## Conecta un asistente de IA a Playground

<!--
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
-->

1. Abre tu asistente de IA.
2. Pídele que se conecte a WordPress Playground:

    ```text
    Abre WordPress Playground y conéctalo al servidor MCP.
    ```

3. El asistente debería proporcionar o abrir una URL de Playground que incluya un parámetro `mcp-port`.
4. Abre esa URL en tu navegador si el asistente no la abre automáticamente.
5. Pídele al asistente que liste los sitios de Playground disponibles:

    ```text
    Lista mis sitios de Playground disponibles y dime cuál está activo.
    ```

6. Elige el sitio de Playground que quieres usar:

    ```text
    Usa mi sitio de demostración de WooCommerce guardado y abre el escritorio de administración de WordPress.
    ```

<!--
If the assistant says no browser tab is connected, open the MCP Playground URL it provides and try again.
-->

Si el asistente indica que no hay ninguna pestaña del navegador conectada, abre la URL de Playground MCP que proporciona e inténtalo de nuevo.

<!--
## MCP vs CLI
-->

## MCP frente a CLI

<!--
WordPress Playground has two complementary products: the Playground website and the Playground CLI. The website is the browser experience at [playground.wordpress.net](https://playground.wordpress.net/). The CLI is the local automation environment for terminal, scripting, and CI workflows.
-->

WordPress Playground tiene dos productos complementarios: el sitio web de Playground y la CLI de Playground. El sitio web es la experiencia en el navegador en [playground.wordpress.net](https://playground.wordpress.net/). La CLI es el entorno de automatización local para flujos de trabajo de terminal, scripts y CI.

<!--
The choice depends on what you want the AI assistant to control.
-->

La elección depende de qué quieras que controle el asistente de IA.

<!--
With MCP, the assistant can make authenticated WordPress REST API requests to the connected site without manually configuring authentication. It can also use the `playground_navigate` tool to change the page displayed in the browser and report the final URL after redirects.
-->

Con MCP, el asistente puede realizar peticiones autenticadas a la API REST de WordPress en el sitio conectado sin configurar manualmente la autenticación. También puede usar la herramienta `playground_navigate` para cambiar la página que se muestra en el navegador e informar de la URL final después de las redirecciones.

<!--
From the CLI, comparable HTTP requests usually require a tool such as `curl` and are unauthenticated unless you configure authentication yourself. The CLI also does not control the page displayed in a user's browser.
-->

Desde la CLI, las peticiones HTTP equivalentes suelen requerir una herramienta como `curl` y no están autenticadas, a menos que configures manualmente la autenticación. La CLI tampoco controla la página que se muestra en el navegador del usuario.
