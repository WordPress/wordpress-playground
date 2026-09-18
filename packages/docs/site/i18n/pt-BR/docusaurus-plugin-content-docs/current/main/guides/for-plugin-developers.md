---
title: WordPress Playground para desenvolvedores de plugins
slug: /guides/for-plugin-developers
description: Um guia para desenvolvedores de plugins sobre como usar o Playground para construir, testar e criar demos de seus plugins.
---

<!--
The WordPress Playground is an innovative tool that allows plugin developers to build, test and showcase their plugins directly in a browser environment.
-->

O WordPress Playground é uma ferramenta inovadora que permite aos desenvolvedores de plugins construir, testar e exibir seus plugins diretamente em um ambiente de navegador.

<!--
This guide will show you how to use WordPress Playground to improve your plugin development workflow, create live demos to showcase your plugin, and simplify your plugin testing and review.
-->

Este guia mostrará como usar o WordPress Playground para melhorar seu fluxo de trabalho de desenvolvimento de plugins, criar demonstrações ao vivo para exibir seu plugin e simplificar seus testes e revisão de plugins.

<!--
<div class="callout callout-info">

Discover how to [Build](/about/build), [Test](/about/test), and [Launch](/about/launch) your products with WordPress Playground in the [About Playground](/about) section.

</div>
-->

<div class="callout callout-info">

Descubra como [Construir](/about/build), [Testar](/about/test) e [Lançar](/about/launch) seus produtos com o WordPress Playground na seção [Sobre o Playground](/about).

</div>

<!--
## Launching a Playground instance with a plugin
-->

## Iniciando uma instância do Playground com um plugin

<!--
### Plugin in the WordPress themes directory
-->

### Plugin no diretório de temas do WordPress

<!--
With WordPress Playground, you can quickly launch a WordPress installation with almost any plugin available in the [WordPress Plugins Directory](https://wordpress.org/plugins/) installed and activated. All you need to do is to add the `plugin` [query parameter](/developers/apis/query-api) to the [Playground URL](https://playground.wordpress.net) and use the slug of the plugin from the WordPress directory as a value. For example: https://playground.wordpress.net/?plugin=create-block-theme
-->

Com o WordPress Playground, você pode iniciar rapidamente uma instalação do WordPress com quase qualquer plugin disponível no [Diretório de Plugins do WordPress](https://wordpress.org/plugins/) instalado e ativado. Tudo que você precisa fazer é adicionar o [parâmetro de consulta](/developers/apis/query-api) `plugin` à [URL do Playground](https://playground.wordpress.net) e usar o slug do plugin do diretório WordPress como valor. Por exemplo: https://playground.wordpress.net/?plugin=create-block-theme

<!--
<div class="callout callout-tip">

You can install and activate several plugins via query parameters by repeating the `plugin` parameter for every plugin you want to be installed and activated in the Playground instance. For example: https://playground.wordpress.net/?plugin=gutenberg&plugin=akismet&plugin=wordpress-seo.

</div>
-->

<div class="callout callout-tip">

Você pode instalar e ativar vários plugins via parâmetros de consulta repetindo o parâmetro `plugin` para cada plugin que deseja ser instalado e ativado na instância do Playground. Por exemplo: https://playground.wordpress.net/?plugin=gutenberg&plugin=akismet&plugin=wordpress-seo.

</div>

<!--
You can also load any plugin from the WordPress plugins directory by setting the [`installPlugin` step](/blueprints/steps#InstallPluginStep) of a [Blueprint](/blueprints/getting-started) passed to the Playground instance.

```json
{
	"landingPage": "/wp-admin/plugins.php",
	"login": true,
	"steps": [
		{
			"step": "installPlugin",
			"pluginData": {
				"resource": "wordpress.org/plugins",
				"slug": "gutenberg"
			}
		}
	]
}
```

[<kbd> &nbsp; Run Blueprint &nbsp; </kbd>](https://playground.wordpress.net/builder/builder.html#{%22landingPage%22:%22/wp-admin/plugins.php%22,%22login%22:true,%22steps%22:[{%22step%22:%22installPlugin%22,%22pluginData%22:{%22resource%22:%22wordpress.org/plugins%22,%22slug%22:%22gutenberg%22}}]})
-->

Você também pode carregar qualquer plugin do diretório de plugins do WordPress definindo o passo [`installPlugin`](/blueprints/steps#InstallPluginStep) de um [Blueprint](/blueprints/getting-started) passado para a instância do Playground.

```json
{
	"landingPage": "/wp-admin/plugins.php",
	"login": true,
	"steps": [
		{
			"step": "installPlugin",
			"pluginData": {
				"resource": "wordpress.org/plugins",
				"slug": "gutenberg"
			}
		}
	]
}
```

[<kbd> &nbsp; Executar Blueprint &nbsp; </kbd>](https://playground.wordpress.net/builder/builder.html#{%22landingPage%22:%22/wp-admin/plugins.php%22,%22login%22:true,%22steps%22:[{%22step%22:%22installPlugin%22,%22pluginData%22:{%22resource%22:%22wordpress.org/plugins%22,%22slug%22:%22gutenberg%22}}]})

<!--
Blueprints can be passed to a Playground instance [in several ways](/blueprints/using-blueprints).
-->

Os Blueprints podem ser passados para uma instância do Playground [de várias maneiras](/blueprints/using-blueprints).

<!--
### Plugin in a GitHub repository
-->

### Plugin em um repositório GitHub

<!--
A plugin stored in a GitHub repository can also be loaded in a Playground instance via Blueprints.
-->

Um plugin armazenado em um repositório GitHub também pode ser carregado em uma instância do Playground via Blueprints.

<!--
With the `pluginData` property of the [`installPlugin` blueprint step](/blueprints/steps#installPlugin), you can define a [`git:directory` resource](/blueprints/steps/resources#gitdirectoryreference) that will build a plugin from the files from a repository in the Playground instance.
-->

Com a propriedade `pluginData` do [passo do blueprint `installPlugin`](/blueprints/steps#installPlugin), você pode definir um [recurso `git:directory`](/blueprints/steps/resources#gitdirectoryreference) que criará um plugin a partir dos arquivos de um repositório na instância do Playground.

<!--
<div class="callout callout-info">

For the past few months, the [GitHub proxy](https://playground.wordpress.net/proxy) was an incredibly useful tool to load plugins from GitHub repositories, as it allows you to load a plugin from a specific branch, a specific directory, a specific commit, or a specific PR. But with the recent improvements to Playground, this feature is no longer necessary. The GitHub Proxy will be discontinued soon, please update your blueprints to `git:directory` resource.

</div>
-->

<div class="callout callout-info">

Durante os últimos meses, o [proxy do GitHub](https://playground.wordpress.net/proxy) foi uma ferramenta incrivelmente útil para carregar plugins de repositórios do GitHub, pois permitia carregar um plugin de uma branch específica, um diretório específico, um commit específico ou um PR específico. Mas com as melhorias recentes no Playground, esse recurso não é mais necessário. O Proxy do GitHub será descontinuado em breve, por favor atualize seus blueprints para o recurso `git:directory`.

</div>

<!--
For example, the following `blueprint.json` installs a plugin from a GitHub repository:

```json
{
	"landingPage": "/wp-admin/admin.php?page=add-media-from-third-party-service",
	"login": true,
	"steps": [
		{
			"step": "installPlugin",
			"pluginData": {
				"resource": "git:directory",
				"url": "https://github.com/wptrainingteam/devblog-dataviews-plugin",
				"ref": "HEAD",
    			"refType": "refname"
			}
		}
	]
}
```
-->

Por exemplo, o seguinte `blueprint.json` instala um plugin de um repositório GitHub:

```json
{
	"landingPage": "/wp-admin/admin.php?page=add-media-from-third-party-service",
	"login": true,
	"steps": [
		{
			"step": "installPlugin",
			"pluginData": {
				"resource": "git:directory",
				"url": "https://github.com/wptrainingteam/devblog-dataviews-plugin",
				"ref": "HEAD",
				"refType": "refname"
			}
		}
	]
}
```

<!--
<div class="callout callout-tip">

If your plugin is hosted on GitHub, you can automatically add preview buttons to your pull requests using the Playground PR Preview GitHub Action. This lets reviewers test your changes instantly without any setup. See [Adding PR Preview Buttons with GitHub Actions](/guides/github-action-pr-preview) for details.

</div>
-->

<div class="callout callout-tip">

Se o seu plugin estiver hospedado no GitHub, você poderá adicionar automaticamente botões de visualização às suas solicitações pull usando o GitHub Action Playground PR Preview. Isso permite que os revisores testem suas alterações instantaneamente, sem qualquer configuração. Consulte [Adicionando botões de visualização de PR com ações do GitHub](/guides/github-action-pr-preview) para obter detalhes.

</div>

<!--
[<kbd> &nbsp; Run Blueprint &nbsp; </kbd>](https://playground.wordpress.net/#{%22landingPage%22:%22/wp-admin/admin.php?page=add-media-from-third-party-service%22,%22login%22:true,%22steps%22:[{%22step%22:%22installPlugin%22,%22pluginData%22:{%22resource%22:%22git:directory%22,%22url%22:%22https://github.com/wptrainingteam/devblog-dataviews-plugin%22,%22ref%22:%22HEAD%22,%22refType%22:%22refname%22}}],%22$schema%22:%22https://playground.wordpress.net/blueprint-schema.json%22,%22meta%22:{%22title%22:%22Empty%20Blueprint%22,%22author%22:%22https://github.com/akirk/playground-step-library%22}})
-->

[<kbd> &nbsp; Executar Blueprint &nbsp; </kbd>](https://playground.wordpress.net/#{%22landingPage%22:%22/wp-admin/admin.php?page=add-media-from-third-party-service%22,%22login%22:true,%22steps%22:[{%22step%22:%22installPlugin%22,%22pluginData%22:{%22resource%22:%22git:directory%22,%22url%22:%22https://github.com/wptrainingteam/devblog-dataviews-plugin%22,%22ref%22:%22HEAD%22,%22refType%22:%22refname%22}}],%22$schema%22:%22https://playground.wordpress.net/blueprint-schema.json%22,%22meta%22:{%22title%22:%22Empty%20Blueprint%22,%22author%22:%22https://github.com/akirk/playground-step-library%22}})

<!--
### Plugin from code in a file or gist in GitHub
-->

### Plugin de código em um arquivo ou gist no GitHub

<!--
By combining the [`writeFile`](/blueprints/steps#WriteFileStep) and [`activatePlugin`](/blueprints/steps#activatePlugin) steps you can also launch a WP Playground instance with a plugin built on the fly from code stored on a gist or [a file in GitHub](https://raw.githubusercontent.com/WordPress/blueprints/trunk/blueprints/custom-post/books.php):

```json
{
	"landingPage": "/wp-admin/plugins.php",
	"login": true,
	"steps": [
		{
			"step": "login"
		},
		{
			"step": "writeFile",
			"path": "/wordpress/wp-content/plugins/cpt-books.php",
			"data": {
				"resource": "url",
				"url": "https://raw.githubusercontent.com/WordPress/blueprints/trunk/blueprints/custom-post/books.php"
			}
		},
		{
			"step": "activatePlugin",
			"pluginPath": "cpt-books.php"
		}
	]
}
```

[<kbd> &nbsp; Run Blueprint &nbsp; </kbd>](https://playground.wordpress.net/builder/builder.html#{%22landingPage%22:%22/wp-admin/plugins.php%22,%22login%22:true,%22steps%22:[{%22step%22:%22login%22},{%22step%22:%22writeFile%22,%22path%22:%22/wordpress/wp-content/plugins/cpt-books.php%22,%22data%22:{%22resource%22:%22url%22,%22url%22:%22https://raw.githubusercontent.com/WordPress/blueprints/trunk/blueprints/custom-post/books.php%22}},{%22step%22:%22activatePlugin%22,%22pluginPath%22:%22cpt-books.php%22}]})
-->

Combinando os passos [`writeFile`](/blueprints/steps#WriteFileStep) e [`activatePlugin`](/blueprints/steps#activatePlugin), você também pode iniciar uma instância do WP Playground com um plugin construído dinamicamente a partir de código armazenado em um gist ou [um arquivo no GitHub](https://raw.githubusercontent.com/WordPress/blueprints/trunk/blueprints/custom-post/books.php):

```json
{
	"landingPage": "/wp-admin/plugins.php",
	"login": true,
	"steps": [
		{
			"step": "login"
		},
		{
			"step": "writeFile",
			"path": "/wordpress/wp-content/plugins/cpt-books.php",
			"data": {
				"resource": "url",
				"url": "https://raw.githubusercontent.com/WordPress/blueprints/trunk/blueprints/custom-post/books.php"
			}
		},
		{
			"step": "activatePlugin",
			"pluginPath": "cpt-books.php"
		}
	]
}
```

[<kbd> &nbsp; Executar Blueprint &nbsp; </kbd>](https://playground.wordpress.net/builder/builder.html#{%22landingPage%22:%22/wp-admin/plugins.php%22,%22login%22:true,%22steps%22:[{%22step%22:%22login%22},{%22step%22:%22writeFile%22,%22path%22:%22/wordpress/wp-content/plugins/cpt-books.php%22,%22data%22:{%22resource%22:%22url%22,%22url%22:%22https://raw.githubusercontent.com/WordPress/blueprints/trunk/blueprints/custom-post/books.php%22}},{%22step%22:%22activatePlugin%22,%22pluginPath%22:%22cpt-books.php%22}]})

<!--
<div class="callout callout-info">

The [Install plugin from a gist](https://playground.wordpress.net/builder/builder.html?blueprint-url=https://raw.githubusercontent.com/wordpress/blueprints/trunk/blueprints/install-plugin-from-gist/blueprint.json#{%22meta%22:{%22title%22:%22Install%20plugin%20from%20a%20gist%22,%22author%22:%22zieladam%22,%22description%22:%22Install%20and%20activate%20a%20WordPress%20plugin%20from%20a%20.php%20file%20stored%20in%20a%20gist.%22,%22categories%22:[%22plugins%22]},%22landingPage%22:%22/wp-admin/plugins.php%22,%22preferredVersions%22:{%22wp%22:%22beta%22,%22php%22:%228.0%22},%22steps%22:[{%22step%22:%22login%22},{%22step%22:%22writeFile%22,%22path%22:%22/wordpress/wp-content/plugins/0-plugin.php%22,%22data%22:{%22resource%22:%22url%22,%22url%22:%22https://gist.githubusercontent.com/ndiego/456b74b243d86c97cda89264c68cbdee/raw/ff00cf25e6eebe4f5a4eaecff10286f71e65340b/block-hooks-demo.php%22}},{%22step%22:%22activatePlugin%22,%22pluginName%22:%22Block%20Hooks%20Demo%22,%22pluginPath%22:%220-plugin.php%22}]}) example in the [Blueprints Gallery](https://github.com/WordPress/blueprints/blob/trunk/GALLERY.md) shows how to load a plugin from code in a gist

</div>
-->

<div class="callout callout-info">

O exemplo [Instalar plugin de um gist](https://playground.wordpress.net/builder/builder.html?blueprint-url=https://raw.githubusercontent.com/wordpress/blueprints/trunk/blueprints/install-plugin-from-gist/blueprint.json#{%22meta%22:{%22title%22:%22Install%20plugin%20from%20a%20gist%22,%22author%22:%22zieladam%22,%22description%22:%22Install%20and%20activate%20a%20WordPress%20plugin%20from%20a%20.php%20file%20stored%20in%20a%20gist.%22,%22categories%22:[%22plugins%22]},%22landingPage%22:%22/wp-admin/plugins.php%22,%22preferredVersions%22:{%22wp%22:%22beta%22,%22php%22:%228.0%22},%22steps%22:[{%22step%22:%22login%22},{%22step%22:%22writeFile%22,%22path%22:%22/wordpress/wp-content/plugins/0-plugin.php%22,%22data%22:{%22resource%22:%22url%22,%22url%22:%22https://gist.githubusercontent.com/ndiego/456b74b243d86c97cda89264c68cbdee/raw/ff00cf25e6eebe4f5a4eaecff10286f71e65340b/block-hooks-demo.php%22}},{%22step%22:%22activatePlugin%22,%22pluginName%22:%22Block%20Hooks%20Demo%22,%22pluginPath%22:%220-plugin.php%22}]}) na [Galeria de Blueprints](https://github.com/WordPress/blueprints/blob/trunk/GALLERY.md) mostra como carregar um plugin de código em um gist

</div>

<!--
## Setting up a demo for your plugin with Blueprints
-->

## Configurando uma demonstração para seu plugin com Blueprints

<!--
When providing a link to a WordPress Playground instance with some plugins activated, you may also want to customize the initial setup for that Playground instance using those plugins. With Playground's [Blueprints](/blueprints/getting-started) you can load/activate plugins and configure the Playground instance.
-->

Ao fornecer um link para uma instância do WordPress Playground com alguns plugins ativados, você também pode querer personalizar a configuração inicial para essa instância do Playground usando esses plugins. Com os [Blueprints](/blueprints/getting-started) do Playground, você pode carregar/ativar plugins e configurar a instância do Playground.

<!--
<div class="callout callout-tip">

Some useful tools and resources provided by the Playground project to work with blueprints are:

-   Check the [Blueprints Gallery](https://github.com/WordPress/blueprints/blob/trunk/GALLERY.md) to explore real-world code examples of using WordPress Playground to launch a WordPress site with a variety of setups.
-   The [WordPress Playground Step Library](https://akirk.github.io/playground-step-library/#) tool provides a visual interface to drag or click the steps to create a blueprint for WordPress Playground. You can also create your own steps!
-   The [Blueprints builder](https://playground.wordpress.net/builder/builder.html) tool allows you edit your blueprint online and run it directly in a Playground instance.

</div>
-->

<div class="callout callout-tip">

Algumas ferramentas e recursos úteis fornecidos pelo projeto Playground para trabalhar com blueprints são:

- Verifique a [Galeria de Blueprints](https://github.com/WordPress/blueprints/blob/trunk/GALLERY.md) para explorar exemplos de código reais de uso do WordPress Playground para iniciar um site WordPress com várias configurações.
- A ferramenta [Biblioteca de Passos do WordPress Playground](https://akirk.github.io/playground-step-library/#) fornece uma interface visual para arrastar ou clicar nos passos para criar um blueprint para o WordPress Playground. Você também pode criar seus próprios passos!
- A ferramenta [Construtor de Blueprints](https://playground.wordpress.net/builder/builder.html) permite editar seu blueprint online e executá-lo diretamente em uma instância do Playground.

</div>

<!--
Through properties and [`steps`](/blueprints/steps) in the Blueprint, you can configure the Playground instance's initial setup, providing your plugins with the content and configuration needed for showcasing your plugin's compelling features and functionality.
-->

Através de propriedades e [`steps`](/blueprints/steps) no Blueprint, você pode configurar a configuração inicial da instância do Playground, fornecendo aos seus plugins o conteúdo e a configuração necessários para exibir os recursos e funcionalidades convincentes do seu plugin.

<!--
<div class="callout callout-info">

A great demo with WordPress Playground might require that you load default content for your plugin and theme, including images and other assets. Check out the [Providing content for your demo](/guides/providing-content-for-your-demo) guide to learn more about this.

</div>
-->

<div class="callout callout-info">

Uma ótima demonstração com o WordPress Playground pode exigir que você carregue conteúdo padrão para seu plugin e tema, incluindo imagens e outros recursos. Confira o guia [Fornecendo conteúdo para sua demonstração](/guides/providing-content-for-your-demo) para saber mais sobre isso.

</div>

<!--
### `plugins`
-->

### `plugins`

<!--
If your plugin has dependencies on other plugins you can use the `plugins` shorthand to install yours along with any other needed plugins.

```json
{
	"landingPage": "/wp-admin/plugins.php",
	"plugins": ["gutenberg", "sql-buddy", "create-block-theme"],
	"login": true
}
```

[<kbd> &nbsp; Run Blueprint &nbsp; </kbd>](https://playground.wordpress.net/builder/builder.html#{%22landingPage%22:%22/wp-admin/plugins.php%22,%22plugins%22:[%22gutenberg%22,%22sql-buddy%22,%22create-block-theme%22],%22login%22:true})
-->

Se seu plugin tem dependências de outros plugins, você pode usar a abreviação `plugins` para instalar o seu junto com quaisquer outros plugins necessários.

```json
{
	"landingPage": "/wp-admin/plugins.php",
	"plugins": ["gutenberg", "sql-buddy", "create-block-theme"],
	"login": true
}
```

[<kbd> &nbsp; Executar Blueprint &nbsp; </kbd>](https://playground.wordpress.net/builder/builder.html#{%22landingPage%22:%22/wp-admin/plugins.php%22,%22plugins%22:[%22gutenberg%22,%22sql-buddy%22,%22create-block-theme%22],%22login%22:true})

<!--
### `landingPage`
-->

### `landingPage`

<!--
If your plugin has a settings view or onboarding wizard, you can use the `landingPage` shorthand to automatically redirect to any page in the Playground instance upon loading.

```json
{
	"landingPage": "/wp-admin/admin.php?page=my-custom-gutenberg-app",
	"login": true,
	"plugins": ["https://raw.githubusercontent.com/WordPress/block-development-examples/deploy/zips/data-basics-59c8f8.zip"]
}
```

[<kbd> &nbsp; Run Blueprint &nbsp; </kbd>](https://playground.wordpress.net/builder/builder.html#{%22landingPage%22:%22/wp-admin/admin.php?page=my-custom-gutenberg-app%22,%22login%22:true,%22plugins%22:[%22https://raw.githubusercontent.com/WordPress/block-development-examples/deploy/zips/data-basics-59c8f8.zip%22]})
-->

Se seu plugin tem uma visualização de configurações ou assistente de integração, você pode usar a abreviação `landingPage` para redirecionar automaticamente para qualquer página na instância do Playground ao carregar.

```json
{
	"landingPage": "/wp-admin/admin.php?page=my-custom-gutenberg-app",
	"login": true,
	"plugins": ["https://raw.githubusercontent.com/WordPress/block-development-examples/deploy/zips/data-basics-59c8f8.zip"]
}
```

[<kbd> &nbsp; Executar Blueprint &nbsp; </kbd>](https://playground.wordpress.net/builder/builder.html#{%22landingPage%22:%22/wp-admin/admin.php?page=my-custom-gutenberg-app%22,%22login%22:true,%22plugins%22:[%22https://raw.githubusercontent.com/WordPress/block-development-examples/deploy/zips/data-basics-59c8f8.zip%22]})

<!--
### `writeFile`
-->

### `writeFile`

<!--
With the [`writeFile` step](/blueprints/steps#writeFile) you can create any plugin file on the fly, referencing code from a \*.php file stored on a GitHub or Gist.
-->

Com o [passo `writeFile`](/blueprints/steps#writeFile), você pode criar qualquer arquivo de plugin dinamicamente, referenciando código de um arquivo \*.php armazenado no GitHub ou Gist.

<!--
Here’s an example of a **[plugin that generates Custom Post Types](https://raw.githubusercontent.com/wordpress/blueprints/trunk/blueprints/custom-post/books.php)**, placed in the `mu-plugins` folder to ensure the code runs automatically on load:

```json
{
	"landingPage": "/wp-admin/",
	"login": true,
	"steps": [
		{
			"step": "writeFile",
			"path": "/wordpress/wp-content/mu-plugins/books.php",
			"data": {
				"resource": "url",
				"url": "https://raw.githubusercontent.com/wordpress/blueprints/trunk/blueprints/custom-post/books.php"
			}
		}
	]
}
```
-->

Aqui está um exemplo de um **[plugin que gera Custom Post Types](https://raw.githubusercontent.com/wordpress/blueprints/trunk/blueprints/custom-post/books.php)**, colocado na pasta `mu-plugins` para garantir que o código seja executado automaticamente ao carregar:

```json
{
	"landingPage": "/wp-admin/",
	"login": true,
	"steps": [
		{
			"step": "writeFile",
			"path": "/wordpress/wp-content/mu-plugins/books.php",
			"data": {
				"resource": "url",
				"url": "https://raw.githubusercontent.com/wordpress/blueprints/trunk/blueprints/custom-post/books.php"
			}
		}
	]
}
```

<!--
## Plugin Development
-->

## Desenvolvimento de Plugins

<!--
### Local plugin development and testing with Playground
-->

### Desenvolvimento e teste local de plugins com o Playground

<!--
From a plugins' folder in your local development environment, you can quickly load locally a Playground instance with that plugin loaded and activated.
-->

A partir de uma pasta de plugins em seu ambiente de desenvolvimento local, você pode carregar rapidamente uma instância do Playground localmente com esse plugin carregado e ativado.

<!--
Use the [`@wp-playground/cli` command](/developers/local-development/wp-playground-cli) from your plugin's root directory using your preferred command line program.
-->

Use o comando [`@wp-playground/cli`](/developers/local-development/wp-playground-cli) do diretório raiz do seu plugin usando seu programa de linha de comando preferido.

<!--
With [Visual Studio Code](https://code.visualstudio.com/) IDE, you can also use the [Visual Studio Code extension](/developers/local-development/vscode-extension) while working in the root directory of your plugin.
-->

Com o IDE [Visual Studio Code](https://code.visualstudio.com/), você também pode usar a [extensão do Visual Studio Code](/developers/local-development/vscode-extension) enquanto trabalha no diretório raiz do seu plugin.

<!--
For example:

```bash
git clone git@github.com:wptrainingteam/devblog-dataviews-plugin.git
cd devblog-dataviews-plugin
npx @wp-playground/cli server --auto-mount
```
-->

Por exemplo:

```bash
git clone git@github.com:wptrainingteam/devblog-dataviews-plugin.git
cd devblog-dataviews-plugin
npx @wp-playground/cli server --auto-mount
```

<!--
### See your local changes in a Playground instance and directly create PRs in a GitHub repo with your changes
-->

### Veja suas alterações locais em uma instância do Playground e crie PRs diretamente em um repo GitHub com suas alterações

<!--
With Google Chrome you can synchronize a Playground instance with your local plugin's code and your plugin's GitHub repo. With this connection you can:

-   See live (in the Playground instance) your local changes
-   Create PRs in the GitHub repo with your changes

Here's a little demo of this workflow in action:

<iframe width="800" src="https://www.youtube.com/embed/UYK88eZqrjo" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>
<p></p>
-->

Com o Google Chrome, você pode sincronizar uma instância do Playground com o código do seu plugin local e o repo GitHub do seu plugin. Com essa conexão, você pode:

- Ver ao vivo (na instância do Playground) suas alterações locais
- Criar PRs no repo GitHub com suas alterações

Aqui está uma pequena demonstração deste fluxo de trabalho em ação:

<iframe width="800" src="https://www.youtube.com/embed/UYK88eZqrjo" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>
<p></p>

<!--
<div class="callout callout-info">

Check [About Playground &gt; Build &gt; Synchronize your playground instance with a local folder and create GitHub Pull Requests](/about/build#synchronize-your-playground-instance-with-a-local-folder-and-create-github-pull-requests) for more info.

</div>
-->

<div class="callout callout-info">

Confira [Sobre o Playground &gt; Construir &gt; Sincronizar sua instância do playground com uma pasta local e criar Pull Requests do GitHub](/about/build#synchronize-your-playground-instance-with-a-local-folder-and-create-github-pull-requests) para mais informações.

</div>
