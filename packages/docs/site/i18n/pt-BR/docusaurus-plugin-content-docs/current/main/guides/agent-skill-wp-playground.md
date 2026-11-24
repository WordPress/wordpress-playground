---
title: Usando a Skill de Agente do WordPress Playground
slug: /guides/agent-skill-wp-playground
description: Instale e use a skill wp-playground para automatizar fluxos de trabalho do WordPress Playground com seu agente de codificação.
---

<!--
# Using the WordPress Playground Agent Skill
-->

# Usando a Skill de Agente do WordPress Playground

<!--
Want an AI assistant that already knows how to spin up WordPress instances, run Blueprints, and debug plugins? The **wp-playground** agent skill teaches coding agents the WordPress Playground CLI and browser workflows. You describe what you need in plain language. The agent handles the commands.
-->

Quer um assistente de IA que já saiba como iniciar instâncias do WordPress, executar Blueprints e depurar plugins? A skill de agente **wp-playground** ensina aos agentes de codificação os fluxos de trabalho do CLI e navegador do WordPress Playground. Você descreve o que precisa em linguagem natural. O agente cuida dos comandos.

<!--
Your coding agent reads the skill reference — a document with CLI flags, procedures, and troubleshooting steps — before responding. This ensures Playground commands run correctly.
-->

Seu agente de codificação lê a referência da skill — um documento com flags do CLI, procedimentos e etapas de solução de problemas — antes de responder. Isso garante que os comandos do Playground sejam executados corretamente.

<!--
## Prerequisites
-->

## Pré-requisitos

<!--
Before installing the skill, confirm you have:

| Requirement | Minimum version       | Check command   |
| ----------- | --------------------- | --------------- |
| Node.js     | 20.18                 | `node -v`       |
| npm / npx   | Included with Node.js | `npx --version` |
-->

Antes de instalar a skill, confirme que você tem:

| Requisito | Versão mínima        | Comando de verificação |
| --------- | -------------------- | ---------------------- |
| Node.js   | 20.18                | `node -v`              |
| npm / npx | Incluído com Node.js | `npx --version`        |

<!--
You also need a coding agent that supports agent skills: Antigravity, Claude Code, Codex, Copilot, Cursor, or Gemini CLI. Make sure your CLI or IDE runs the latest version. Output quality depends on your chosen model.
-->

Você também precisa de um agente de codificação que suporte skills de agente: Antigravity, Claude Code, Codex, Copilot, Cursor ou Gemini CLI. Certifique-se de que seu CLI ou IDE execute a versão mais recente. A qualidade da saída depende do modelo escolhido.

<!--
## Installation
-->

## Instalação

<!--
### 1. Install via terminal
-->

### 1. Instalar via terminal

<!--
Install the skill using the `npx skills` CLI:

```bash
npx skills add wordpress/agent-skills --skill wp-playground
```
-->

Instale a skill usando o CLI `npx skills`:

```bash
npx skills add wordpress/agent-skills --skill wp-playground
```

<!--
### 2. Install manually
-->

### 2. Instalar manualmente

<!--
```bash
# Clone agent-skills
git clone https://github.com/WordPress/agent-skills.git
cd agent-skills

# Build the distribution
node shared/scripts/skillpack-build.mjs --clean

# Install into your WordPress project
node shared/scripts/skillpack-install.mjs --dest=../your-wp-project --targets=codex,vscode,claude,cursor,antigravity,gemini
```
-->

```bash
# Clone agent-skills
git clone https://github.com/WordPress/agent-skills.git
cd agent-skills

# Construir a distribuição
node shared/scripts/skillpack-build.mjs --clean

# Instalar no seu projeto WordPress
node shared/scripts/skillpack-install.mjs --dest=../your-wp-project --targets=codex,vscode,claude,cursor,antigravity,gemini
```

<!--
This copies skills into:

- `.github/skills/` for VS Code / GitHub Copilot
- `.claude/skills/` for Claude Code
- `.cursor/skills/` for Cursor
- `.agent/skills/` for Antigravity
- `.gemini/skills/` for Gemini CLI
- `.codex/skills/` for Codex
-->

Isso copia as skills para:

- `.github/skills/` para VS Code / GitHub Copilot
- `.claude/skills/` para Claude Code
- `.cursor/skills/` para Cursor
- `.agent/skills/` para Antigravity
- `.gemini/skills/` para Gemini CLI
- `.codex/skills/` para Codex

<!--
Verify installation by checking the skill directory exists for your agent:

| Agent          | Skill directory                 |
| -------------- | ------------------------------- |
| Claude Code    | `.claude/skills/wp-playground/` |
| Gemini CLI     | `.gemini/skills/wp-playground/` |
| GitHub Copilot | `.github/skills/wp-playground/` |
| Cursor         | `.cursor/skills/wp-playground/` |
| Antigravity    | `.agent/skills/wp-playground/`  |
| Codex          | `.codex/skills/wp-playground/`  |
-->

Verifique a instalação conferindo se o diretório da skill existe para seu agente:

| Agente         | Diretório da skill              |
| -------------- | ------------------------------- |
| Claude Code    | `.claude/skills/wp-playground/` |
| Gemini CLI     | `.gemini/skills/wp-playground/` |
| GitHub Copilot | `.github/skills/wp-playground/` |
| Cursor         | `.cursor/skills/wp-playground/` |
| Antigravity    | `.agent/skills/wp-playground/`  |
| Codex          | `.codex/skills/wp-playground/`  |

<!--
Some agents also support listing skills directly:

```bash
# Claude Code
claude /skills

# Gemini CLI
gemini /skills list
```
-->

Alguns agentes também suportam listar skills diretamente:

```bash
# Claude Code
claude /skills

# Gemini CLI
gemini /skills list
```

<!--
## Use the skill in the terminal
-->

## Usar a skill no terminal

<!--
With the skill installed, describe your WordPress environment to your coding agent. The agent builds the Blueprint, runs the CLI commands, and starts the server.
-->

Com a skill instalada, descreva seu ambiente WordPress para seu agente de codificação. O agente constrói o Blueprint, executa os comandos do CLI e inicia o servidor.

<!--
Open your coding agent in the terminal and type your request:

```
> Run a WordPress instance with my plugin mounted
```
-->

Abra seu agente de codificação no terminal e digite sua solicitação:

```
> Execute uma instância WordPress com meu plugin montado
```

<!--
The agent reads the skill reference, detects your project layout, and runs `server --auto-mount`. The instance starts at `http://localhost:9400`.
-->

O agente lê a referência da skill, detecta o layout do seu projeto e executa `server --auto-mount`. A instância inicia em `http://localhost:9400`.

<!--
### Generating content on the fly
-->

### Gerando conteúdo dinamicamente

<!--
Need sample data for testing or a demo? Describe the content structure you want:

```
> Run a WordPress with 10 published posts
```
-->

Precisa de dados de exemplo para testes ou demonstração? Descreva a estrutura de conteúdo que você quer:

```
> Execute um WordPress com 10 posts publicados
```

<!--
The agent creates a Blueprint with a `runPHP` step that generates the posts using `wp_insert_post()`.
-->

O agente cria um Blueprint com um passo `runPHP` que gera os posts usando `wp_insert_post()`.

<!--
More examples:

```
> Run a WordPress with 3 users where each user has 3 posts
```

```
> Start a WordPress instance with 5 pages and a custom menu linking to all of them
```

```
> Create a WordPress site with 20 posts across 4 categories
```
-->

Mais exemplos:

```
> Execute um WordPress com 3 usuários onde cada usuário tem 3 posts
```

```
> Inicie uma instância WordPress com 5 páginas e um menu personalizado linkando todas elas
```

```
> Crie um site WordPress com 20 posts em 4 categorias
```

<!--
Each prompt produces a complete Blueprint that runs locally, handling user creation, role assignment, post generation, and taxonomy setup through Blueprint steps.
-->

Cada prompt produz um Blueprint completo que roda localmente, gerenciando criação de usuários, atribuição de funções, geração de posts e configuração de taxonomias através dos passos do Blueprint.

<!--
### Version compatibility testing
-->

### Testes de compatibilidade de versão

<!--
Does your plugin work on older PHP versions? Ask directly:

```
> Test my plugin on WordPress 6.3 with PHP 7.4
```

```
> Run my theme on the latest WordPress nightly with PHP 8.5
```
-->

Seu plugin funciona em versões mais antigas do PHP? Pergunte diretamente:

```
> Teste meu plugin no WordPress 6.3 com PHP 7.4
```

```
> Execute meu tema no último WordPress nightly com PHP 8.5
```

<!--
The agent adds `--wp` and `--php` flags to match your request. Common combinations:

| Scenario          | What to ask                                                 |
| ----------------- | ----------------------------------------------------------- |
| Latest stable     | "Run a WordPress instance" (defaults to latest WP, PHP 8.3) |
| Minimum supported | "Test my plugin on WordPress 6.3 with PHP 7.4"              |
| Upcoming release  | "Run the WordPress nightly build"                           |
| Legacy PHP        | "Start WordPress with PHP 7.4"                              |
-->

O agente adiciona as flags `--wp` e `--php` para corresponder à sua solicitação. Combinações comuns:

| Cenário            | O que pedir                                                    |
| ------------------ | -------------------------------------------------------------- |
| Última estável     | "Execute uma instância WordPress" (padrão: último WP, PHP 8.3) |
| Mínima suportada   | "Teste meu plugin no WordPress 6.3 com PHP 7.4"                |
| Próximo lançamento | "Execute o WordPress nightly build"                            |
| PHP legado         | "Inicie WordPress com PHP 7.4"                                 |

<!--
### Complex scenarios
-->

### Cenários complexos

<!--
Combine multiple requirements in a single prompt:

```
> Create a WordPress site with WooCommerce, 3 product categories,
  10 sample products, and 2 customer accounts — running on PHP 8.2
```

```
> Run a WordPress instance with my plugin mounted, debug mode enabled,
  and 5 test posts that include featured images
```
-->

Combine múltiplos requisitos em um único prompt:

```
> Crie um site WordPress com WooCommerce, 3 categorias de produtos,
  10 produtos de exemplo e 2 contas de clientes — rodando no PHP 8.2
```

```
> Execute uma instância WordPress com meu plugin montado, modo debug habilitado
  e 5 posts de teste que incluam imagens destacadas
```

<!--
The agent breaks these into the right sequence of Blueprint steps and CLI flags. Each request produces a fully configured, running instance.
-->

O agente divide isso na sequência correta de passos do Blueprint e flags do CLI. Cada solicitação produz uma instância totalmente configurada e em execução.

<!--
## How the skill works
-->

## Como a skill funciona

<!--
The wp-playground skill is a set of Markdown files that your coding agent loads into its context when your request matches Playground-related patterns. The skill includes:

- **SKILL.MD** — The main procedure: guardrails, step-by-step workflows, verification checks, and failure modes.
- **references/cli-commands.md** — A CLI cheatsheet with every flag and default value.
- **references/blueprint.md** — Blueprint structure, common steps, and authoring tips.
- **references/debugging.md** — Xdebug setup, path mapping, and troubleshooting steps.
-->

A skill wp-playground é um conjunto de arquivos Markdown que seu agente de codificação carrega em seu contexto quando sua solicitação corresponde a padrões relacionados ao Playground. A skill inclui:

- **SKILL.MD** — O procedimento principal: guardrails, fluxos de trabalho passo a passo, verificações e modos de falha.
- **references/cli-commands.md** — Uma cheatsheet do CLI com todas as flags e valores padrão.
- **references/blueprint.md** — Estrutura do Blueprint, passos comuns e dicas de criação.
- **references/debugging.md** — Configuração do Xdebug, mapeamento de caminhos e etapas de solução de problemas.

<!--
Your coding agent reads these files before generating commands, ensuring correct flags and warning you about common pitfalls.
-->

Seu agente de codificação lê esses arquivos antes de gerar comandos, garantindo flags corretas e alertando sobre armadilhas comuns.

<!--
## Next steps
-->

## Próximos passos

<!--
- [WordPress Playground for Plugin Developers](/guides/for-plugin-developers) — Showcase and develop plugins with Playground
- [WordPress Playground for Theme Developers](/guides/for-theme-developers) — Build and demo themes using Playground
- [Upstream Playground documentation](https://wordpress.github.io/wordpress-playground/) — Full reference for APIs, architecture, and advanced configuration
-->

- [WordPress Playground para Desenvolvedores de Plugins](/guides/for-plugin-developers) — Apresente e desenvolva plugins com Playground
- [WordPress Playground para Desenvolvedores de Temas](/guides/for-theme-developers) — Construa e demonstre temas usando Playground
- [Documentação upstream do Playground](https://wordpress.github.io/wordpress-playground/) — Referência completa para APIs, arquitetura e configuração avançada
