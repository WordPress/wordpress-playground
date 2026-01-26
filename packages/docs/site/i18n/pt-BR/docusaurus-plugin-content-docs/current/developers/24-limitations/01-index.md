---
slug: /developers/limitations
<!-- description: Learn about the current limitations of WordPress Playground, including browser-specific behaviors, temporary storage by design, iframe quirks, and WP-CLI support. -->
description: Conheça as limitações atuais do WordPress Playground, incluindo comportamentos específicos do navegador, armazenamento temporário por design, peculiaridades de iframe e suporte ao WP-CLI.
---

<!-- # Limitations -->

# Limitações

<!-- WordPress Playground is under active development and has some limitations you should keep in mind when running it and developing with it. -->

O WordPress Playground está em desenvolvimento ativo e possui algumas limitações que você deve ter em mente ao utilizá-lo e desenvolver com ele.

<!-- You can track the status of these issues on the [Playground Project board](https://github.com/orgs/WordPress/projects/180). -->

Você pode acompanhar o status dessas questões no [quadro do projeto Playground](https://github.com/orgs/WordPress/projects/180).

<!-- ## In the browser -->

## No navegador

<!-- ### Temporary by design -->

### Temporário por design

<!-- As Playground [streams rather than serves](/about#streamed-not-served) WordPress, all database changes and uploads will be gone when you refresh the page. To avoid losing your work, either [export your work](/quick-start-guide#save-your-site) before or enable storage in the browser/device via the "Save" button found in the top right on the side of the address bar. -->

Como o Playground [transmite ao invés de servir](/about#streamed-not-served) o WordPress, todas as alterações no banco de dados e uploads serão perdidos ao atualizar a página. Para evitar perder seu trabalho, [exporte seu trabalho](/quick-start-guide#save-your-site) antes ou ative o armazenamento no navegador/dispositivo através do botão "Salvar" encontrado no canto superior direito, ao lado da barra de endereços.

<blockquote>
<figure>
<!-- <figcaption><i>1. Exporting Playground:</i></figcaption> -->
<figcaption><i>1. Exportando o Playground:</i></figcaption>

![Save Button](@site/static/img/export-playground.webp)

</figure>

<figure>
<!-- <figcaption><i>2. Save button:</i></figcaption> -->
<figcaption><i>2. Botão Salvar:</i></figcaption>

![Save Button](@site/static/img/saving-playground.webp)

</figure>
</blockquote>

<!-- ### Browser support -->

### Suporte a navegadores

<!-- WordPress Playground is designed to work across all major desktop and mobile browsers. This includes: -->

O WordPress Playground foi projetado para funcionar em todos os principais navegadores de desktop e mobile. Isso inclui:

<!-- - **Desktop browsers**: Chrome, Firefox, Safari, Edge, and other Chromium-based browsers -->
<!-- - **Mobile browsers**: Safari (iOS), Chrome (Android), and other mobile browser variants -->

- **Navegadores desktop**: Chrome, Firefox, Safari, Edge e outros navegadores baseados em Chromium
- **Navegadores mobile**: Safari (iOS), Chrome (Android) e outras variantes de navegadores mobile

<!-- Playground leverages modern web technologies and should function consistently across these browser environments. However, some advanced features may have varying levels of support depending on the specific browser and its version. -->

O Playground utiliza tecnologias web modernas e deve funcionar consistentemente nesses ambientes de navegador. No entanto, alguns recursos avançados podem ter diferentes níveis de suporte dependendo do navegador específico e sua versão.

<blockquote>
<!-- <strong>Note:</strong> Opera Mini support is not currently confirmed. -->
<strong>Nota:</strong> O suporte ao Opera Mini não está confirmado atualmente.
</blockquote>

<!-- ## When developing with Playground -->

## Ao desenvolver com o Playground

<!-- ### Iframe quirks -->

### Peculiaridades do iframe

<!-- Playground renders WordPress in an [`iframe`](/developers/architecture/browser-iframe-rendering) so clicking links with `target="_top"` will reload the page you're working on. -->

O Playground renderiza o WordPress em um [`iframe`](/developers/architecture/browser-iframe-rendering), então clicar em links com `target="_top"` recarregará a página em que você está trabalhando.

<!-- Also, JavaScript popups originating in the `iframe` may not always display. -->

Além disso, pop-ups JavaScript originados no `iframe` podem nem sempre ser exibidos.

<!-- ### Run WordPress PHP functions -->

### Executar funções PHP do WordPress

<!-- Playground supports running PHP code in Blueprints using the [`runPHP` step](/blueprints/steps#RunPHPStep). To run WordPress-specific PHP functions, you'd need to first require [wp-load.php](https://github.com/WordPress/WordPress/blob/master/wp-load.php): -->

O Playground suporta a execução de código PHP em Blueprints usando o [passo `runPHP`](/blueprints/steps#RunPHPStep). Para executar funções PHP específicas do WordPress, é necessário primeiro importar [wp-load.php](https://github.com/WordPress/WordPress/blob/master/wp-load.php):

```json
{
	"step": "runPHP",
	"code": "<?php require_once('wordpress/wp-load.php'); OTHER_CODE ?>"
}
```

<!-- ### Using WP-CLI -->

### Usando WP-CLI

<!-- You can execute `wp-cli` commands via the Blueprints [`wp-cli`](/blueprints/steps#WPCLIStep) step. However, since Playground runs in the browser, it doesn't support the [full array](https://developer.wordpress.org/cli/commands/) of available commands. While there is no definite list of supported commands, experimenting in [the online demo](https://playground.wordpress.net/demos/wp-cli.html) will help you assess what's possible. -->

Você pode executar comandos `wp-cli` através do passo [`wp-cli`](/blueprints/steps#WPCLIStep) dos Blueprints. No entanto, como o Playground roda no navegador, ele não suporta a [lista completa](https://developer.wordpress.org/cli/commands/) de comandos disponíveis. Embora não haja uma lista definitiva de comandos suportados, experimentar na [demonstração online](https://playground.wordpress.net/demos/wp-cli.html) ajudará você a avaliar o que é possível.
