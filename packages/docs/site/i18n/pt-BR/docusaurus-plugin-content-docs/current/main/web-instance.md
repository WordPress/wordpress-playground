---
title: Instância Web
slug: /web-instance
description: Um guia detalhado da interface web em playground.wordpress.net, incluindo o Dock, a persistência, as configurações e as ferramentas do site.
---

<!-- description: A detailed guide to the web interface at playground.wordpress.net, covering the Dock, persistence, settings, and site tools. -->

<!--
# WordPress Playground web instance
-->

# Instância web do WordPress Playground

<!--
[https://playground.wordpress.net/](https://playground.wordpress.net/) runs
WordPress in your browser without a server. The page opens a Playground, shows
the WordPress site, and keeps the site tools in the **Dock**.

![The Playground web instance with the Dock visible at the bottom of the page](/img/dock/dock-overview.webp)
-->

[https://playground.wordpress.net/](https://playground.wordpress.net/) executa o
WordPress no seu navegador sem um servidor. A página abre um Playground, mostra
o site WordPress e mantém as ferramentas do site no **Dock**.

![A instância web do Playground com o Dock visível na parte inferior da página](https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/static/img/dock/dock-overview.webp)

<!--
The Dock has an address field, a save status, layout controls, and destinations for creating, storing, inspecting, and exporting Playgrounds.
-->

O Dock tem um campo de endereço, um status de salvamento, controles de layout e destinos para criar, armazenar, inspecionar e exportar Playgrounds.

<!--
## Customize Playground
-->

## Personalizar Playground

<!--
The Dock includes these destinations:

- **New**: Start from the Blueprint gallery, a public Blueprint URL, a new
  Blueprint, a pull request preview, a GitHub repository, or an imported `.zip`
  file.
- **Playgrounds**: Switch between recent and saved Playgrounds.
- **Blueprint**: View, edit, export, and run the current Blueprint.
- **Site Settings**: Configure WordPress version, PHP version, language,
  networking, and multisite.
- **Database**: Inspect or download the SQLite database and open database tools.
- **Files**: Browse and edit files in the WordPress filesystem.
- **Logs**: Inspect PHP errors, warnings, and notices.
- **Export**: Download a `.zip`, copy the original setup link, or export selected
  files to a GitHub pull request.
-->

O Dock inclui estes destinos:

- **New**: Comece pela galeria de Blueprints, por uma URL pública de Blueprint,
  por um novo Blueprint, pela prévia de um pull request, por um repositório
  GitHub ou por um arquivo `.zip` importado.
- **Playgrounds**: Alterne entre Playgrounds recentes e salvos.
- **Blueprint**: Visualize, edite, exporte e execute o Blueprint atual.
- **Site Settings**: Configure a versão do WordPress, a versão do PHP, o idioma,
  a rede e o multisite.
- **Database**: Inspecione ou baixe o banco de dados SQLite e abra as
  ferramentas de banco de dados.
- **Files**: Navegue e edite arquivos no sistema de arquivos do WordPress.
- **Logs**: Inspecione erros, avisos e notificações do PHP.
- **Export**: Baixe um arquivo `.zip`, copie o link da configuração original ou
  exporte arquivos selecionados para um pull request no GitHub.

<!--
## Navigate inside WordPress
-->

## Navegar dentro do WordPress

<!--
Use the Dock address field to open a path inside the current WordPress site.
For example, enter `/wp-admin/` to open the dashboard or
`/wp-admin/plugins.php` to open the Plugins screen. **Refresh page** reloads
the current WordPress path.
-->

Use o campo de endereço do Dock para abrir um caminho dentro do site WordPress
atual. Por exemplo, digite `/wp-admin/` para abrir o painel ou
`/wp-admin/plugins.php` para abrir a tela de Plugins. **Refresh page** recarrega
o caminho atual do WordPress.

<!--
You can also use the [Query Params API](/developers/apis/query-api/) to open Playground with a specific setup, such as a WordPress version, PHP version, plugin, theme, or Blueprint.
-->

Você também pode usar a [API de Parâmetros de Consulta](/developers/apis/query-api/) para abrir o Playground com uma configuração específica, como uma versão do WordPress, uma versão do PHP, um plugin, um tema ou um Blueprint.

<!--
## Understand the save status
-->

## Entender o status de salvamento

<!--
The status next to the address field tells you how the current Playground is stored:

- **Autosaved** means the Playground is stored in this browser and can be recovered from **Your Playgrounds**. Playground keeps up to five recent autosaves.
- **Saved** means the Playground was stored permanently in browser storage or saved to a local directory.
- **Unsaved** means the Playground has not been saved. Temporary Playgrounds, including `?storage=temp`, are lost when the tab is closed or refreshed.
-->

O status ao lado do campo de endereço informa como o Playground atual está armazenado:

- **Autosaved** significa que o Playground está armazenado neste navegador e pode ser recuperado em **Your Playgrounds**. O Playground mantém até cinco salvamentos automáticos recentes.
- **Saved** significa que o Playground foi armazenado permanentemente no armazenamento do navegador ou salvo em um diretório local.
- **Unsaved** significa que o Playground não foi salvo. Playgrounds temporários, incluindo `?storage=temp`, são perdidos quando a aba é fechada ou atualizada.

<!--
Click **Autosaved** or **Unsaved** to open **Store permanently**.

![The Store permanently pane with browser storage selected](/img/dock/store-permanently-browser.webp)
-->

Clique em **Autosaved** ou **Unsaved** para abrir **Store permanently**.

![O painel Store permanently com o armazenamento do navegador selecionado](https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/static/img/dock/store-permanently-browser.webp)

<!--
Store permanently can keep an autosaved Playground in browser storage so autosave pruning no longer removes it. In browsers that support the File System Access API, it can also save the Playground to a local directory.
-->

O **Store permanently** pode manter um Playground salvo automaticamente no armazenamento do navegador, para que a limpeza dos salvamentos automáticos não o remova mais. Em navegadores com suporte à File System Access API, ele também pode salvar o Playground em um diretório local.

<!--
Browser storage still belongs to the browser. The browser may remove stored data when storage pressure or privacy settings require it. Export a ZIP when you need a portable backup.
-->

O armazenamento do navegador continua pertencendo ao navegador. O navegador pode remover os dados armazenados quando houver falta de espaço ou quando as configurações de privacidade exigirem. Exporte um ZIP quando precisar de um backup portátil.

<!--
## Start a Playground
-->

## Iniciar um Playground

<!--
Open **New Playground** from the Dock by clicking **New**. The pane contains
**Blueprint gallery**, **From a URL**, **Write a Blueprint**, **Preview a PR**,
**From GitHub**, and **Import zip**.

![The New Playground pane with the Blueprint gallery selected](/img/dock/dock-new-playground.webp)
-->

Abra **New Playground** no Dock clicando em **New**. O painel contém
**Blueprint gallery**, **From a URL**, **Write a Blueprint**, **Preview a PR**,
**From GitHub** e **Import zip**.

![O painel New Playground com a Blueprint gallery selecionada](https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/static/img/dock/dock-new-playground.webp)

<!--
The Blueprint gallery starts with **Vanilla WordPress**, which creates a clean
WordPress install. **From a URL** opens a public Blueprint URL. **Write a
Blueprint** opens an editor for a new Blueprint. **Import zip** restores a ZIP
exported from Playground.

![The New Playground pane with Import zip selected](/img/dock/dock-new-playground-import-zip.webp)
-->

A galeria de Blueprints começa com **Vanilla WordPress**, que cria uma
instalação limpa do WordPress. **From a URL** abre uma URL pública de Blueprint.
**Write a Blueprint** abre um editor para um novo Blueprint. **Import zip**
restaura um ZIP exportado do Playground.

![O painel New Playground com Import zip selecionado](https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/static/img/dock/dock-new-playground-import-zip.webp)

<!--
## Return to recent and saved Playgrounds
-->

## Voltar aos Playgrounds recentes e salvos

<!--
Open **Your Playgrounds** from the Dock by clicking **Playgrounds**. It lists the current Playground, recent autosaves, and Playgrounds you saved permanently.

![The Your Playgrounds pane with the current Playground](/img/dock/your-playgrounds.webp)
-->

Abra **Your Playgrounds** no Dock clicando em **Playgrounds**. O painel lista o Playground atual, os salvamentos automáticos recentes e os Playgrounds que você salvou permanentemente.

![O painel Your Playgrounds com o Playground atual](https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/static/img/dock/your-playgrounds.webp)

<!--
Autosaved Playgrounds are recovery points. Playground retains up to five recent
autosaves. Use **Store permanently** to keep one as a saved Playground.
-->

Playgrounds salvos automaticamente são pontos de recuperação. O Playground
mantém até cinco salvamentos automáticos recentes. Use **Store permanently**
para manter um deles como Playground salvo.

<!--
## Change site settings
-->

## Alterar as configurações do site

<!--
Open **Site Settings** to change runtime and WordPress setup options.

![The Site Settings pane](/img/dock/dock-site-settings.webp)
-->

Abra **Site Settings** para alterar as opções de execução e de configuração do WordPress.

![O painel Site Settings](https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/static/img/dock/dock-site-settings.webp)

<!--
PHP version and networking can be applied to an existing stored Playground. WordPress version, language, and multisite change the WordPress installation itself, so they require a fresh Playground.
-->

A versão do PHP e a rede podem ser aplicadas a um Playground já armazenado. A versão do WordPress, o idioma e o multisite alteram a própria instalação do WordPress, por isso exigem um Playground novo.

<!--
Running an edited Blueprint keeps stored and autosaved Playgrounds. It discards a temporary Playground because the new run starts from a fresh setup.
-->

Executar um Blueprint editado mantém os Playgrounds armazenados e salvos automaticamente. Um Playground temporário é descartado, porque a nova execução começa de uma configuração nova.

<!--
## Inspect the current Blueprint
-->

## Inspecionar o Blueprint atual

<!--
Open **Blueprint** to view and edit the Blueprint for the current Playground.

![The Blueprint editor pane](/img/dock/dock-current-blueprint.webp)
-->

Abra **Blueprint** para visualizar e editar o Blueprint do Playground atual.

![O painel do editor de Blueprint](https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/static/img/dock/dock-current-blueprint.webp)

<!--
The editor can run the edited Blueprint in a new Playground. For a stored or autosaved Playground, the original Playground remains available in **Your Playgrounds**.
-->

O editor pode executar o Blueprint editado em um novo Playground. Para um Playground armazenado ou salvo automaticamente, o Playground original continua disponível em **Your Playgrounds**.

<!--
## Inspect files, database, and logs
-->

## Inspecionar arquivos, banco de dados e logs

<!--
Open **Files** to browse and edit the current Playground files.

![The Files pane with a WordPress file selected](/img/dock/files.webp)
-->

Abra **Files** para navegar e editar os arquivos do Playground atual.

![O painel Files com um arquivo do WordPress selecionado](https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/static/img/dock/files.webp)

<!--
Open **Database** to use database tools or download the SQLite database.

![The Database pane](/img/dock/database.webp)
-->

Abra **Database** para usar as ferramentas de banco de dados ou baixar o banco de dados SQLite.

![O painel Database](https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/static/img/dock/database.webp)

<!--
Open **Logs** to inspect PHP errors, warnings, and notices.

![The PHP error log pane](/img/dock/logs.webp)
-->

Abra **Logs** para inspecionar erros, avisos e notificações do PHP.

![O painel de log de erros do PHP](https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/static/img/dock/logs.webp)

<!--
## Export and share {#playground-options-menu}
-->

## Exportar e compartilhar {#playground-options-menu}

<!--
Open **Export** to download or share the current Playground.

![The Export pane](/img/dock/dock-export-playground.webp)
-->

Abra **Export** para baixar ou compartilhar o Playground atual.

![O painel Export](https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/static/img/dock/dock-export-playground.webp)

<!--
**Download as .zip** exports the current files, database, plugins, themes, uploads, and edits. The ZIP can be restored later with **New → Import zip**.
-->

**Download as .zip** exporta os arquivos atuais, o banco de dados, plugins, temas, uploads e edições. O ZIP pode ser restaurado mais tarde com **New → Import zip**.

<!--
**Copy original setup link** copies a link that recreates only the original
setup. It does not include edits made after the Playground started.
-->

**Copy original setup link** copia um link que recria apenas a configuração
original. Ele não inclui as edições feitas depois que o Playground foi iniciado.

<!--
**Export to GitHub** can create a pull request with selected files from the current Playground.
-->

**Export to GitHub** pode criar um pull request com arquivos selecionados do Playground atual.

<!--
## Change the Dock layout
-->

## Alterar o layout do Dock

<!--
The Dock can be shown as a floating panel or full-width bar. Use **Full width** to switch layouts.

| Floating                                                   | Full width                                                    |
| ---------------------------------------------------------- | ------------------------------------------------------------- |
| ![The default floating Dock](/img/dock/dock-overview.webp) | ![The full-width Dock layout](/img/dock/dock-full-width.webp) |
-->

O Dock pode ser exibido como um painel flutuante ou como uma barra de largura total. Use **Full width** para alternar entre os layouts.

| Flutuante                                                                                                                                                           | Largura total                                                                                                                                                                   |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ![O Dock flutuante padrão](https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/static/img/dock/dock-overview.webp) | ![O layout do Dock em largura total](https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/static/img/dock/dock-full-width.webp) |

<!--
Use **Hide tools** to collapse the Dock to its address field and save status.
Use **Show tools** to reopen the tool row.

![The Playground with Dock tools hidden](/img/dock/dock-hidden-tools.webp)
-->

Use **Hide tools** para recolher o Dock ao campo de endereço e ao status de
salvamento. Use **Show tools** para reabrir a linha de ferramentas.

![O Playground com as ferramentas do Dock ocultas](https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/static/img/dock/dock-hidden-tools.webp)

<!--
You can drag the floating Dock on desktop. Drag it past the left or right edge
to fold it into a corner launcher, then click the launcher to restore the Dock.

![The Dock folded into the corner launcher](/img/dock/dock-corner-launcher.webp)
-->

No desktop, você pode arrastar o Dock flutuante. Arraste-o além da borda
esquerda ou direita para recolhê-lo em um atalho no canto e clique no atalho
para restaurar o Dock.

![O Dock recolhido no atalho do canto](https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/static/img/dock/dock-corner-launcher.webp)

<!--
On narrow screens, the Dock uses a full-width mobile layout.

![The Dock on a mobile viewport](/img/dock/dock-mobile.webp)
-->

Em telas estreitas, o Dock usa um layout móvel de largura total.

![O Dock em uma tela de celular](https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/static/img/dock/dock-mobile.webp)

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
