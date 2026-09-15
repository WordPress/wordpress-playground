---
title: Utiliser WordPress Playground avec des assistants IA via le MCP
slug: /guides/ai-assistants-mcp
description: Découvrez quand utiliser le serveur MCP de WordPress Playground, en quoi il diffère de la CLI Playground et comment exécuter des démonstrations WordPress dans le navigateur avec un assistant IA.
---

<!--
# Use WordPress Playground with AI assistants through MCP
-->

# Utiliser WordPress Playground avec des assistants IA via le MCP

<!--
The WordPress Playground MCP server lets an AI assistant connect to a real Playground site running in your browser. After the connection is open, you can ask the assistant to navigate WordPress, inspect pages, reproduce issues, and explain what it finds.
-->

Le serveur MCP de WordPress Playground permet à un assistant IA de se connecter à un véritable site Playground exécuté dans votre navigateur. Une fois la connexion établie, vous pouvez demander à l'assistant de naviguer dans WordPress, d'inspecter des pages, de reproduire des problèmes et d'expliquer ce qu'il trouve.

<!--
Use this guide if you want to work with Playground through natural language instead of terminal commands. For the technical announcement, architecture, and setup commands, see [Connect AI coding agents to WordPress Playground with MCP](https://make.wordpress.org/playground/2026/03/17/connect-ai-coding-agents-to-wordpress-playground-with-mcp/).
-->

Utilisez ce guide si vous souhaitez travailler avec Playground en langage naturel plutôt qu'avec des commandes de terminal. Pour l'annonce technique, l'architecture et les commandes de configuration, consultez [Connect AI coding agents to WordPress Playground with MCP](https://make.wordpress.org/playground/2026/03/17/connect-ai-coding-agents-to-wordpress-playground-with-mcp/).

<!--
MCP is most useful when the site itself matters: a saved Playground, a persistent browser-backed site, a My WordPress-style site, or a demo where you want the assistant to act like a remote control for the browser. If you are working from a terminal-based coding agent and you mainly need local automation, the Playground CLI is usually simpler and less ambiguous.
-->

Le MCP est particulièrement utile lorsque le site lui-même compte : un Playground sauvegardé, un site persistant adossé au navigateur, un site de type My WordPress ou une démonstration dans laquelle vous voulez que l'assistant agisse comme une télécommande du navigateur. Si vous travaillez à partir d'un agent de code basé sur le terminal et que vous avez surtout besoin d'automatisation locale, la CLI Playground est généralement plus simple et moins ambiguë.

<!--
## What MCP adds to Playground
-->

## Ce que le MCP apporte à Playground

<!--
MCP, or Model Context Protocol, gives your AI assistant tools for the Playground site that is open in your browser. Instead of only describing a task, the assistant can act on the site:
-->

Le MCP, ou Model Context Protocol, fournit à votre assistant IA des outils pour le site Playground ouvert dans votre navigateur. Au lieu de simplement décrire une tâche, l'assistant peut agir sur le site :

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

- Ouvrir l'URL Playground exacte nécessaire pour se connecter au serveur MCP
- Lister vos sites Playground disponibles
- Ouvrir, renommer ou sauvegarder un site Playground
- Basculer entre les sites Playground gérés par le navigateur
- Naviguer vers les URL de l'administration et de la partie publique de WordPress
- Suivre les redirections et signaler l'URL finale
- Effectuer des requêtes authentifiées à l'API REST de WordPress
- Lire et écrire des fichiers dans le système de fichiers de Playground
- Exécuter du PHP dans le site Playground
- Demander des pages et inspecter la réponse

<!--
This is especially useful when the task depends on the browser state: logged-in admin screens, settings pages, and redirects.
-->

C'est particulièrement utile lorsque la tâche dépend de l'état du navigateur : écrans d'administration avec une session ouverte, pages de réglages et redirections.

<!--
## Good use cases for MCP
-->

## Bons cas d'usage pour le MCP

<!--
Use MCP when you want an assistant to work with a visible, browser-managed WordPress site:
-->

Utilisez le MCP lorsque vous voulez qu'un assistant travaille avec un site WordPress visible et géré par le navigateur :

<!--
- Guide you through a settings screen: "Show me how to configure this WooCommerce option."
- Create a browser-based demo: "Build a simple recipe page and show me the result."
- Work with a persistent site: "Use my saved Playground site" or "Use the My WordPress site connected to my subscription."
- Reproduce a bug: "Follow these steps and summarize the error."
- Test a redirect or URL: "Open this page and tell me where the browser ends up."
- Inspect a running site: "Find the admin screen that matches this plugin feature."
-->

- Vous guider à travers un écran de réglages : « Montre-moi comment configurer cette option WooCommerce. »
- Créer une démonstration dans le navigateur : « Construis une simple page de recette et montre-moi le résultat. »
- Travailler avec un site persistant : « Utilise mon site Playground sauvegardé » ou « Utilise le site My WordPress connecté à mon abonnement. »
- Reproduire un bogue : « Suis ces étapes et résume l'erreur. »
- Tester une redirection ou une URL : « Ouvre cette page et dis-moi où le navigateur aboutit. »
- Inspecter un site en cours d'exécution : « Trouve l'écran d'administration qui correspond à cette fonctionnalité de l'extension. »

<!--
MCP is less useful when the job is mostly local automation, such as running the same Blueprint repeatedly, mounting a plugin from your filesystem, or testing a version matrix. Use the Playground CLI for those workflows.
-->

Le MCP est moins utile lorsque le travail consiste surtout en de l'automatisation locale, comme exécuter le même Blueprint de façon répétée, monter une extension depuis votre système de fichiers ou tester une matrice de versions. Utilisez la CLI Playground pour ces flux de travail.

<!--
## Before you start
-->

## Avant de commencer

<!--
You need:
-->

Il vous faut :

<!--
- An AI assistant or coding agent with the WordPress Playground MCP server configured
- A browser tab open at [playground.wordpress.net](https://playground.wordpress.net/)
- A Playground site you can safely test with
-->

- Un assistant IA ou un agent de code avec le serveur MCP de WordPress Playground configuré
- Un onglet de navigateur ouvert sur [playground.wordpress.net](https://playground.wordpress.net/)
- Un site Playground avec lequel vous pouvez tester en toute sécurité

<!--
If your assistant is not configured yet, use the setup instructions in the [MCP announcement post](https://make.wordpress.org/playground/2026/03/17/connect-ai-coding-agents-to-wordpress-playground-with-mcp/). The setup is for the AI assistant environment. Once it is configured, everyday use can happen from the assistant conversation and browser without manually running Playground CLI commands.
-->

Si votre assistant n'est pas encore configuré, utilisez les instructions de configuration de l'[article d'annonce du MCP](https://make.wordpress.org/playground/2026/03/17/connect-ai-coding-agents-to-wordpress-playground-with-mcp/). La configuration concerne l'environnement de l'assistant IA. Une fois configuré, l'utilisation quotidienne peut se faire depuis la conversation avec l'assistant et le navigateur, sans exécuter manuellement de commandes de la CLI Playground.

<!--
<div class="callout callout-tip">

**Save important demos first**

If you are preparing a demo, ask your assistant to save the current Playground site to browser storage before making many changes. Saved Playgrounds can be reopened from the Playground Launch Panel.

</div>
-->

<div class="callout callout-tip">

**Sauvegardez d'abord les démonstrations importantes**

Si vous préparez une démonstration, demandez à votre assistant de sauvegarder le site Playground actuel dans le stockage du navigateur avant d'effectuer de nombreuses modifications. Les Playgrounds sauvegardés peuvent être rouverts depuis le Panneau de lancement de Playground.

</div>

<!--
<div class="callout callout-warning">

**Confirm which site the assistant is using**

You can have multiple Playground sites and multiple connected browser tabs. You can also connect more than one server or browser automation tool to the same assistant. That flexibility is useful, but it can get confusing. Before making changes, ask the assistant to list the connected sites and confirm the active site name.

</div>
-->

<div class="callout callout-warning">

**Confirmez quel site l'assistant utilise**

Vous pouvez avoir plusieurs sites Playground et plusieurs onglets de navigateur connectés. Vous pouvez aussi connecter plus d'un serveur ou outil d'automatisation de navigateur au même assistant. Cette flexibilité est utile, mais elle peut prêter à confusion. Avant d'effectuer des modifications, demandez à l'assistant de lister les sites connectés et de confirmer le nom du site actif.

</div>

<!--
## Connect an AI assistant to Playground
-->

## Connecter un assistant IA à Playground

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

1. Ouvrez votre assistant IA.
2. Demandez-lui de se connecter à WordPress Playground :

    ```text
    Ouvre WordPress Playground et connecte-le au serveur MCP.
    ```

3. L'assistant devrait fournir ou ouvrir une URL Playground qui inclut un paramètre `mcp-port`.
4. Ouvrez cette URL dans votre navigateur si l'assistant ne l'ouvre pas automatiquement.
5. Demandez à l'assistant de lister les sites Playground disponibles :

    ```text
    Liste mes sites Playground disponibles et dis-moi lequel est actif.
    ```

6. Choisissez le site Playground que vous voulez utiliser :

    ```text
    Utilise mon site de démonstration WooCommerce sauvegardé et ouvre le tableau de bord d'administration de WordPress.
    ```

<!--
If the assistant says no browser tab is connected, open the MCP Playground URL it provides and try again.
-->

Si l'assistant indique qu'aucun onglet de navigateur n'est connecté, ouvrez l'URL Playground MCP qu'il fournit et réessayez.

<!--
## MCP vs CLI
-->

## MCP ou CLI

<!--
WordPress Playground has two complementary products: the Playground website and the Playground CLI. The website is the browser experience at [playground.wordpress.net](https://playground.wordpress.net/). The CLI is the local automation environment for terminal, scripting, and CI workflows.
-->

WordPress Playground propose deux produits complémentaires : le site web Playground et la CLI Playground. Le site web est l'expérience dans le navigateur sur [playground.wordpress.net](https://playground.wordpress.net/). La CLI est l'environnement d'automatisation locale pour les flux de travail de terminal, de script et de CI.

<!--
The choice depends on what you want the AI assistant to control.
-->

Le choix dépend de ce que vous voulez que l'assistant IA contrôle.

<!--
With MCP, the assistant can make authenticated WordPress REST API requests to the connected site without manually configuring authentication. It can also use the `playground_navigate` tool to change the page displayed in the browser and report the final URL after redirects.
-->

Avec MCP, l'assistant peut effectuer des requêtes authentifiées vers l'API REST de WordPress sur le site connecté, sans configurer manuellement l'authentification. Il peut également utiliser l'outil `playground_navigate` pour changer la page affichée dans le navigateur et indiquer l'URL finale après les redirections.

<!--
From the CLI, comparable HTTP requests usually require a tool such as `curl` and are unauthenticated unless you configure authentication yourself. The CLI also does not control the page displayed in a user's browser.
-->

Depuis la CLI, des requêtes HTTP équivalentes nécessitent généralement un outil tel que `curl` et ne sont pas authentifiées, sauf si vous configurez vous-même l'authentification. La CLI ne contrôle pas non plus la page affichée dans le navigateur de l'utilisateur.
