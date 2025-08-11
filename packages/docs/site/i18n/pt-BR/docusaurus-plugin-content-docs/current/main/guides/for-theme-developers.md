---
title: Playground for Theme Developers
slug: /guides/for-theme-developers
description: WordPress Playground for Theme Developers
---

<!--
The WordPress Playground is an innovative tool that allows theme developers to build, test, and showcase their themes directly in a browser environment.

This guide will show you how to use WordPress Playground to improve your theme development workflow, create live demos to showcase your theme, and simplify the theme review process.
-->

O WordPress Playground é uma ferramenta inovadora que permite aos desenvolvedores de temas construir, testar e exibir seus temas diretamente em um ambiente de navegador.

Este guia mostrará como usar o WordPress Playground para melhorar seu fluxo de trabalho de desenvolvimento de temas, criar demonstrações ao vivo para exibir seu tema e simplificar o processo de revisão de temas.

<!--
:::info

Discover how to [Build](/about/build), [Test](/about/test), and [Launch](/about/launch) your products with WordPress Playground in the [About Playground](/about) section

:::
-->

:::info

Descubra como [Construir](/about/build), [Testar](/about/test) e [Lançar](/about/launch) seus produtos com o WordPress Playground na seção [Sobre o Playground](/about)

:::

<!--
## Launching a Playground instance with a theme
-->

## Iniciando uma instância do Playground com um tema

<!--
### Themes in the WordPress themes directory
-->

### Temas no diretório de temas do WordPress

<!--
With WordPress Playground, you can quickly launch a WordPress installation using any theme available in the [WordPress Themes Directory](https://wordpress.org/themes/). Simply pass the `theme` [query parameter](/developers/apis/query-api) to the [Playground URL](https://playground.wordpress.net) like this: https://playground.wordpress.net/?theme=disco.
-->

Com o WordPress Playground, você pode iniciar rapidamente uma instalação do WordPress usando qualquer tema disponível no [Diretório de Temas do WordPress](https://wordpress.org/themes/). Simplesmente passe o [parâmetro de consulta](/developers/apis/query-api) `theme` para a [URL do Playground](https://playground.wordpress.net) assim: https://playground.wordpress.net/?theme=disco.

<!--
You can also load any theme from the WordPress themes directory by setting the [`installTheme` step](/blueprints/steps#InstallThemeStep) of a [Blueprint](/blueprints/getting-started) passed to the Playground instance.
-->

Você também pode carregar qualquer tema do diretório de temas do WordPress definindo o passo [`installTheme`](/blueprints/steps#InstallThemeStep) de um [Blueprint](/blueprints/getting-started) passado para a instância do Playground.

```json
{
	"steps": [
		{
			"step": "installTheme",
			"themeData": {
				"resource": "wordpress.org/themes",
				"slug": "twentytwenty"
			},
			"options": {
				"activate": true,
				"importStarterContent": true
			}
		}
	]
}
```

<!--
[<kbd> &nbsp; Run Blueprint &nbsp; </kbd>](https://playground.wordpress.net/builder/builder.html#{%22steps%22:[{%22step%22:%22installTheme%22,%22themeData%22:{%22resource%22:%22wordpress.org/themes%22,%22slug%22:%22twentytwenty%22},%22options%22:{%22activate%22:true,%22importStarterContent%22:true}}]})
-->

[<kbd> &nbsp; Executar Blueprint &nbsp; </kbd>](https://playground.wordpress.net/builder/builder.html#{%22steps%22:[{%22step%22:%22installTheme%22,%22themeData%22:{%22resource%22:%22wordpress.org/themes%22,%22slug%22:%22twentytwenty%22},%22options%22:{%22activate%22:true,%22importStarterContent%22:true}}]})

<!--
### Themes in a GitHub repository
-->

### Temas em um repositório GitHub

<!--
A theme stored in a GitHub repository can also be loaded in a Playground instance with Blueprints.
-->

Um tema armazenado em um repositório GitHub também pode ser carregado em uma instância do Playground com Blueprints.

<!--
In the `themeData` property of the [`installTheme` blueprint step](/blueprints/steps#InstallThemeStep), you can define a [`url` resource](/blueprints/steps/resources#urlreference) that points to the location of the `.zip` file containing the theme you want to load in the Playground instance.
-->

Na propriedade `themeData` do [passo blueprint `installTheme`](/blueprints/steps#InstallThemeStep), você pode definir um [recurso `url`](/blueprints/steps/resources#urlreference) que aponta para a localização do arquivo `.zip` contendo o tema que você deseja carregar na instância do Playground.

<!--
To avoid CORS issues, the Playground project provides a [GitHub proxy](https://github-proxy.com/) that allows you to generate a `.zip` from a repository (or even a folder inside a repo) containing your or theme.
-->

Para evitar problemas de CORS, o projeto Playground fornece um [proxy GitHub](https://github-proxy.com/) que permite gerar um `.zip` de um repositório (ou mesmo uma pasta dentro de um repo) contendo seu tema.

<!--
:::tip
[GitHub proxy](https://playground.wordpress.net/proxy) is an incredibly useful tool to load themes from GitHub repositories as it allows you to load a theme from a specific branch, a specific directory, a specific commit or a specific PR.
:::
-->

:::tip
O [proxy GitHub](https://github-proxy.com/) é uma ferramenta incrivelmente útil para carregar temas de repositórios GitHub, pois permite carregar um tema de uma branch específica, um diretório específico, um commit específico ou um PR específico.
:::

<!--
For example the following `blueprint.json` installs a theme from a GitHub repository leveraging the https://github-proxy.com tool:
-->

Por exemplo, o seguinte `blueprint.json` instala um tema de um repositório GitHub aproveitando a ferramenta https://github-proxy.com:

```json
{
	"steps": [
		{
			"step": "installTheme",
			"themeData": {
				"resource": "url",
				"url": "https://github-proxy.com/proxy/?repo=Automattic/themes&branch=trunk&directory=assembler"
			},
			"options": {
				"activate": true
			}
		}
	]
}
```

<!--
[<kbd> &nbsp; Run Blueprint &nbsp; </kbd>](https://playground.wordpress.net/builder/builder.html#{%22steps%22:[{%22step%22:%22installTheme%22,%22themeData%22:{%22resource%22:%22url%22,%22url%22:%22https://github-proxy.com/proxy/?repo=Automattic/themes&branch=trunk&directory=assembler%22},%22options%22:{%22activate%22:true}}]})
-->

[<kbd> &nbsp; Executar Blueprint &nbsp; </kbd>](https://playground.wordpress.net/builder/builder.html#{%22steps%22:[{%22step%22:%22installTheme%22,%22themeData%22:{%22resource%22:%22url%22,%22url%22:%22https://github-proxy.com/proxy/?repo=Automattic/themes&branch=trunk&directory=assembler%22},%22options%22:{%22activate%22:true}}]})

<!--
A blueprint can be passed to a Playground instance [in several ways](/blueprints/using-blueprints).
-->

Um blueprint pode ser passado para uma instância do Playground [de várias maneiras](/blueprints/using-blueprints).

<!--
## Setting up a demo theme with Blueprints
-->

## Configurando um tema de demonstração com Blueprints

<!--
When providing a link to a WordPress Playground instance with a specific theme activated, you may also want to customize the initial setup for that theme. With Playground's [Blueprints](/blueprints/getting-started) you can load, activate, and configure a theme.
-->

Ao fornecer um link para uma instância do WordPress Playground com um tema específico ativado, você também pode querer personalizar a configuração inicial para esse tema. Com os [Blueprints](/blueprints/getting-started) do Playground, você pode carregar, ativar e configurar um tema.

<!--
:::tip

Some useful tools and resources provided by the Playground project to work with blueprints are:

-   Check the [Blueprints Gallery](https://github.com/WordPress/blueprints/blob/trunk/GALLERY.md) to explore real-world code examples of using WordPress Playground to launch a WordPress site with a variety of setups.
-   The [WordPress Playground Step Library](https://akirk.github.io/playground-step-library/#) tool provides a visual interface to drag or click the steps to create a blueprint for WordPress Playground. You can also create your own steps!
-   The [Blueprints builder](https://playground.wordpress.net/builder/builder.html) tool allows you edit your blueprint online and run it directly in a Playground instance.

:::
-->

:::tip

Algumas ferramentas e recursos úteis fornecidos pelo projeto Playground para trabalhar com blueprints são:

-   Verifique a [Galeria de Blueprints](https://github.com/WordPress/blueprints/blob/trunk/GALLERY.md) para explorar exemplos de código reais de uso do WordPress Playground para iniciar um site WordPress com várias configurações.
-   A ferramenta [Biblioteca de Passos do WordPress Playground](https://akirk.github.io/playground-step-library/#) fornece uma interface visual para arrastar ou clicar nos passos para criar um blueprint para o WordPress Playground. Você também pode criar seus próprios passos!
-   A ferramenta [Construtor de Blueprints](https://playground.wordpress.net/builder/builder.html) permite editar seu blueprint online e executá-lo diretamente em uma instância do Playground.

:::

<!--
Through properties and [`steps`](/blueprints/steps) in the blueprint, you can configure the initial setup of your theme in the Playground instance.
-->

Através de propriedades e [`steps`](/blueprints/steps) no blueprint, você pode configurar a configuração inicial do seu tema na instância do Playground.

<!--
:::info

To provide a good demo of your theme via Playground, you may want to load it with default content that highlights the features of your theme. Check out the [Providing content for your demo](/guides/providing-content-for-your-demo) guide to learn more about this.

:::
-->

:::info

Para fornecer uma boa demonstração do seu tema via Playground, você pode querer carregá-lo com conteúdo padrão que destaque os recursos do seu tema. Confira o guia [Fornecendo conteúdo para sua demonstração](/guides/providing-content-for-your-demo) para saber mais sobre isso.

:::

<!--
### `resetData`
-->

### `resetData`

<!--
With the [`resetData`](/blueprints/steps#resetData) step, you can remove the default content of a WordPress installation in order to import your own content.
-->

Com o passo [`resetData`](/blueprints/steps#resetData), você pode remover o conteúdo padrão de uma instalação do WordPress para importar seu próprio conteúdo.

```json
"steps": [
	...,
	{
		"step": "resetData"
	},
	...
]
```

<!--
[<kbd> &nbsp; Run Blueprint &nbsp; </kbd>](https://playground.wordpress.net/?blueprint-url=https://raw.githubusercontent.com/wordpress/blueprints/trunk/blueprints/install-activate-setup-theme-from-gh-repo/blueprint.json) &nbsp; [<kbd> &nbsp; See <code>blueprint.json</code> &nbsp; </kbd>](https://github.com/WordPress/blueprints/blob/eb6da7dfa295a095eea2e424c0ae83a219803a8d/blueprints/install-activate-setup-theme-from-gh-repo/blueprint.json#L16)
-->

[<kbd> &nbsp; Executar Blueprint &nbsp; </kbd>](https://playground.wordpress.net/?blueprint-url=https://raw.githubusercontent.com/wordpress/blueprints/trunk/blueprints/install-activate-setup-theme-from-gh-repo/blueprint.json) &nbsp; [<kbd> &nbsp; Ver <code>blueprint.json</code> &nbsp; </kbd>](https://github.com/WordPress/blueprints/blob/eb6da7dfa295a095eea2e424c0ae83a219803a8d/blueprints/install-activate-setup-theme-from-gh-repo/blueprint.json#L16)

<!--
### `writeFile`
-->

### `writeFile`

<!--
With the [`writeFile`](/blueprints/steps#resetData) step, you can write data to a file at a specified path. You may want to use this step to write custom PHP code in a PHP file inside the `mu-plugins` folder of the Playground WordPress instance, so the code is executed automatically when the WordPress instance is loaded.
One of the things you can do through this step is to enable pretty permalinks for your Playground instance:
-->

Com o passo [`writeFile`](/blueprints/steps#resetData), você pode escrever dados em um arquivo em um caminho especificado. Você pode querer usar este passo para escrever código PHP personalizado em um arquivo PHP dentro da pasta `mu-plugins` da instância WordPress do Playground, para que o código seja executado automaticamente quando a instância WordPress for carregada.
Uma das coisas que você pode fazer através deste passo é habilitar permalinks bonitos para sua instância do Playground:

```json
"steps": [
	...,
	{
		"step": "writeFile",
		"path": "/wordpress/wp-content/mu-plugins/rewrite.php",
		"data": "<?php /* Use pretty permalinks */ add_action( 'after_setup_theme', function() { global $wp_rewrite; $wp_rewrite->set_permalink_structure('/%postname%/'); $wp_rewrite->flush_rules(); } );"
	},
	...
]
```

<!--
[<kbd> &nbsp; Run Blueprint &nbsp; </kbd>](https://playground.wordpress.net/?blueprint-url=https://raw.githubusercontent.com/wordpress/blueprints/trunk/blueprints/install-activate-setup-theme-from-gh-repo/blueprint.json) &nbsp; [<kbd> &nbsp; See <code>blueprint.json</code> &nbsp; </kbd>](https://github.com/WordPress/blueprints/blob/eb6da7dfa295a095eea2e424c0ae83a219803a8d/blueprints/install-activate-setup-theme-from-gh-repo/blueprint.json#L19)
-->

[<kbd> &nbsp; Executar Blueprint &nbsp; </kbd>](https://playground.wordpress.net/?blueprint-url=https://raw.githubusercontent.com/wordpress/blueprints/trunk/blueprints/install-activate-setup-theme-from-gh-repo/blueprint.json) &nbsp; [<kbd> &nbsp; Ver <code>blueprint.json</code> &nbsp; </kbd>](https://github.com/WordPress/blueprints/blob/eb6da7dfa295a095eea2e424c0ae83a219803a8d/blueprints/install-activate-setup-theme-from-gh-repo/blueprint.json#L19)

<!--
### `updateUserMeta`
-->

### `updateUserMeta`

<!--
With the [`updateUserMeta`](/blueprints/steps#updateUserMeta) step, you can update any user metadata. For example, you could update the metadata of the default `admin` user of any WordPress installation:
-->

Com o passo [`updateUserMeta`](/blueprints/steps#updateUserMeta), você pode atualizar qualquer metadado de usuário. Por exemplo, você pode atualizar os metadados do usuário `admin` padrão de qualquer instalação do WordPress:

```json
"steps": [
	...,
	{
		"step": "updateUserMeta",
		"meta": {
			"first_name": "John",
			"last_name": "Doe",
			"admin_color": "modern"
		},
		"userId": 1
	},
	...
]
```

<!--
[<kbd> &nbsp; Run Blueprint &nbsp; </kbd>](https://playground.wordpress.net/?blueprint-url=https://raw.githubusercontent.com/wordpress/blueprints/trunk/blueprints/install-activate-setup-theme-from-gh-repo/blueprint.json) &nbsp; [<kbd> &nbsp; See <code>blueprint.json</code> &nbsp; </kbd>](https://github.com/WordPress/blueprints/blob/eb6da7dfa295a095eea2e424c0ae83a219803a8d/blueprints/install-activate-setup-theme-from-gh-repo/blueprint.json#L24)
-->

[<kbd> &nbsp; Executar Blueprint &nbsp; </kbd>](https://playground.wordpress.net/?blueprint-url=https://raw.githubusercontent.com/wordpress/blueprints/trunk/blueprints/install-activate-setup-theme-from-gh-repo/blueprint.json) &nbsp; [<kbd> &nbsp; Ver <code>blueprint.json</code> &nbsp; </kbd>](https://github.com/WordPress/blueprints/blob/eb6da7dfa295a095eea2e424c0ae83a219803a8d/blueprints/install-activate-setup-theme-from-gh-repo/blueprint.json#L24)

<!--
### `setSiteOptions`
-->

### `setSiteOptions`

<!--
With the [`setSiteOptions`](/blueprints/steps#setSiteOptions) step, you can set [site options](https://developer.wordpress.org/apis/options/#available-options-by-category) such as the site name, description, or page to use for posts.
-->

Com o passo [`setSiteOptions`](/blueprints/steps#setSiteOptions), você pode definir [opções do site](https://developer.wordpress.org/apis/options/#available-options-by-category) como o nome do site, descrição ou página para usar para posts.

```json
"steps": [
	...,
	{
		"step": "setSiteOptions",
		"options": {
			"blogname": "Rich Tabor",
			"blogdescription": "Multidisciplinary maker specializing in the intersection of product, design and engineering. Making WordPress.",
			"show_on_front": "page",
			"page_on_front": 6,
			"page_for_posts": 2
		}
	},
	...
]
```

<!--
[<kbd> &nbsp; Run Blueprint &nbsp; </kbd>](https://playground.wordpress.net/?blueprint-url=https://raw.githubusercontent.com/wordpress/blueprints/trunk/blueprints/install-activate-setup-theme-from-gh-repo/blueprint.json) &nbsp; [<kbd> &nbsp; See <code>blueprint.json</code> &nbsp; </kbd>](https://github.com/WordPress/blueprints/blob/eb6da7dfa295a095eea2e424c0ae83a219803a8d/blueprints/install-activate-setup-theme-from-gh-repo/blueprint.json#L50)
-->

[<kbd> &nbsp; Executar Blueprint &nbsp; </kbd>](https://playground.wordpress.net/?blueprint-url=https://raw.githubusercontent.com/wordpress/blueprints/trunk/blueprints/install-activate-setup-theme-from-gh-repo/blueprint.json) &nbsp; [<kbd> &nbsp; Ver <code>blueprint.json</code> &nbsp; </kbd>](https://github.com/WordPress/blueprints/blob/eb6da7dfa295a095eea2e424c0ae83a219803a8d/blueprints/install-activate-setup-theme-from-gh-repo/blueprint.json#L50)

<!--
There's also a [`siteOptions`](/blueprints/steps/shorthands#siteoptions) shorthand that can be used instead of the `setSiteOptions` step.
-->

Há também uma abreviação [`siteOptions`](/blueprints/steps/shorthands#siteoptions) que pode ser usada em vez do passo `setSiteOptions`.

<!--
### `plugins`
-->

### `plugins`

<!--
With the [`plugins`](/blueprints/steps/shorthands#plugins) shorthand you can set a list of plugins you want to be installed and activated with your theme in the Playground instance.
-->

Com a abreviação [`plugins`](/blueprints/steps/shorthands#plugins), você pode definir uma lista de plugins que deseja que sejam instalados e ativados com seu tema na instância do Playground.

<!--
```json
"plugins": ["todo-list-block", "markdown-comment-block"]
```
-->

```json
"plugins": ["todo-list-block", "markdown-comment-block"]
```

<!--
[<kbd> &nbsp; Run Blueprint &nbsp; </kbd>](https://playground.wordpress.net/?blueprint-url=https://raw.githubusercontent.com/wordpress/blueprints/trunk/blueprints/install-activate-setup-theme-from-gh-repo/blueprint.json) &nbsp; [<kbd> &nbsp; See <code>blueprint.json</code> &nbsp; </kbd>](https://github.com/WordPress/blueprints/blob/eb6da7dfa295a095eea2e424c0ae83a219803a8d/blueprints/install-activate-setup-theme-from-gh-repo/blueprint.json#L60)
-->

[<kbd> &nbsp; Executar Blueprint &nbsp; </kbd>](https://playground.wordpress.net/?blueprint-url=https://raw.githubusercontent.com/wordpress/blueprints/trunk/blueprints/install-activate-setup-theme-from-gh-repo/blueprint.json) &nbsp; [<kbd> &nbsp; Ver <code>blueprint.json</code> &nbsp; </kbd>](https://github.com/WordPress/blueprints/blob/eb6da7dfa295a095eea2e424c0ae83a219803a8d/blueprints/install-activate-setup-theme-from-gh-repo/blueprint.json#L60)

<!--
You can also use the [`installPlugin`](/blueprints/steps#installPlugin) step to install and activate plugins for your Playground instance but the shorthand way is recommended.
-->

Você também pode usar o passo [`installPlugin`](/blueprints/steps#installPlugin) para instalar e ativar plugins para sua instância do Playground, mas a forma abreviada é recomendada.

<!--
### `login`
-->

### `login`

<!--
With the [`login`](/blueprints/steps/shorthands#login) shorthand you can launch your Playground instance with the admin user logged in.
-->

Com a abreviação [`login`](/blueprints/steps/shorthands#login), você pode iniciar sua instância do Playground com o usuário admin logado.

<!--
```json
 "login": true,
```
-->

```json
 "login": true,
```

<!--
[<kbd> &nbsp; Run Blueprint &nbsp; </kbd>](https://playground.wordpress.net/?blueprint-url=https://raw.githubusercontent.com/wordpress/blueprints/trunk/blueprints/install-activate-setup-theme-from-gh-repo/blueprint.json) &nbsp; [<kbd> &nbsp; See <code>blueprint.json</code> &nbsp; </kbd>](https://github.com/WordPress/blueprints/blob/eb6da7dfa295a095eea2e424c0ae83a219803a8d/blueprints/install-activate-setup-theme-from-gh-repo/blueprint.json#L10)
-->

[<kbd> &nbsp; Executar Blueprint &nbsp; </kbd>](https://playground.wordpress.net/?blueprint-url=https://raw.githubusercontent.com/wordpress/blueprints/trunk/blueprints/install-activate-setup-theme-from-gh-repo/blueprint.json) &nbsp; [<kbd> &nbsp; Ver <code>blueprint.json</code> &nbsp; </kbd>](https://github.com/WordPress/blueprints/blob/eb6da7dfa295a095eea2e424c0ae83a219803a8d/blueprints/install-activate-setup-theme-from-gh-repo/blueprint.json#L10)

<!--
You can also use the [`login`](/blueprints/steps#login) step to launch your Playground instance logged in with any specific user.
-->

Você também pode usar o passo [`login`](/blueprints/steps#login) para iniciar sua instância do Playground logado com qualquer usuário específico.

<!--
:::tip

The ["Stylish Press"](https://github.com/WordPress/blueprints/tree/trunk/blueprints/stylish-press) and ["Loading, activating, and configuring a theme from a GitHub repository"](https://github.com/WordPress/blueprints/tree/trunk/blueprints/install-activate-setup-theme-from-gh-repo) examples from the [Blueprints Gallery](https://github.com/WordPress/blueprints/blob/trunk/GALLERY.md) are great references for loading, activating, importing content, and configuring a block theme on a Playground instance.
:::
-->

:::tip

Os exemplos ["Stylish Press"](https://github.com/WordPress/blueprints/tree/trunk/blueprints/stylish-press) e ["Carregando, ativando e configurando um tema de um repositório GitHub"](https://github.com/WordPress/blueprints/tree/trunk/blueprints/install-activate-setup-theme-from-gh-repo) da [Galeria de Blueprints](https://github.com/WordPress/blueprints/blob/trunk/GALLERY.md) são ótimas referências para carregar, ativar, importar conteúdo e configurar um tema de blocos em uma instância do Playground.

:::

<!--
## Theme development
-->

## Desenvolvimento de temas

<!--
### Local theme development and testing with Playground
-->

### Desenvolvimento e teste local de temas com o Playground

<!--
From the root folder of a block theme's code, you can quickly load locally a Playground instance with that theme loaded and activated. You can do that by launching, in a theme directory, the [`@wp-playground/cli` command](/developers/local-development/wp-playground-cli) from your preferred command line program or the [Visual Code Studio extension](/developers/local-development/vscode-extension) from the [Visual Studio Code](https://code.visualstudio.com/) IDE.
-->

A partir da pasta raiz do código de um tema de blocos, você pode carregar rapidamente uma instância do Playground localmente com esse tema carregado e ativado. Você pode fazer isso iniciando, em um diretório de tema, o comando [`@wp-playground/cli`](/developers/local-development/wp-playground-cli) do seu programa de linha de comando preferido ou a [extensão do Visual Studio Code](/developers/local-development/vscode-extension) do IDE [Visual Studio Code](https://code.visualstudio.com/).

<!--
For example:
-->

Por exemplo:

```
git clone git@github.com:WordPress/community-themes.git
cd community-themes/blue-note
npx @wp-playground/cli server --auto-mount
```

<!--
### Design your theme using the WordPress UI and save your changes as Pull Requests
-->

### Projete seu tema usando a interface do WordPress e salve suas alterações como Pull Requests

<!--
You can connect your Playground instance to a GitHub repository and create a Pull Request with the changes you've done through the WordPress UI in the Playground instance, leveraging the [Create Block Theme](https://wordpress.org/plugins/create-block-theme/) plugin. You can also make changes to that theme and export a zip.
-->

Você pode conectar sua instância do Playground a um repositório GitHub e criar um Pull Request com as alterações que você fez através da interface do WordPress na instância do Playground, aproveitando o plugin [Create Block Theme](https://wordpress.org/plugins/create-block-theme/). Você também pode fazer alterações nesse tema e exportar um zip.

<!--
Note that you'll need the [Create Block Theme](https://wordpress.org/plugins/create-block-theme/) plugin installed and activated in the Playground instance in order to use this workflow.
-->

Observe que você precisará do plugin [Create Block Theme](https://wordpress.org/plugins/create-block-theme/) instalado e ativado na instância do Playground para usar este fluxo de trabalho.

<iframe width="800" src="https://www.youtube.com/embed/94KnoFhQg1g" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>

<p></p>

<!--
:::tip

Check [About Playground > Build > Save changes done on a Block Theme and create GitHub Pull Requests](/about/build#save-changes-done-on-a-block-theme-and-create-github-pull-requests) for more info.

:::
-->

:::tip

Confira [Sobre o Playground > Construir > Salvar alterações feitas em um Tema de Blocos e criar Pull Requests do GitHub](/about/build#save-changes-done-on-a-block-theme-and-create-github-pull-requests) para mais informações.

:::
