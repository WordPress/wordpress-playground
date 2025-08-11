---
title: Playground web instance
slug: /web-instance
---

<!--
# WordPress Playground web instance

[https://playground.wordpress.net/](https://playground.wordpress.net/) is a versatile web tool that allows developers to run WordPress in a browser without needing a server. This environment is particularly useful for testing plugins, themes, and other WordPress features quickly and efficiently.

Some key features:

-   **Browser-based**: No local server setup required.
-   **Instant Setup**: Run WordPress with a single click.
-   **Testing Environment**: Ideal for testing plugins and themes.

The [Query Params API](/developers/apis/query-api/) allows you to directly load specific configurations into a Playground instance. This includes setting a particular WordPress version, theme, or plugin. You can also define more complex setups using blueprints (see [examples here](/quick-start-guide#try-a-block-a-theme-or-a-plugin)).

From the Playground website, some toolbars are also available to customize your Playground instance and provide quick access to some resources and utilities.
-->

# Instância web do WordPress Playground

[https://playground.wordpress.net/](https://playground.wordpress.net/) é uma ferramenta web versátil que permite aos desenvolvedores executar WordPress em um navegador sem precisar de um servidor. Este ambiente é particularmente útil para testar plugins, temas e outros recursos do WordPress de forma rápida e eficiente.

Algumas características principais:

-   **Baseado em navegador**: Não requer configuração de servidor local.
-   **Configuração instantânea**: Execute WordPress com um único clique.
-   **Ambiente de teste**: Ideal para testar plugins e temas.

A [API de Parâmetros de Consulta](/developers/apis/query-api/) permite carregar diretamente configurações específicas em uma instância do Playground. Isso inclui definir uma versão específica do WordPress, tema ou plugin. Você também pode definir configurações mais complexas usando blueprints (veja [exemplos aqui](/quick-start-guide#try-a-block-a-theme-or-a-plugin)).

No site do Playground, algumas barras de ferramentas também estão disponíveis para personalizar sua instância do Playground e fornecer acesso rápido a alguns recursos e utilitários.

<!--
![Playground Toolbar Snapshot](@site/static/img/about/toolbar-playground.webp)
-->

![Captura da Barra de Ferramentas do Playground](@site/static/img/about/toolbar-playground.webp)

<!--
## Customize Playground

On the toolbar, you'll find:

-   **Playground Settings**: A panel for configuring your current instance, like PHP and WordPress versions.
-   **Playground Manager**: This panel lets you manage WordPress Playground instances, allowing you to save, import, and export them.
-->

## Personalizar Playground

Na barra de ferramentas, você encontrará:

-   **Configurações do Playground**: Um painel para configurar sua instância atual, como versões do PHP e WordPress.
-   **Gerenciador do Playground**: Este painel permite gerenciar instâncias do WordPress Playground, permitindo salvar, importar e exportá-las.

<!--
### Playground Settings

![snapshot of customize Playground window at Playground instance](@site/static/img/about/playground-settings-panel.webp)

The options available from the **Playground Settings Panel**, correspond to the following [Query API options](/developers/apis/query-api#available-options):

-   `language`: Sets the WordPress instance language.
-   `multisite`: Enables WordPress multisite support.
-   `networking`: Grants network access, allowing fetches from the WordPress plugin directory and internal WordPress APIs.
-   `php`: Specifies the PHP version for the instance.
-   `wp`: Defines the WordPress version.
-->

### Configurações do Playground

![captura da janela de personalizar Playground na instância do Playground](@site/static/img/about/playground-settings-panel.webp)

As opções disponíveis no **Painel de Configurações do Playground** correspondem às seguintes [opções da API de Consulta](/developers/apis/query-api#available-options):

-   `language`: Define o idioma da instância WordPress.
-   `multisite`: Habilita o suporte ao WordPress multisite.
-   `networking`: Concede acesso à rede, permitindo buscas do diretório de plugins do WordPress e APIs internas do WordPress.
-   `php`: Especifica a versão do PHP para a instância.
-   `wp`: Define a versão do WordPress.

<!--
## Playground Manager

![Playground settings panel allow users to manage multiple instances](@site/static/img/about/playground-manager-panel.webp)

This panel enables users to manage Playground instances. It displays a list of saved Playgrounds and provides access to the current Playground's settings, along with a **Save Button** to store your configurations locally in your browser for later reloading.
-->

## Gerenciador do Playground

![Painel de configurações do Playground permite aos usuários gerenciar múltiplas instâncias](@site/static/img/about/playground-manager-panel.webp)

Este painel permite aos usuários gerenciar instâncias do Playground. Ele exibe uma lista de Playgrounds salvos e fornece acesso às configurações do Playground atual, junto com um **Botão Salvar** para armazenar suas configurações localmente no seu navegador para recarregamento posterior.

<!--
![Save Playground Button](@site/static/img/about/playground-manager-save-instance.webp)

Once you click on save, an instance will be stored with a generated name to be revisited anytime. The Playground Manager also has options to export(Additional actions menu) and import(Import actions menu) WordPress Playground instances:
-->

![Botão Salvar Playground](@site/static/img/about/playground-manager-save-instance.webp)

Uma vez que você clicar em salvar, uma instância será armazenada com um nome gerado para ser revisitada a qualquer momento. O Gerenciador do Playground também tem opções para exportar (menu Ações adicionais) e importar (menu Ações de importação) instâncias do WordPress Playground:

<!--
### Additional actions menu

![Additional actions Menu](@site/static/img/about/playground-manager-additional-actions.webp)

-   **Export Pull Request to GitHub**: This option allows you to export WordPress plugins, themes, and entire wp-content directories as pull requests to any public GitHub repository. Check [here](https://www.youtube.com/watch?v=gKrij8V3nK0&t=2488s) a demo of using this option.
-   **Download as zip**: It creates a `.zip` with the setup of the Playground instance, including any themes or plugins installed. This `.zip` won't include content and database changes.
-   **Report error**: If you have any issues with WP Playground, you can report it using the form available from this option. You can help resolve issues with Playground by sharing the error details with the development team behind Playground.
-   **View Blueprint**: This option will open the current blueprint used for the Playground instance in the [Blueprints Builder tool](https://playground.wordpress.net/builder/builder.html). From this tool you'll be able to edit the blueprint online and run a new Playground instance with your edited version of the blueprint.
-->

### Menu de ações adicionais

![Menu de Ações Adicionais](@site/static/img/about/playground-manager-additional-actions.webp)

-   **Exportar Pull Request para GitHub**: Esta opção permite exportar plugins WordPress, temas e diretórios wp-content inteiros como pull requests para qualquer repositório GitHub público. Confira [aqui](https://www.youtube.com/watch?v=gKrij8V3nK0&t=2488s) uma demonstração do uso desta opção.
-   **Baixar como zip**: Cria um `.zip` com a configuração da instância do Playground, incluindo quaisquer temas ou plugins instalados. Este `.zip` não incluirá conteúdo e alterações do banco de dados.
-   **Reportar erro**: Se você tiver algum problema com o WP Playground, pode reportá-lo usando o formulário disponível nesta opção. Você pode ajudar a resolver problemas com o Playground compartilhando os detalhes do erro com a equipe de desenvolvimento por trás do Playground.
-   **Ver Blueprint**: Esta opção abrirá o blueprint atual usado para a instância do Playground na [ferramenta Construtor de Blueprints](https://playground.wordpress.net/builder/builder.html). A partir desta ferramenta, você poderá editar o blueprint online e executar uma nova instância do Playground com sua versão editada do blueprint.

<!--
<span id="edit-the-blueprint"></span>

[![snapshot of Builder mode of WordPress Playground](@site/static/img/about/blueprint-builder.webp)](https://playground.wordpress.net/builder/builder.html)
-->

<span id="edit-the-blueprint"></span>

[![captura do modo Construtor do WordPress Playground](@site/static/img/about/blueprint-builder.webp)](https://playground.wordpress.net/builder/builder.html)

<!--
### Import actions menu

![Import actions Menu](@site/static/img/about/playground-manager-import-actions.webp)

-   **Import from zip**: It allows you to recreate a Playground instance using any `.zip` generated with the "Download as zip" option.
-   **Preview a Gutenberg PR**: Allow testers run branches from the Gutenberg repository to test pull requests instantly.
-   **Import from GitHub**: This option allows you to import plugins, themes, and wp-content directories directly from your public GitHub repositories. To enable this feature, connect your GitHub account with WordPress Playground.
-->

### Menu de ações de importação

![Menu de Ações de Importação](@site/static/img/about/playground-manager-import-actions.webp)

-   **Importar de zip**: Permite recriar uma instância do Playground usando qualquer `.zip` gerado com a opção "Baixar como zip".
-   **Visualizar um PR do Gutenberg**: Permite que testadores executem branches do repositório Gutenberg para testar pull requests instantaneamente.
-   **Importar do GitHub**: Esta opção permite importar plugins, temas e diretórios wp-content diretamente dos seus repositórios GitHub públicos. Para habilitar este recurso, conecte sua conta GitHub com o WordPress Playground.

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
