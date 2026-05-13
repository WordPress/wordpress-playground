---
title: O que são Blueprints?
slug: /blueprints/tutorial/what-are-blueprints-what-you-can-do-with-them
description: Aprenda o que são Blueprints e como eles configuram o WordPress Playground. Descubra os benefícios de usar JSON para configuração instantânea do site.
---

<!--
# What are Blueprints, and what can you do with them?
-->

# O que são Blueprints e o que você pode fazer com eles?

<!--
With WordPress Playground you can create a whole website, including plugins, themes, content (posts, pages, taxonomy, and comments), settings (site name, users, permalinks, and more), etc. They allow you to generate a WooCommerce store complete with products, a magazine populated with articles, a corporate blog with multiple users, and more.
-->

Com o WordPress Playground, você pode criar um site completo, incluindo plugins, temas, conteúdo (posts, páginas, taxonomias e comentários), configurações (nome do site, usuários, permalink e mais), etc. Eles permitem que você gere uma loja WooCommerce completa com produtos, uma revista populada com artigos, um blog corporativo com múltiplos usuários e muito mais.

<!--
Blueprints are `JSON` files that you can use to configure Playground instances.
-->

Blueprints são arquivos `JSON` que você pode usar para configurar instâncias do Playground.

<!--
Blueprints support advanced use cases, like file system and database manipulation, and give you fine-grained control over the instance you create. The WordPress Test Team has been using Playground in [the 6.5 beta release cycle](https://wordpress.org/news/2024/03/wordpress-6-5-release-candidate-2/), creating a Blueprint that loads the latest version, several testing plugins, and dummy data.
-->

Blueprints suportam casos de uso avançados, como manipulação de sistema de arquivos e banco de dados, e oferecem controle detalhado sobre a instância que você cria. A Equipe de Testes do WordPress tem usado o Playground no [ciclo de lançamento beta do WordPress 6.5](https://wordpress.org/news/2024/03/wordpress-6-5-release-candidate-2/), criando um Blueprint que carrega a versão mais recente, vários plugins de teste e dados fictícios.

<!--
## A simple example
-->

## Um exemplo simples

<!--
A Blueprint might look something like this:
-->

Um Blueprint pode parecer algo assim:

```json
{
	"plugins": ["akismet", "gutenberg"],
	"steps": [
		{
			"step": "installTheme",
			"themeData": {
				"resource": "wordpress.org/themes",
				"slug": "twentynineteen"
			}
		}
	],
	"siteOptions": {
		"blogname": "My Blog",
		"blogdescription": "Just another WordPress site"
	},
	"constants": {
		"WP_DEBUG": true
	}
}
```

<!--
The Blueprint above installs the _Akismet_ and _Gutenberg_ plugins and the _Twenty Nineteen_ theme, sets the site name and description, and enables the WordPress debugging mode.
-->

O Blueprint acima instala os plugins _Akismet_ e _Gutenberg_ e o tema _Twenty Nineteen_, define o nome e a descrição do site e habilita o modo de depuração do WordPress.

<!--
## The benefits of Blueprints
-->

## Os benefícios dos Blueprints

<!--
Blueprints are an invaluable tool for building WordPress sites via Playground.
-->

Blueprints são uma ferramenta inestimável para construir sites WordPress via Playground.

<!--
-   **Flexibility**: developers can make granular adjustments to the build process.
-->

- **Flexibilidade**: os desenvolvedores podem fazer ajustes granulares no processo de construção.

<!--
-   **Consistency**: ensure that every new site starts with the same configuration.
-->

- **Consistência**: garante que cada novo site comece com a mesma configuração.

<!--
-   **Lightweight**: small text files that are easy to store and transfer.
-->

- **Leveza**: pequenos arquivos de texto que são fáceis de armazenar e transferir.

<!--
-   **Transparency**: A Blueprint includes all the commands needed to build a snapshot of a WordPress site. You can read through it and understand how the site is built.
-->

- **Transparência**: Um Blueprint inclui todos os comandos necessários para construir uma instantânea de um site WordPress. Você pode lê-lo e entender como o site é construído.

<!--
-   **Productivity**: reduces the time-consuming process of manually setting up a new WordPress site. Instead of installing and configuring themes and plugins for each new project, apply a Blueprint and set everything in one process.
-->

- **Produtividade**: reduz o processo demorado de configurar manualmente um novo site WordPress. Em vez de instalar e configurar temas e plugins para cada novo projeto, aplique um Blueprint e configure tudo em um único processo.

<!--
-   **Up-to-date dependencies**: fetch the latest version of WordPress, a particular plugin, or a theme. Your snapshot is always up to date with the latest features and security fixes.
-->

- **Dependências atualizadas**: busque a versão mais recente do WordPress, um plugin específico ou um tema. Sua instantânea está sempre atualizada com os últimos recursos e correções de segurança.

<!--
-   **Collaboration**: the `JSON` files are easy to review in tools like GitHub. Share Blueprints with your team or the WordPress community. Allowing others to use your well-configured setup.
-->

- **Colaboração**: os arquivos `JSON` são fáceis de revisar em ferramentas como o GitHub. Compartilhe Blueprints com sua equipe ou com a comunidade WordPress, permitindo que outros usem sua configuração bem elaborada.

<!--
-   **Experimentation and Learning**: For those new to WordPress or looking to experiment with different configurations, Blueprints provide a safe and easy way to try new setups without "breaking" a live site.
-->

- **Experimentação e Aprendizado**: Para aqueles novos no WordPress ou que desejam experimentar diferentes configurações, os Blueprints fornecem uma maneira segura e fácil de tentar novas configurações sem "quebrar" um site ao vivo.

<!--
-   **WordPress.org integration**: offer a [demo of your plugin](https://developer.wordpress.org/plugins/wordpress-org/previews-and-blueprints/) in the WordPress plugin directory, or a preview in a [Theme Trac ticket](https://meta.trac.wordpress.org/ticket/7382).
-->

- **Integração com WordPress.org**: ofereça uma [demonstração do seu plugin](https://developer.wordpress.org/plugins/wordpress-org/previews-and-blueprints/) no diretório de plugins do WordPress, ou uma prévia em um [ticket do Theme Trac](https://meta.trac.wordpress.org/ticket/7382).

<!--
-   **Spinning a development environment**: A new developer in the team could download the Blueprint, run a hypothetical `wp up` command, and get a fresh developer environments—loaded with everything they need. The entire CI/CD process can reuse the same Blueprint.
-->

- **Criando um ambiente de desenvolvimento**: Um novo desenvolvedor na equipe pode baixar o Blueprint, executar um hipotético comando `wp up` e obter um novo ambiente de desenvolvimento—carregado com tudo o que precisa. Todo o processo de CI/CD pode reutilizar o mesmo Blueprint.

<!--
<div class="callout callout-info">

**More Resources**

Visit these links to learn more about the (endless) possibilities of Blueprints:
-->

<div class="callout callout-info">

**Mais Recursos**

Visite estes links para aprender mais sobre as (incontáveis) possibilidades dos Blueprints:

<!--
-   [Introduction to WordPress Playground](https://developer.wordpress.org/news/2024/04/05/introduction-to-playground-running-wordpress-in-the-browser/)
-->

- [Introdução ao WordPress Playground](https://developer.wordpress.org/news/2024/04/05/introduction-to-playground-running-wordpress-in-the-browser/)

<!--
-   Embed a pre-configured WordPress site in your website using the [WordPress Playground Block](https://wordpress.org/plugins/interactive-code-block/).
-->

- Incorpore um site WordPress pré-configurado em seu site usando o [Bloco do WordPress Playground](https://wordpress.org/plugins/interactive-code-block/).

<!--
-   [Blueprints examples](/blueprints/examples)
-->

- [Exemplos de Blueprints](/blueprints/examples)

<!--
-   [Demos and apps built with Blueprints](/resources#apps-built-with-wordpress-playground)
-->

- [Demonstrações e aplicativos construídos com Blueprints](/resources#apps-built-with-wordpress-playground)

</div>
