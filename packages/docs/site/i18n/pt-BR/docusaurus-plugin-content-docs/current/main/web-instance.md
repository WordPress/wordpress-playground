---
title: Instância Web
slug: /web-instance
description: Um guia detalhado da interface web em playground.wordpress.net, incluindo o Dock, as configurações e as ferramentas do Playground.
---

<!-- description: A detailed guide to the web interface at playground.wordpress.net, covering the Dock, settings, and Playground tools. -->

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
The Playground website includes a Dock that opens tools for launching, configuring, inspecting, and exporting your Playground.
-->

O site do Playground inclui um Dock que abre ferramentas para iniciar, configurar, inspecionar e exportar seu Playground.

<!--
![Playground Dock](https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/static/img/dock/dock-overview.webp)
-->

![Dock do Playground](https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/static/img/dock/dock-overview.webp)

<!--
## Customize Playground
-->

## Personalizar Playground

<!--
The Dock includes these destinations:

- **New**: Start from the Blueprint Gallery, a Blueprint URL, a GitHub repository, a pull request, or an imported `.zip` file.
- **Playgrounds**: Switch between recent and saved Playgrounds.
- **Blueprint**: View, edit, export, and run the current Blueprint.
- **Site Settings**: Configure WordPress version, PHP version, language, networking, and multisite.
- **Database**: Inspect the SQLite database and open database tools.
- **Files**: Browse and edit files in the WordPress filesystem.
- **Logs**: Read PHP, WordPress, and Playground runtime messages.
- **Export**: Download a `.zip`, copy the original setup link, or export the current state to GitHub.
-->

O Dock inclui estes destinos:

- **New**: Comece pela galeria de Blueprints, por uma URL de Blueprint, por um repositório GitHub, por um pull request ou por um arquivo `.zip` importado.
- **Playgrounds**: Alterne entre Playgrounds recentes e salvos.
- **Blueprint**: Visualize, edite, exporte e execute o Blueprint atual.
- **Site Settings**: Configure as versões do WordPress e do PHP, o idioma, a rede e o multisite.
- **Database**: Inspecione o banco de dados SQLite e abra as ferramentas de banco de dados.
- **Files**: Navegue e edite arquivos no sistema de arquivos do WordPress.
- **Logs**: Leia mensagens de execução do PHP, do WordPress e do Playground.
- **Export**: Baixe um arquivo `.zip`, copie o link da configuração original ou exporte o estado atual para o GitHub.

<!--
### Site Settings
-->

### Site Settings

<!--
![Site Settings in the Dock](https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/static/img/dock//dock-site-settings.webp)
-->

![Site Settings no Dock](https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/static/img/dock/dock-site-settings.webp)

<!--
The **Site Settings** pane includes these [Query API options](/developers/apis/query-api#available-options):

- `wp`: Defines the WordPress version.
- `php`: Specifies the PHP version for the instance.
- `language`: Sets the WordPress instance language.
- `multisite`: Enables WordPress multisite support.
- `networking`: Enables network access to the WordPress Plugin Directory and WordPress APIs.
-->

O painel **Site Settings** inclui estas [opções da API de Consulta](/developers/apis/query-api#available-options):

- `wp`: Define a versão do WordPress.
- `php`: Especifica a versão do PHP para a instância.
- `language`: Define o idioma da instância WordPress.
- `multisite`: Habilita o suporte ao WordPress multisite.
- `networking`: Habilita o acesso à rede para o Diretório de Plugins do WordPress e APIs do WordPress.

<!--
## Export a Playground {#playground-options-menu}
-->

## Exportar um Playground {#playground-options-menu}

<!--
Open **Export** from the Dock to download or share the current Playground state:

- **Download as .zip**: Saves files, database, and current edits to a `.zip` file that you can re-import later.
- **Copy original setup link**: Copies a URL that rebuilds the Playground from its original Blueprint. It does not include later edits.
- **Export to GitHub**: Pushes the current state, including edits, to a GitHub repository.
-->

Abra **Export** no Dock para baixar ou compartilhar o estado atual do Playground:

- **Download as .zip**: Salva os arquivos, o banco de dados e as edições atuais em um arquivo `.zip` que pode ser importado novamente mais tarde.
- **Copy original setup link**: Copia uma URL que recria o Playground a partir do Blueprint original. Ela não inclui edições posteriores.
- **Export to GitHub**: Envia o estado atual, incluindo as edições, para um repositório GitHub.

<!--
![Export options in the Dock](https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/static/img/dock/dock-export-playground.webp)
-->

![Opções de exportação no Dock](https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/static/img/dock/dock-export-playground.webp)

<!--
### Blueprint pane
-->

### Painel Blueprint

<!--
![Blueprint pane in the Dock](https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/static/img/dock/dock-current-blueprint.webp)
-->

![Painel Blueprint no Dock](https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/static/img/dock/dock-current-blueprint.webp)

<!--
The **Blueprint** pane lets you edit, export, and run the Blueprint for the current Playground.
-->

O painel **Blueprint** permite editar, exportar e executar o Blueprint do Playground atual.

<!--
### New Playground
-->

### Novo Playground

<!--
![New Playground options in the Dock](https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/static/img/dock/dock-new-playground.webp)
-->

![Opções para um novo Playground no Dock](https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/static/img/dock/dock-new-playground.webp)

<!--
The **New** pane shows all the ways to launch WordPress Playground: choose a Blueprint from the gallery, import `.zip` files, load from GitHub repositories, and preview PRs from WordPress core and Gutenberg.

The Blueprint Gallery lists more than 40 blueprints.
-->

O painel **New** mostra todas as formas de iniciar o WordPress Playground: escolher um Blueprint na galeria, importar arquivos `.zip`, carregar repositórios GitHub e visualizar PRs do WordPress core e do Gutenberg.

A galeria de Blueprints lista mais de 40 blueprints.

<!--
<div class="callout callout-warning">

The site at https://playground.wordpress.net is there to support the community, but there are no guarantees it will continue to work if the traffic grows significantly.

If you need certain availability, you should [host your own WordPress Playground](/developers/architecture/host-your-own-playground).

</div>
-->

<div class="callout callout-warning">

O site em https://playground.wordpress.net está lá para apoiar a comunidade, mas não há garantias de que continuará funcionando se o tráfego crescer significativamente.

Se você precisa de certa disponibilidade, deve [hospedar seu próprio WordPress Playground](/developers/architecture/host-your-own-playground).

</div>
