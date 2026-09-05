---
title: Use o WordPress Playground com assistentes de IA através do MCP
slug: /guides/ai-assistants-mcp
description: Saiba quando usar o servidor MCP do WordPress Playground, como ele difere da Playground CLI e como executar demonstrações do WordPress no navegador com um assistente de IA.
---

<!--
# Use WordPress Playground with AI assistants through MCP
-->

# Use o WordPress Playground com assistentes de IA através do MCP

<!--
The WordPress Playground MCP server lets an AI assistant connect to a real Playground site running in your browser. After the connection is open, you can ask the assistant to navigate WordPress, inspect pages, reproduce issues, and explain what it finds.
-->

O servidor MCP do WordPress Playground permite que um assistente de IA se conecte a um site real do Playground em execução no seu navegador. Depois que a conexão é estabelecida, você pode pedir ao assistente para navegar pelo WordPress, inspecionar páginas, reproduzir problemas e explicar o que encontra.

<!--
Use this guide if you want to work with Playground through natural language instead of terminal commands. For the technical announcement, architecture, and setup commands, see [Connect AI coding agents to WordPress Playground with MCP](https://make.wordpress.org/playground/2026/03/17/connect-ai-coding-agents-to-wordpress-playground-with-mcp/).
-->

Use este guia se você quiser trabalhar com o Playground usando linguagem natural em vez de comandos de terminal. Para o anúncio técnico, a arquitetura e os comandos de configuração, consulte [Connect AI coding agents to WordPress Playground with MCP](https://make.wordpress.org/playground/2026/03/17/connect-ai-coding-agents-to-wordpress-playground-with-mcp/).

<!--
MCP is most useful when the site itself matters: a saved Playground, a persistent browser-backed site, a My WordPress-style site, or a demo where you want the assistant to act like a remote control for the browser. If you are working from a terminal-based coding agent and you mainly need local automation, the Playground CLI is usually simpler and less ambiguous.
-->

O MCP é mais útil quando o próprio site importa: um Playground salvo, um site persistente baseado no navegador, um site no estilo My WordPress ou uma demonstração em que você quer que o assistente atue como um controle remoto do navegador. Se você estiver trabalhando a partir de um agente de código baseado em terminal e precisar principalmente de automação local, a Playground CLI costuma ser mais simples e menos ambígua.

<!--
## What MCP adds to Playground
-->

## O que o MCP adiciona ao Playground

<!--
MCP, or Model Context Protocol, gives your AI assistant tools for the Playground site that is open in your browser. Instead of only describing a task, the assistant can act on the site:
-->

O MCP, ou Model Context Protocol, fornece ao seu assistente de IA ferramentas para o site do Playground aberto no seu navegador. Em vez de apenas descrever uma tarefa, o assistente pode agir sobre o site:

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

- Abrir a URL exata do Playground necessária para se conectar ao servidor MCP
- Listar os seus sites do Playground disponíveis
- Abrir, renomear ou salvar um site do Playground
- Alternar entre sites do Playground gerenciados pelo navegador
- Navegar até URLs do painel administrativo e do front-end do WordPress
- Seguir redirecionamentos e informar a URL final
- Fazer solicitações autenticadas à API REST do WordPress
- Ler e gravar arquivos dentro do sistema de arquivos do Playground
- Executar PHP dentro do site do Playground
- Solicitar páginas e inspecionar a resposta

<!--
This is especially useful when the task depends on the browser state: logged-in admin screens, settings pages, and redirects.
-->

Isso é especialmente útil quando a tarefa depende do estado do navegador: telas administrativas com sessão iniciada, páginas de configurações e redirecionamentos.

<!--
## Good use cases for MCP
-->

## Bons casos de uso para o MCP

<!--
Use MCP when you want an assistant to work with a visible, browser-managed WordPress site:
-->

Use o MCP quando você quiser que um assistente trabalhe com um site WordPress visível e gerenciado pelo navegador:

<!--
- Guide you through a settings screen: "Show me how to configure this WooCommerce option."
- Create a browser-based demo: "Build a simple recipe page and show me the result."
- Work with a persistent site: "Use my saved Playground site" or "Use the My WordPress site connected to my subscription."
- Reproduce a bug: "Follow these steps and summarize the error."
- Test a redirect or URL: "Open this page and tell me where the browser ends up."
- Inspect a running site: "Find the admin screen that matches this plugin feature."
-->

- Orientar você por uma tela de configurações: "Mostre-me como configurar esta opção do WooCommerce."
- Criar uma demonstração baseada no navegador: "Crie uma página de receita simples e mostre-me o resultado."
- Trabalhar com um site persistente: "Use o meu site do Playground salvo" ou "Use o site My WordPress conectado à minha assinatura."
- Reproduzir um bug: "Siga estes passos e resuma o erro."
- Testar um redirecionamento ou uma URL: "Abra esta página e diga-me onde o navegador termina."
- Inspecionar um site em execução: "Encontre a tela administrativa correspondente a este recurso do plugin."

<!--
MCP is less useful when the job is mostly local automation, such as running the same Blueprint repeatedly, mounting a plugin from your filesystem, or testing a version matrix. Use the Playground CLI for those workflows.
-->

O MCP é menos útil quando o trabalho é principalmente automação local, como executar repetidamente o mesmo Blueprint, montar um plugin a partir do seu sistema de arquivos ou testar uma matriz de versões. Use a Playground CLI para esses fluxos de trabalho.

<!--
## Before you start
-->

## Antes de começar

<!--
You need:
-->

Você precisa de:

<!--
- An AI assistant or coding agent with the WordPress Playground MCP server configured
- A browser tab open at [playground.wordpress.net](https://playground.wordpress.net/)
- A Playground site you can safely test with
-->

- Um assistente de IA ou agente de código com o servidor MCP do WordPress Playground configurado
- Uma aba do navegador aberta em [playground.wordpress.net](https://playground.wordpress.net/)
- Um site do Playground com o qual você possa testar com segurança

<!--
If your assistant is not configured yet, use the setup instructions in the [MCP announcement post](https://make.wordpress.org/playground/2026/03/17/connect-ai-coding-agents-to-wordpress-playground-with-mcp/). The setup is for the AI assistant environment. Once it is configured, everyday use can happen from the assistant conversation and browser without manually running Playground CLI commands.
-->

Se o seu assistente ainda não estiver configurado, use as instruções de configuração no [post de anúncio do MCP](https://make.wordpress.org/playground/2026/03/17/connect-ai-coding-agents-to-wordpress-playground-with-mcp/). A configuração é para o ambiente do assistente de IA. Uma vez configurado, o uso diário pode acontecer a partir da conversa com o assistente e do navegador, sem executar manualmente comandos da Playground CLI.

<!--
<div class="callout callout-tip">

**Save important demos first**

If you are preparing a demo, ask your assistant to save the current Playground site to browser storage before making many changes. Saved Playgrounds can be reopened from the Playground Launch Panel.

</div>
-->

<div class="callout callout-tip">

**Salve as demonstrações importantes primeiro**

Se você estiver preparando uma demonstração, peça ao seu assistente para salvar o site atual do Playground no armazenamento do navegador antes de fazer muitas alterações. Playgrounds salvos podem ser reabertos a partir do Painel de Lançamento do Playground.

</div>

<!--
<div class="callout callout-warning">

**Confirm which site the assistant is using**

You can have multiple Playground sites and multiple connected browser tabs. You can also connect more than one server or browser automation tool to the same assistant. That flexibility is useful, but it can get confusing. Before making changes, ask the assistant to list the connected sites and confirm the active site name.

</div>
-->

<div class="callout callout-warning">

**Confirme qual site o assistente está usando**

Você pode ter vários sites do Playground e várias abas de navegador conectadas. Você também pode conectar mais de um servidor ou ferramenta de automação de navegador ao mesmo assistente. Essa flexibilidade é útil, mas pode gerar confusão. Antes de fazer alterações, peça ao assistente para listar os sites conectados e confirmar o nome do site ativo.

</div>

<!--
## Connect an AI assistant to Playground
-->

## Conecte um assistente de IA ao Playground

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

1. Abra o seu assistente de IA.
2. Peça a ele para se conectar ao WordPress Playground:

    ```text
    Abra o WordPress Playground e conecte-o ao servidor MCP.
    ```

3. O assistente deve fornecer ou abrir uma URL do Playground que inclui um parâmetro `mcp-port`.
4. Abra essa URL no seu navegador caso o assistente não a abra automaticamente.
5. Peça ao assistente para listar os sites do Playground disponíveis:

    ```text
    Liste os meus sites do Playground disponíveis e diga-me qual está ativo.
    ```

6. Escolha o site do Playground que você quer usar:

    ```text
    Use o meu site de demonstração do WooCommerce salvo e abra o painel administrativo do WordPress.
    ```

<!--
If the assistant says no browser tab is connected, open the MCP Playground URL it provides and try again.
-->

Se o assistente disser que nenhuma aba do navegador está conectada, abra a URL do Playground MCP que ele fornece e tente novamente.

<!--
## MCP vs CLI
-->

## MCP vs CLI

<!--
WordPress Playground has two complementary products: the Playground website and the Playground CLI. The website is the browser experience at [playground.wordpress.net](https://playground.wordpress.net/). The CLI is the local automation environment for terminal, scripting, and CI workflows.
-->

O WordPress Playground tem dois produtos complementares: o site do Playground e a Playground CLI. O site é a experiência no navegador em [playground.wordpress.net](https://playground.wordpress.net/). A CLI é o ambiente de automação local para fluxos de trabalho de terminal, scripts e CI.

<!--
The choice depends on what you want the AI assistant to control.
-->

A escolha depende do que você quer que o assistente de IA controle.

<!--
With MCP, the assistant can make authenticated WordPress REST API requests to the connected site without manually configuring authentication. It can also use the `playground_navigate` tool to change the page displayed in the browser and report the final URL after redirects.
-->

Com o MCP, o assistente pode fazer solicitações autenticadas à API REST do WordPress no site conectado sem configurar a autenticação manualmente. Ele também pode usar a ferramenta `playground_navigate` para alterar a página exibida no navegador e informar a URL final após os redirecionamentos.

<!--
From the CLI, comparable HTTP requests usually require a tool such as `curl` and are unauthenticated unless you configure authentication yourself. The CLI also does not control the page displayed in a user's browser.
-->

Na CLI, solicitações HTTP equivalentes normalmente exigem uma ferramenta como `curl` e não são autenticadas, a menos que você configure a autenticação. A CLI também não controla a página exibida no navegador do usuário.
