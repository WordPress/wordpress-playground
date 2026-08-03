---
title: Instância web
slug: /web-instance
description: Um guia detalhado da interface web em playground.wordpress.net, incluindo o Dock, persistência, configurações e ferramentas do site.
---

<!--
# WordPress Playground web instance
-->

# Instância web do WordPress Playground

<!--
[https://playground.wordpress.net/](https://playground.wordpress.net/) runs
WordPress in your browser without a server. The page opens a Playground, shows
the WordPress site, and keeps the site tools in the **Dock**.
-->

O [https://playground.wordpress.net/](https://playground.wordpress.net/) executa o WordPress no navegador sem um servidor. A página abre um Playground, mostra o site WordPress e mantém as ferramentas do site no **Dock**.

<!--
![The Playground web instance with the Dock visible at the bottom of the page](https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/static/img/dock/dock-overview.webp)
-->

![A instância web do Playground com o Dock visível na parte inferior da página](https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/static/img/dock/dock-overview.webp)

<!--
The Dock has an address field, a save status, layout controls, and destinations for creating, storing, inspecting, and exporting Playgrounds.
-->

O Dock tem um campo de endereço, o status de salvamento, controles de layout e destinos para criar, armazenar, inspecionar e exportar Playgrounds.

<!--
## Customize Playground
-->

## Personalizar o Playground

<!--
The Dock includes these destinations:
-->

O Dock inclui estes destinos:

<!--
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

- **Novo**: comece pela galeria de Blueprints, por uma URL pública de Blueprint, por um novo Blueprint, pela pré-visualização de um pull request, por um repositório do GitHub ou por um arquivo `.zip` importado.
- **Playgrounds**: alterne entre Playgrounds recentes e salvos.
- **Blueprint**: visualize, edite, exporte e execute o Blueprint atual.
- **Configurações do site**: configure as versões do WordPress e do PHP, o idioma, o acesso à rede e a rede multisite.
- **Banco de dados**: inspecione ou baixe o banco de dados SQLite e abra ferramentas de banco de dados.
- **Arquivos**: navegue e edite arquivos no sistema de arquivos do WordPress.
- **Registros**: inspecione erros, alertas e avisos do PHP.
- **Exportar**: baixe um `.zip`, copie o link da configuração original ou exporte arquivos selecionados para um pull request no GitHub.

<!--
## Navigate inside WordPress
-->

## Navegar no WordPress

<!--
Use the Dock address field to open a path inside the current WordPress site.
For example, enter `/wp-admin/` to open the dashboard or
`/wp-admin/plugins.php` to open the Plugins screen. **Refresh page** reloads
the current WordPress path.
-->

Use o campo de endereço do Dock para abrir um caminho no site WordPress atual. Por exemplo, digite `/wp-admin/` para abrir o painel ou `/wp-admin/plugins.php` para abrir a tela de plugins. **Atualizar página** recarrega o caminho atual do WordPress.

<!--
![The Refresh page button in the Dock](https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/static/img/refresh-playground-button.webp)
-->

![O botão Atualizar página no Dock](https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/static/img/refresh-playground-button.webp)

<!--
You can also use the [Query Params API](/developers/apis/query-api/) to open Playground with a specific setup, such as a WordPress version, PHP version, plugin, theme, or Blueprint.
-->

Você também pode usar a [API de parâmetros de consulta](/developers/apis/query-api/) para abrir o Playground com uma configuração específica, como uma versão do WordPress ou do PHP, um plugin, um tema ou um Blueprint.

<!--
## Understand the save status
-->

## Entender o status de salvamento

<!--
The status next to the address field tells you how the current Playground is stored:
-->

O status ao lado do campo de endereço informa como o Playground atual está armazenado:

<!--
- **Autosaved** means the Playground is stored in this browser and can be recovered from **Your Playgrounds**. Playground keeps up to five recent autosaves.
- **Saved** means the Playground was stored permanently in browser storage or saved to a local directory.
- **Unsaved** means the Playground has not been saved. Temporary Playgrounds, including `?storage=temp`, are lost when the tab is closed or refreshed.
-->

- **Salvo automaticamente** significa que o Playground está armazenado neste navegador e pode ser recuperado em **Seus Playgrounds**. O Playground mantém até cinco salvamentos automáticos recentes.
- **Salvo** significa que o Playground foi armazenado permanentemente no armazenamento do navegador ou salvo em uma pasta local.
- **Não salvo** significa que o Playground ainda não foi salvo. Playgrounds temporários, incluindo os abertos com `?storage=temp`, são perdidos quando a aba é fechada ou atualizada.

<!--
Click **Autosaved** or **Unsaved** to open **Store permanently**.
-->

Clique em **Salvo automaticamente** ou **Não salvo** para abrir **Armazenar permanentemente**.

<!--
![The Store permanently pane with a Playground name and the Save button](https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/static/img/saving-playground.webp)
-->

![O painel Armazenar permanentemente com o nome do Playground e o botão Salvar](https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/static/img/saving-playground.webp)

<!--
Store permanently can keep an autosaved Playground in browser storage so autosave pruning no longer removes it. In browsers that support the File System Access API, it can also save the Playground to a local directory.
-->

**Armazenar permanentemente** pode manter um Playground salvo automaticamente no armazenamento do navegador para que a remoção de salvamentos automáticos mais antigos não o exclua. Em navegadores compatíveis com a File System Access API, também é possível salvar o Playground em uma pasta local.

<!--
Browser storage still belongs to the browser. The browser may remove stored data when storage pressure or privacy settings require it. Export a ZIP when you need a portable backup.
-->

O armazenamento do navegador ainda pertence ao navegador. O navegador pode remover os dados armazenados devido a limitações de espaço ou configurações de privacidade. Exporte um ZIP quando precisar de um backup que possa ser transportado.

<!--
## Start a Playground
-->

## Iniciar um Playground

<!--
Open **New Playground** from the Dock by clicking **New**. The pane contains
**Blueprint gallery**, **From a URL**, **Write a Blueprint**, **Preview a PR**,
**From GitHub**, and **Import zip**.
-->

Clique em **Novo** no Dock para abrir **Novo Playground**. O painel contém **Galeria de Blueprints**, **De uma URL**, **Escrever um Blueprint**, **Pré-visualizar um PR**, **Do GitHub** e **Importar zip**.

<!--
![The New Playground pane with the Blueprint gallery selected](https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/static/img/dock/dock-new-playground.webp)
-->

![O painel Novo Playground com a galeria de Blueprints selecionada](https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/static/img/dock/dock-new-playground.webp)

<!--
The Blueprint gallery starts with **Vanilla WordPress**, which creates a clean
WordPress install. **From a URL** opens a public Blueprint URL. **Write a
Blueprint** opens an editor for a new Blueprint. **Import zip** restores a ZIP
exported from Playground.
-->

A galeria de Blueprints começa com o **Vanilla WordPress**, que cria uma instalação limpa do WordPress. **De uma URL** abre uma URL pública de Blueprint. **Escrever um Blueprint** abre um editor para um novo Blueprint. **Importar zip** restaura um ZIP exportado do Playground.

<!--
![The New Playground pane with Import zip selected](https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/static/img/dock/dock-new-playground-import-zip.webp)
-->

![O painel Novo Playground com Importar zip selecionado](https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/static/img/dock/dock-new-playground-import-zip.webp)

<!--
## Return to recent and saved Playgrounds
-->

## Voltar a Playgrounds recentes e salvos

<!--
Open **Your Playgrounds** from the Dock by clicking **Playgrounds**. It lists the current Playground, recent autosaves, and Playgrounds you saved permanently.
-->

Clique em **Playgrounds** no Dock para abrir **Seus Playgrounds**. A lista mostra o Playground atual, salvamentos automáticos recentes e Playgrounds armazenados permanentemente.

<!--
![The Your Playgrounds pane with the current Playground](https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/static/img/dock/your-playgrounds.webp)
-->

![O painel Seus Playgrounds com o Playground atual](https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/static/img/dock/your-playgrounds.webp)

<!--
Autosaved Playgrounds are recovery points. Playground retains up to five recent
autosaves. Use **Store permanently** to keep one as a saved Playground.
-->

Os Playgrounds salvos automaticamente são pontos de recuperação. O Playground mantém até cinco salvamentos automáticos recentes. Use **Armazenar permanentemente** para manter um deles como Playground salvo.

<!--
## Change site settings
-->

## Alterar as configurações do site

<!--
Open **Site Settings** to change runtime and WordPress setup options.
-->

Abra **Configurações do site** para alterar as opções do ambiente de execução e da configuração do WordPress.

<!--
![The Site Settings pane](https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/static/img/dock/dock-site-settings.webp)
-->

![O painel Configurações do site](https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/static/img/dock/dock-site-settings.webp)

<!--
PHP version and networking can be applied to an existing stored Playground. WordPress version, language, and multisite change the WordPress installation itself, so they require a fresh Playground.
-->

A versão do PHP e o acesso à rede podem ser aplicados a um Playground armazenado. A versão do WordPress, o idioma e a rede multisite alteram a própria instalação do WordPress e, portanto, exigem um Playground novo.

<!--
Running an edited Blueprint keeps stored and autosaved Playgrounds. It discards a temporary Playground because the new run starts from a fresh setup.
-->

A execução de um Blueprint editado mantém os Playgrounds salvos e salvos automaticamente. Ela descarta um Playground temporário porque a nova execução parte de uma configuração limpa.

<!--
## Inspect the current Blueprint
-->

## Inspecionar o Blueprint atual

<!--
Open **Blueprint** to view and edit the Blueprint for the current Playground.
-->

Abra **Blueprint** para visualizar e editar o Blueprint do Playground atual.

<!--
![The Blueprint editor pane](https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/static/img/dock/dock-current-blueprint.webp)
-->

![O painel do editor de Blueprint](https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/static/img/dock/dock-current-blueprint.webp)

<!--
The editor can run the edited Blueprint in a new Playground. For a stored or autosaved Playground, the original Playground remains available in **Your Playgrounds**.
-->

O editor pode executar o Blueprint editado em um novo Playground. Para um Playground salvo ou salvo automaticamente, o Playground original continua disponível em **Seus Playgrounds**.

<!--
## Inspect files, database, and logs
-->

## Inspecionar arquivos, banco de dados e registros

<!--
Open **Files** to browse and edit the current Playground files.
-->

Abra **Arquivos** para navegar e editar os arquivos do Playground atual.

<!--
![The Files pane with a WordPress file selected](https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/static/img/dock/files.webp)
-->

![O painel Arquivos com um arquivo do WordPress selecionado](https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/static/img/dock/files.webp)

<!--
Open **Database** to use database tools or download the SQLite database.
-->

Abra **Banco de dados** para usar ferramentas de banco de dados ou baixar o banco de dados SQLite.

<!--
![The Database pane](https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/static/img/dock/database.webp)
-->

![O painel Banco de dados](https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/static/img/dock/database.webp)

<!--
Open **Logs** to inspect PHP errors, warnings, and notices.
-->

Abra **Registros** para inspecionar erros, alertas e avisos do PHP.

<!--
![The PHP error log pane](https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/static/img/dock/logs.webp)
-->

![O painel de registros de erros do PHP](https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/static/img/dock/logs.webp)

<!--
## Export and share {#playground-options-menu}
-->

## Exportar e compartilhar {#playground-options-menu}

<!--
Open **Export** to download or share the current Playground.
-->

Abra **Exportar** para baixar ou compartilhar o Playground atual.

<!--
![The Export pane with Download as .zip highlighted](https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/static/img/export-playground.webp)
-->

![O painel Exportar com Baixar como .zip destacado](https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/static/img/export-playground.webp)

<!--
**Download as .zip** exports the current files, database, plugins, themes, uploads, and edits. The ZIP can be restored later with **New → Import zip**.
-->

**Baixar como .zip** exporta os arquivos, o banco de dados, os plugins, os temas, os arquivos enviados e as edições atuais. O ZIP pode ser restaurado depois com **Novo → Importar zip**.

<!--
**Copy original setup link** copies a link that recreates only the original
setup. It does not include edits made after the Playground started.
-->

**Copiar link da configuração original** copia um link que recria apenas a configuração original. Ele não inclui as edições feitas depois que o Playground foi iniciado.

<!--
**Export to GitHub** can create a pull request with selected files from the current Playground.
-->

**Exportar para o GitHub** pode criar um pull request com arquivos selecionados do Playground atual.

<!--
## Change the Dock layout
-->

## Alterar o layout do Dock

<!--
The Dock can be shown as a floating panel or full-width bar. Use **Full width** to switch layouts.
-->

O Dock pode ser exibido como um painel flutuante ou uma barra de largura total. Use **Largura total** para alternar entre os layouts.

<!--
| Floating                                                   | Full width                                                    |
| ---------------------------------------------------------- | ------------------------------------------------------------- |
| ![The default floating Dock](https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/static/img/dock/dock-overview.webp) | ![The full-width Dock layout](https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/static/img/dock/dock-full-width.webp) |
-->

| Flutuante                                                                                                                                                           | Largura total                                                                                                                                                                   |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ![O Dock flutuante padrão](https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/static/img/dock/dock-overview.webp) | ![O layout do Dock em largura total](https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/static/img/dock/dock-full-width.webp) |

<!--
Use **Hide tools** to collapse the Dock to its address field and save status.
Use **Show tools** to reopen the tool row.
-->

Use **Ocultar ferramentas** para recolher o Dock e mostrar apenas o campo de endereço e o status de salvamento. Use **Mostrar ferramentas** para reabrir a linha de ferramentas.

<!--
![The Playground with Dock tools hidden](https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/static/img/dock/dock-hidden-tools.webp)
-->

![O Playground com as ferramentas do Dock ocultas](https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/static/img/dock/dock-hidden-tools.webp)

<!--
You can drag the floating Dock on desktop. Drag it past the left or right edge
to fold it into a corner launcher, then click the launcher to restore the Dock.
-->

Em computadores, você pode arrastar o Dock flutuante. Arraste-o além da borda esquerda ou direita para recolhê-lo em um iniciador no canto. Depois, clique no iniciador para restaurar o Dock.

<!--
![The Dock folded into the corner launcher](https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/static/img/dock/dock-corner-launcher.webp)
-->

![O Dock recolhido no iniciador de canto](https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/static/img/dock/dock-corner-launcher.webp)

<!--
On narrow screens, the Dock uses a full-width mobile layout.
-->

Em telas estreitas, o Dock usa um layout móvel de largura total.

<!--
![The Dock on a mobile viewport](https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/static/img/dock/dock-mobile.webp)
-->

![O Dock em uma tela de dispositivo móvel](https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/static/img/dock/dock-mobile.webp)

<div class="callout callout-warning">

<!--
The site at https://playground.wordpress.net is there to support the community, but there are no guarantees it will continue to work if the traffic grows significantly.
-->

O site https://playground.wordpress.net está disponível para apoiar a comunidade, mas não há garantia de que continuará funcionando se o tráfego aumentar significativamente.

<!--
If you need certain availability, you should [host your own WordPress Playground](/developers/architecture/host-your-own-playground).
-->

Se você precisa de disponibilidade garantida, [hospede seu próprio WordPress Playground](/developers/architecture/host-your-own-playground).

</div>
