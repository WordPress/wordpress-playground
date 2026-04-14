---
title: Instância Web
slug: /web-instance
description: Um guia detalhado da interface web em playground.wordpress.net, cobrindo a barra de ferramentas, configurações e o gerenciador de instâncias.
---

<!--
# WordPress Playground web instance
-->

# Instância web do WordPress Playground

<!--
[https://playground.wordpress.net/](https://playground.wordpress.net/) lets developers run WordPress in a browser without a server. This environment makes testing plugins, themes, and features quick and easy.
-->

[https://playground.wordpress.net/](https://playground.wordpress.net/) permite que desenvolvedores executem WordPress em um navegador sem um servidor. Este ambiente torna o teste de plugins, temas e recursos rápido e fácil.

<!--
Some key features:

- **Browser-based**: No local server setup required.
- **Instant Setup**: Run WordPress with a single click.
- **Testing Environment**: Ideal for testing plugins and themes.
-->

Algumas características principais:

- **Baseado em navegador**: Não requer configuração de servidor local.
- **Configuração instantânea**: Execute WordPress com um único clique.
- **Ambiente de teste**: Ideal para testar plugins e temas.

<!--
The [Query Params API](/developers/apis/query-api/) allows you to directly load specific configurations into a Playground instance. This includes setting a particular WordPress version, theme, or plugin. You can also define more complex setups using blueprints (see [examples here](/quick-start-guide#try-a-block-a-theme-or-a-plugin)).
-->

A [API de Parâmetros de Consulta](/developers/apis/query-api/) permite carregar diretamente configurações específicas em uma instância do Playground. Isso inclui definir uma versão específica do WordPress, tema ou plugin. Você também pode definir configurações mais complexas usando blueprints (veja [exemplos aqui](/quick-start-guide#try-a-block-a-theme-or-a-plugin)).

<!--
The Playground website includes toolbars that customize your instance and provide quick access to resources and utilities.
-->

O site do Playground inclui barras de ferramentas que personalizam sua instância e fornecem acesso rápido a recursos e utilitários.

![Playground Toolbar Snapshot](https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/static/img/about/playground-toolbar.webp)

<!--
## Customize Playground
-->

## Personalizar Playground

<!--
On the toolbar, you'll find:

- **Playground Settings**: A panel for configuring your current instance, like PHP and WordPress versions.
- **Playground Dashboard**: This panel lets you manage WordPress Playground instances, save and export them, edit files from your WordPress instance, and create new Blueprints.
- **Playground Launch Panel**: The Launch Panel shows all the ways to launch a WordPress Playground instance.
-->

Na barra de ferramentas, você encontrará:

- **Configurações do Playground**: Um painel para configurar sua instância atual, como versões do PHP e WordPress.
- **Painel do Playground**: Este painel permite gerenciar instâncias do WordPress Playground, salvá-las, exportá-las, editar arquivos da sua instância WordPress e criar novos Blueprints.
- **Painel de Lançamento do Playground**: O Painel de Lançamento mostra todas as formas de iniciar uma instância do WordPress Playground.

<!--
### Playground Settings
-->

### Configurações do Playground

![snapshot of customize Playground window at Playground instance](https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/static/img/about/playground-settings-panel.webp)

<!--
The **Playground Settings Panel** includes these [Query API options](/developers/apis/query-api#available-options):

- `wp`: Defines the WordPress version.
- `php`: Specifies the PHP version for the instance.
- `language`: Sets the WordPress instance language.
- `multisite`: Enables WordPress multisite support.
- `networking`: Enables network access to the WordPress Plugin Directory and WordPress APIs.
-->

O **Painel de Configurações do Playground** inclui estas [opções da API de Consulta](/developers/apis/query-api#available-options):

- `wp`: Define a versão do WordPress.
- `php`: Especifica a versão do PHP para a instância.
- `language`: Define o idioma da instância WordPress.
- `multisite`: Habilita o suporte ao WordPress multisite.
- `networking`: Habilita o acesso à rede para o Diretório de Plugins do WordPress e APIs do WordPress.

<!--
## Playground Manager
-->

## Gerenciador do Playground

![Playground settings panel allow users to save export and edit the WordPress directly](https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/static/img/about/playground-dashboard.webp)

<!--
This panel lets you manage Playground instances and provides access to the following panels:

- **Settings**: To manage the current Playground's settings
- **File Browser**: Built-in IDE for editing files, uploading plugins and themes, and live editing. Playground auto-reloads changes in real time.
- **Blueprint**: A Blueprint editor for creating, saving, and running Blueprints in your Playground web instance.
- **Database**: Tools for managing the database with Adminer and phpMyAdmin, and downloading as a `.sqlite` file.
- **Logs**: Displays log messages when something goes wrong.
-->

Este painel permite gerenciar instâncias do Playground e fornece acesso aos seguintes painéis:

- **Configurações**: Para gerenciar as configurações do Playground atual
- **Navegador de Arquivos**: IDE integrada para editar arquivos, fazer upload de plugins e temas, e edição ao vivo. O Playground recarrega automaticamente as alterações em tempo real.
- **Blueprint**: Um editor de Blueprint para criar, salvar e executar Blueprints na sua instância web do Playground.
- **Banco de Dados**: Ferramentas para gerenciar o banco de dados com Adminer e phpMyAdmin, e baixar como arquivo `.sqlite`.
- **Logs**: Exibe mensagens de log quando algo dá errado.

![Save Playground Button](https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/static/img/about/playground-dashboard-save.webp)

<!--
Click "Save" to create an instance and list it in the Playground Launch Panel. The Playground Dashboard also offers export and download options through the Additional actions menu:
-->

Clique em "Salvar" para criar uma instância e listá-la no Painel de Lançamento do Playground. O Painel do Playground também oferece opções de exportação e download através do menu de Ações adicionais:

<!--
### Additional actions menu
-->

### Menu de ações adicionais

![Additional actions Menu](https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/static/img/about/additional-options-playground-dashboard.webp)

<!--
- **Export Pull Request to GitHub**: Export WordPress plugins, themes, and entire wp-content directories as pull requests to any public GitHub repository. Watch a [demo of this feature](https://www.youtube.com/watch?v=gKrij8V3nK0&t=2488s).
- **Download as .zip**: Creates a `.zip` file with the setup of the Playground instance, including any themes or plugins installed. This `.zip` excludes content and database changes.
-->

- **Exportar Pull Request para GitHub**: Exporte plugins WordPress, temas e diretórios wp-content inteiros como pull requests para qualquer repositório GitHub público. Assista a uma [demonstração desta funcionalidade](https://www.youtube.com/watch?v=gKrij8V3nK0&t=2488s).
- **Baixar como .zip**: Cria um arquivo `.zip` com a configuração da instância do Playground, incluindo quaisquer temas ou plugins instalados. Este `.zip` não inclui conteúdo e alterações do banco de dados.

<!--
### Blueprint Editor
-->

### Editor de Blueprint

![Blueprint editor WordPress Playground](https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/static/img/about/playground-blueprint-editor.webp)

<!--
The Blueprint editor replaced the older Blueprint builder, offering the ability to manage multiple Blueprints and code validation.
-->

O editor de Blueprint substituiu o antigo construtor de Blueprint, oferecendo a capacidade de gerenciar múltiplos Blueprints e validação de código.

<!--
### Launch Playground Panel
-->

### Painel de Lançamento do Playground

![Playground Launch Panel](https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/static/img/dashboard/import-playground.webp)

<!--
This panel shows all the ways to launch WordPress Playground: import `.zip` files, load from GitHub repositories, and preview PRs from WordPress core and Gutenberg.

The Launch Panel also lists more than 40 blueprints from the Blueprint Gallery and your Saved Playgrounds.
-->

Este painel mostra todas as formas de lançar o WordPress Playground: importar arquivos `.zip`, carregar de repositórios GitHub e visualizar PRs do WordPress core e Gutenberg.

O Painel de Lançamento também lista mais de 40 blueprints da Galeria de Blueprints e seus Playgrounds Salvos.

<!--
:::caution

The site at https://playground.wordpress.net is there to support the community, but there are no guarantees it will continue to work if the traffic grows significantly.

If you need certain availability, you should [host your own WordPress Playground](/developers/architecture/host-your-own-playground).
:::
-->

:::caution

O site em https://playground.wordpress.net está lá para apoiar a comunidade, mas não há garantias de que continuará funcionando se o tráfego crescer significativamente.

Se você precisa de certa disponibilidade, deve [hospedar seu próprio WordPress Playground](/developers/architecture/host-your-own-playground).
:::
