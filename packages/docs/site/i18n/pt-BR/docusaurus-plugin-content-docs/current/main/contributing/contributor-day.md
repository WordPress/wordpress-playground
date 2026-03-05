---
slug: /contributing/contributor-day
title: Dia do Contribuidor do WordCamp
description: Um guia sobre como contribuir com o WordPress Playground e como ele pode te ajudar no Dia do Contribuidor.
---

<!--
# WordCamp Contributor Day
-->

# Dia do Contribuidor do WordCamp

<!--
WordCamp Contributor Day is an event where the WordPress community comes together to contribute to the WordPress project. This guide focuses on how you can contribute to the WordPress Playground project or how the Playground can assist you in contributing to WordPress Core.
-->

O Dia do Contribuidor do WordCamp é um evento onde a comunidade WordPress se reúne para contribuir com o projeto WordPress. Este guia foca em como você pode contribuir com o projeto WordPress Playground ou como o Playground pode ajudá-lo a contribuir com o WordPress Core.

<!--
## Who Can Contribute?
-->

## Quem pode contribuir?

<!--
Some events will have a dedicated table for the project. The WordPress Playground contributor tables welcome all kinds of contributions, not just from developers. Whether you are a writer, coder, tester, plugin or theme developer, marketer, site owner, or any other type of user, you are encouraged to contribute.
-->

Alguns eventos terão uma mesa dedicada ao projeto. As mesas de contribuidores do WordPress Playground recebem todos os tipos de contribuições, não apenas de desenvolvedores. Seja você escritor, programador, testador, desenvolvedor de plugins ou temas, profissional de marketing, proprietário de site ou qualquer outro tipo de usuário, você é encorajado a contribuir.

<!--
We value diverse contributions across various areas, including community building, testing, documentation, and design.
-->

Valorizamos contribuições diversas em várias áreas, incluindo construção de comunidade, testes, documentação e design.

<!--
## How to Contribute to the Playground Project
-->

## Como contribuir com o projeto Playground

<!--
This section outlines how you can contribute directly to the WordPress Playground project and its associated tools:
-->

Esta seção descreve como você pode contribuir diretamente com o projeto WordPress Playground e suas ferramentas associadas:

<!--
-   **Documentation:** Enhance our documentation by improving existing content, developing new guides, or translating materials into different languages.
-   **Blueprints:** Create plugin demos for plugins at the WordPress Plugin repository, or develop new Blueprints to enrich our project documentation.
-   **Testing the Playground Environment:** Engage in testing the WordPress Playground project itself. You can do this by carefully crafting new issues that describe problems you encounter and suggesting actionable solutions. Test our WordPress web instance (the playground.wordpress.net site), or explore the various applications powered by Playground. Test these tools, observe their functionality, and provide detailed feedback.
-   **Product Feedback:** Your insights are invaluable for improving the Playground experience. This includes general feedback on the web instance, the application, and any server-side tools.
-->

-   **Documentação:** Melhore nossa documentação aprimorando o conteúdo existente, desenvolvendo novos guias ou traduzindo materiais para diferentes idiomas.
-   **Blueprints:** Crie demonstrações de plugins para os plugins no repositório de Plugins do WordPress, ou desenvolva novos Blueprints para enriquecer nossa documentação do projeto.
-   **Testes do ambiente Playground:** Participe dos testes do próprio projeto WordPress Playground. Você pode fazer isso criando cuidadosamente novos issues que descrevam os problemas que você encontrou e sugerindo soluções práticas. Teste nossa instância web do WordPress (o site playground.wordpress.net), ou explore os vários aplicativos alimentados pelo Playground. Teste essas ferramentas, observe sua funcionalidade e forneça feedback detalhado.
-   **Feedback do produto:** Suas ideias são inestimáveis para melhorar a experiência do Playground. Isso inclui feedback geral sobre a instância web, o aplicativo e quaisquer ferramentas do lado do servidor.

<!--
All feedback, including reported issues and test results, can be submitted through our GitHub repository.
-->

Todos os feedbacks, incluindo issues reportados e resultados de testes, podem ser enviados através do nosso repositório GitHub.

<!--
### Follow-up and Continued Engagement
-->

### Acompanhamento e engajamento contínuo

<!--
While many tasks are completed during the event, your contribution journey doesn't have to end there. You are welcome to continue working on your issues or pull requests after Contributor Day. We anticipate ongoing activity from contributors who take on tasks beyond the event. Please note that if a pull request shows no activity for one month, it may be considered abandoned and subsequently closed.
-->

Embora muitas tarefas sejam concluídas durante o evento, sua jornada de contribuição não precisa terminar aí. Você é bem-vindo para continuar trabalhando em seus issues ou pull requests após o Dia do Contribuidor. Antecipamos atividade contínua de contribuidores que assumem tarefas além do evento. Por favor, note que se um pull request não mostrar atividade por um mês, ele pode ser considerado abandonado e subsequentemente fechado.

<!--
### Getting Help and Staying Engaged
-->

### Obtendo ajuda e mantendo-se engajado

<!--
During Contributor Day, you can find direct assistance and interact with us at the dedicated Playground table. For continuous support and community interaction, you can connect with us on the `#playground` channel on WordPress Slack or via GitHub.
-->

Durante o Dia do Contribuidor, você pode encontrar assistência direta e interagir conosco na mesa dedicada do Playground. Para suporte contínuo e interação com a comunidade, você pode se conectar conosco no canal `#playground` do WordPress Slack ou via GitHub.

<!--
## How to use Playground at Contributor Day
-->

## Como usar o Playground no Dia do Contribuidor

<!--
Now we are going to cover how the Playground can assist you during the Contributor Day. The [WordPress Playground VS Code extension](https://marketplace.visualstudio.com/items?itemName=WordPressPlayground.wordpress-playground) and [@wp-playground/cli](https://www.npmjs.com/package/@wp-playground/cli) streamline the process of setting up a local WordPress environment. WordPress Playground powers both—no Docker, MySQL, or Apache required.
-->

Agora vamos cobrir como o Playground pode ajudá-lo durante o Dia do Contribuidor. A [extensão WordPress Playground para VS Code](https://marketplace.visualstudio.com/items?itemName=WordPressPlayground.wordpress-playground) e [@wp-playground/cli](https://www.npmjs.com/package/@wp-playground/cli) simplificam o processo de configuração de um ambiente WordPress local. O WordPress Playground alimenta ambos—sem necessidade de Docker, MySQL ou Apache.

<!--
Keep reading to learn how to use these tools for [local development](/developers/local-development/wp-playground-cli) when contributing to WordPress. Please note that the extension and the NPM package are under development, and not all [Make WordPress teams](https://make.wordpress.org/) are fully supported.
-->

Continue lendo para aprender como usar essas ferramentas para [desenvolvimento local](/developers/local-development/wp-playground-cli) ao contribuir com o WordPress. Por favor, note que a extensão e o pacote NPM estão em desenvolvimento, e nem todos os [times do Make WordPress](https://make.wordpress.org/) são totalmente suportados.

<!--
## Getting Started
-->

## Começando

<!--
### VS Code Playground extension
-->

### Extensão Playground para VS Code

<!--
The [Visual Studio Code Playground extension](https://marketplace.visualstudio.com/items?itemName=WordPressPlayground.wordpress-playground) is a friendly zero-setup development environment.
-->

A [extensão Playground para Visual Studio Code](https://marketplace.visualstudio.com/items?itemName=WordPressPlayground.wordpress-playground) é um ambiente de desenvolvimento amigável e sem configuração.

<!--
1. Open VS Code and navigate to the **Extensions** tab (**View > Extensions**).
2. In the search bar, type _WordPress Playground_ and click **Install**.
3. To interact with Playground, click the new icon in the **Activity Bar** and hit the **Start WordPress Server** button.
4. A new tab will open in your browser within seconds.
-->

1. Abra o VS Code e navegue até a aba **Extensões** (**Visualizar > Extensões**).
2. Na barra de pesquisa, digite _WordPress Playground_ e clique em **Instalar**.
3. Para interagir com o Playground, clique no novo ícone na **Barra de Atividades** e pressione o botão **Iniciar Servidor WordPress**.
4. Uma nova aba será aberta no seu navegador em segundos.

<!--
### @wp-playground/cli NPM package
-->

### Pacote NPM @wp-playground/cli

<!--
[`@wp-playground/cli`](/developers/local-development/wp-playground-cli) is a CLI tool that allows you to spin up a WordPress site with a single command. No Docker, MySQL, or Apache are required.
-->

[`@wp-playground/cli`](/developers/local-development/wp-playground-cli) é uma ferramenta CLI que permite criar um site WordPress com um único comando. Não é necessário Docker, MySQL ou Apache.

<!--
#### Prerequisites
-->

#### Pré-requisitos

<!--
`@wp-playground/cli` requires Node.js 20.18 or newer and NPM. If you haven't yet, [download and install](https://nodejs.org/en/download) both before you begin.
-->

`@wp-playground/cli` requer Node.js 20.18 ou mais recente e NPM. Se você ainda não fez isso, [baixe e instale](https://nodejs.org/en/download) ambos antes de começar.

<!--
Depending on the Make WordPress team you contribute to, you may need a different Node.js version than the one you have installed. You can use Node Version Manager (NVM) to switch between versions. [Find the installation guide here](https://github.com/nvm-sh/nvm#installing-and-updating).
-->

Dependendo do time do Make WordPress para o qual você contribui, você pode precisar de uma versão diferente do Node.js da que você tem instalada. Você pode usar o Node Version Manager (NVM) para alternar entre versões. [Encontre o guia de instalação aqui](https://github.com/nvm-sh/nvm#installing-and-updating).

<!--
#### Running `@wp-playground/cli`
-->

#### Executando `@wp-playground/cli`

<!--
You don't have to install `@wp-playground/cli` on your device to use it. Navigate to your plugin or theme directory and start `@wp-playground/cli` with the following commands:
-->

Você não precisa instalar `@wp-playground/cli` no seu dispositivo para usá-lo. Navegue até o diretório do seu plugin ou tema e inicie `@wp-playground/cli` com os seguintes comandos:

```bash
cd my-plugin-or-theme-directory
npx @wp-playground/cli@latest server --auto-mount
```

<!--
## Ideas for contributors
-->

## Ideias para contribuidores

<!--
### Create a Gutenberg Pull Request (PR)
-->

### Criar um Pull Request (PR) do Gutenberg

<!--
1. Fork the [Gutenberg repository](https://github.com/WordPress/gutenberg) in your GitHub account.
2. Then, clone the forked repository to download the files.
3. Install the necessary dependencies and build the code in development mode.
-->

1. Faça um fork do [repositório Gutenberg](https://github.com/WordPress/gutenberg) na sua conta GitHub.
2. Então, clone o repositório "forkado" para baixar os arquivos.
3. Instale as dependências necessárias e compile o código em modo de desenvolvimento.

```bash
git clone git@github.com:WordPress/gutenberg.git
cd gutenberg
npm install
npm run dev
```

<!--
:::info

If you're unsure about the steps listed above, visit the official [Gutenberg Project Contributor Guide](https://developer.wordpress.org/block-editor/contributors/). Note that in this case, `@wp-playground/cli` replaces `wp-env`.

:::
-->

:::info

Se você não tiver certeza sobre os passos listados acima, visite o [Guia do Contribuidor do Projeto Gutenberg](https://developer.wordpress.org/block-editor/contributors/) oficial. Note que neste caso, `@wp-playground/cli` substitui `wp-env`.

:::

<!--
Open a new terminal terminal tab, navigate to the Gutenberg directory, and start WordPress using `@wp-playground/cli`:
-->

Abra uma nova aba do terminal, navegue até o diretório Gutenberg e inicie o WordPress usando `@wp-playground/cli`:

```bash
cd gutenberg
npx @wp-playground/cli@latest server --auto-mount
```

<!--
When you're ready, commit and push your changes to your forked repository on GitHub and open a Pull Request on the Gutenberg repository.
-->

Quando estiver pronto, faça commit e push das suas alterações para o seu repositório "forkado" no GitHub e abra um Pull Request no repositório Gutenberg.

<!--
### Test a Gutenberg PR
-->

### Testar um PR do Gutenberg

<!--
1. To test other Gutenberg PRs, checkout the branch associated with it.
2. Pull the latest changes to ensure your local copy is up to date.
3. Next, install the necessary dependencies, ensuring your testing environment matches the latest changes.
4. Finally, build the code in development mode.
-->

1. Para testar outros PRs do Gutenberg, faça checkout para a branch associada a ele.
2. Faça pull das últimas alterações para garantir que sua cópia local esteja atualizada.
3. Em seguida, instale as dependências necessárias, garantindo que seu ambiente de teste corresponda às últimas alterações.
4. Finalmente, compile o código em modo de desenvolvimento.

```bash
# copy the branch-name from GitHub #
git checkout branch-name
git pull
npm install
npm run dev

# In a different terminal inside the Gutenberg directory *
npx @wp-playground/cli@latest server --auto-mount
```

<!--
#### Test a Gutenberg PR with Playground in the browser
-->

#### Testar um PR do Gutenberg com Playground no navegador

<!--
You don't need a [local development environment](/developers/local-development/) to test Gutenberg PRs—use Playground to do it directly in the browser.
-->

Você não precisa de um [ambiente de desenvolvimento local](/developers/local-development/) para testar PRs do Gutenberg—use o Playground para fazer isso diretamente no navegador.

<!--
1. Copy the ID of the PR you'd like to test (pick one from the [list of open Pull Requests](https://github.com/WordPress/gutenberg/pulls)).
2. Open Playground's [Gutenberg PR Previewer](https://playground.wordpress.net/gutenberg.html) and paste the ID you copied.
3. Once you click **Go**, Playground will verify the PR is valid and open a new tab with the relevant PR, allowing you to review the proposed changes.
-->

1. Copie o ID do PR que você gostaria de testar (escolha um da [lista de Pull Requests abertos](https://github.com/WordPress/gutenberg/pulls)).
2. Abra o [Visualizador de PRs do Gutenberg](https://playground.wordpress.net/gutenberg.html) do Playground e cole o ID que você copiou.
3. Assim que você clicar em **Ir**, o Playground verificará se o PR é válido e abrirá uma nova aba com o PR relevante, permitindo que você revise as mudanças propostas.

<!--
## Translate WordPress Plugins with Playground in the browser
-->

## Traduzir Plugins WordPress com Playground no navegador

<!--
You can translate supported WordPress Plugins by loading the plugin you want to translate and use Inline Translation. If the plugin developers have added the option, you'll find the **Translate Live** link on the top right toolbar of the translation view. You can read more about this exciting new option on [this Polyglots blog post](https://make.wordpress.org/polyglots/2023/05/08/translate-live-updates-to-the-translation-playground/).
-->

Você pode traduzir Plugins WordPress suportados carregando o plugin que você deseja traduzir e usar a Tradução Inline. Se os desenvolvedores do plugin adicionaram a opção, você encontrará o link **Traduzir ao Vivo** na barra de ferramentas superior direita da visualização de tradução. Você pode ler mais sobre esta nova e empolgante opção nesta [postagem do blog Polyglots](https://make.wordpress.org/polyglots/2023/05/08/translate-live-updates-to-the-translation-playground/).

<!--
## Get help and contribute to WordPress Playground
-->

## Obtenha ajuda e contribua com o WordPress Playground

<!--
Have a question or an idea for a new feature? Found a bug? Something's not working as expected? We're here to help:
-->

Tem uma pergunta ou uma ideia para um novo recurso? Encontrou um bug? Algo não está funcionando como esperado? Estamos aqui para ajudar:

<!--
-   During Contributor Day, you can reach us at the **Playground table**.
-   Open an issue on the [WordPress Playground GitHub repository](https://github.com/WordPress/wordpress-playground/issues/new). If your focus is the VS Code extension, NPM package, or the plugins, open an issue on the [Playground Tools repository](https://github.com/WordPress/playground-tools/issues/new).
-   Share your feedback on the [**#playground** Slack channel](https://wordpress.slack.com/archives/C04EWKGDJ0K).
-->

-   Durante o Dia do Contribuidor, você pode nos encontrar na **mesa do Playground**.
-   Abra um issue no [repositório GitHub do WordPress Playground](https://github.com/WordPress/wordpress-playground/issues/new). Se seu foco é a extensão VS Code, pacote NPM ou os plugins, abra um issue no [repositório Playground Tools](https://github.com/WordPress/playground-tools/issues/new).
-   Compartilhe seu feedback no [canal Slack **#playground**](https://wordpress.slack.com/archives/C04EWKGDJ0K).
