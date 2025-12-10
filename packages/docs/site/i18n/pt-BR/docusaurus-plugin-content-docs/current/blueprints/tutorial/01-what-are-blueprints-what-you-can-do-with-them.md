---
title: O que são Blueprints?
slug: /blueprints/tutorial/what-are-blueprints-what-you-can-do-with-them
description: Aprenda o que são Blueprints e como eles configuram o WordPress Playground. Descubra os benefícios de usar JSON para configuração instantânea do site.
---

# O que são Blueprints e o que você pode fazer com eles?

Com o WordPress Playground, você pode criar um site completo, incluindo plugins, temas, conteúdo (posts, páginas, taxonomias e comentários), configurações (nome do site, usuários, permalink e mais), etc. Eles permitem que você gere uma loja WooCommerce completa com produtos, uma revista populada com artigos, um blog corporativo com múltiplos usuários e muito mais.

Blueprints são arquivos `JSON` que você pode usar para configurar instâncias do Playground.

Blueprints suportam casos de uso avançados, como manipulação de sistema de arquivos e banco de dados, e oferecem controle detalhado sobre a instância que você cria. A Equipe de Testes do WordPress tem usado o Playground no [ciclo de lançamento beta do WordPress 6.5](https://wordpress.org/news/2024/03/wordpress-6-5-release-candidate-2/), criando um Blueprint que carrega a versão mais recente, vários plugins de teste e dados fictícios.

## Um exemplo simples

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
		"blogname": "Meu Blog",
		"blogdescription": "Apenas mais um site WordPress"
	},
	"constants": {
		"WP_DEBUG": true
	}
}
```

O Blueprint acima instala os plugins _Akismet_ e _Gutenberg_ e o tema _Twenty Nineteen_, define o nome e a descrição do site e habilita o modo de depuração do WordPress.

## Os benefícios dos Blueprints

Blueprints são uma ferramenta inestimável para construir sites WordPress via Playground.

-   **Flexibilidade**: os desenvolvedores podem fazer ajustes granulares no processo de construção.
-   **Consistência**: garante que cada novo site comece com a mesma configuração.
-   **Leveza**: pequenos arquivos de texto que são fáceis de armazenar e transferir.
-   **Transparência**: Um Blueprint inclui todos os comandos necessários para construir uma instantânea de um site WordPress. Você pode lê-lo e entender como o site é construído.
-   **Produtividade**: reduz o processo demorado de configurar manualmente um novo site WordPress. Em vez de instalar e configurar temas e plugins para cada novo projeto, aplique um Blueprint e configure tudo em um único processo.
-   **Dependências atualizadas**: busque a versão mais recente do WordPress, um plugin específico ou um tema. Sua instantânea está sempre atualizada com os últimos recursos e correções de segurança.
-   **Colaboração**: os arquivos `JSON` são fáceis de revisar em ferramentas como o GitHub. Compartilhe Blueprints com sua equipe ou com a comunidade WordPress, permitindo que outros usem sua configuração bem elaborada.
-   **Experimentação e Aprendizado**: Para aqueles novos no WordPress ou que desejam experimentar diferentes configurações, os Blueprints fornecem uma maneira segura e fácil de tentar novas configurações sem "quebrar" um site ao vivo.
-   **Integração com WordPress.org**: ofereça uma [demonstração do seu plugin](https://developer.wordpress.org/plugins/wordpress-org/previews-and-blueprints/) no diretório de plugins do WordPress, ou uma prévia em um [ticket do Theme Trac](https://meta.trac.wordpress.org/ticket/7382).
-   **Criando um ambiente de desenvolvimento**: Um novo desenvolvedor na equipe pode baixar o Blueprint, executar um hipotético comando `wp up` e obter um novo ambiente de desenvolvimento—carregado com tudo o que precisa. Todo o processo de CI/CD pode reutilizar o mesmo Blueprint.

:::info **Mais Recursos**
Visite estes links para aprender mais sobre as (incontáveis) possibilidades dos Blueprints:

-   [Introdução ao WordPress Playground](https://developer.wordpress.org/news/2024/04/05/introduction-to-playground-running-wordpress-in-the-browser/)
-   Incorpore um site WordPress pré-configurado em seu site usando o [Bloco do WordPress Playground](https://wordpress.org/plugins/interactive-code-block/).
-   [Exemplos de Blueprints](/blueprints/examples)
-   [Demonstrações e aplicativos construídos com Blueprints](/resources#apps-built-with-wordpress-playground)

:::
