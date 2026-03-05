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

<!-- ## In the browser {#in-the-browser} -->

## No navegador {#in-the-browser}

<!-- ### Temporary by design {#temporary-by-design} -->

### Temporário por design {#temporary-by-design}

<!-- Playground creates fresh WordPress instances on each page load. Refreshing the browser page discards all database changes, uploads, and modifications. -->

O Playground cria instâncias frescas do WordPress a cada carregamento de página. Atualizar a página do navegador descarta todas as alterações no banco de dados, uploads e modificações.

<!-- **Why this happens**: Playground streams WordPress directly to your browser rather than serving it from a traditional server. Each refresh starts a clean slate. -->

**Por que isso acontece**: O Playground transmite o WordPress diretamente para o seu navegador em vez de servi-lo de um servidor tradicional. Cada atualização começa do zero.

<!-- **To persist your work:** -->

**Para preservar seu trabalho:**

<!-- - **Save**: Enable browser storage via the "Save" button (top right, next to address bar), before refreshing the page via the browser bar. -->
<!-- - **For development**: Use [Playground CLI](/developers/local-development/wp-playground-cli) which supports persistent local storage -->

- **Salvar**: Ative o armazenamento do navegador através do botão "Salvar" (canto superior direito, ao lado da barra de endereços), antes de atualizar a página pela barra do navegador.
- **Para desenvolvimento**: Use o [Playground CLI](/developers/local-development/wp-playground-cli) que suporta armazenamento local persistente

<!-- :::tip -->
<!-- The dedicated refresh button inside Playground only reloads WordPress content—it preserves your PHP/WP state. The browser's refresh button (F5 or Cmd+R) destroys the entire instance. -->
<!-- ::: -->

:::tip
O botão de atualização dedicado dentro do Playground apenas recarrega o conteúdo do WordPress—ele preserva seu estado PHP/WP. O botão de atualização do navegador (F5 ou Cmd+R) destrói a instância inteira.
:::

![Refresh Button](@site/static/img/refresh-playground-button.webp)

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

<!-- ### Browser support {#browser-support} -->

### Suporte a navegadores {#browser-support}

<!-- WordPress Playground is designed to work across all major desktop and mobile browsers. This includes: -->

O WordPress Playground foi projetado para funcionar em todos os principais navegadores de desktop e mobile. Isso inclui:

<!-- - **Desktop browsers**: Chrome, Firefox, Safari, Edge, and other Chromium-based browsers -->
<!-- - **Mobile browsers**: Safari (iOS), Chrome (Android), and other mobile browser variants -->

- **Navegadores desktop**: Chrome, Firefox, Safari, Edge e outros navegadores baseados em Chromium
- **Navegadores mobile**: Safari (iOS), Chrome (Android) e outras variantes de navegadores mobile

<!-- Playground leverages modern web technologies and should function consistently across these browser environments. However, some advanced features may have varying levels of support depending on the specific browser and its version. -->

O Playground utiliza tecnologias web modernas e deve funcionar consistentemente nesses ambientes de navegador. No entanto, alguns recursos avançados podem ter diferentes níveis de suporte dependendo do navegador específico e sua versão.

<!-- ### Performance expectations {#performance-expectations} -->

### Expectativas de desempenho {#performance-expectations}

<!-- Loading times vary based on what Playground needs to set up: -->

Os tempos de carregamento variam de acordo com o que o Playground precisa configurar:

![Save Button](@site/static/img/playground-performance-graph.webp)

<!-- **Factors that affect performance:** -->

**Fatores que afetam o desempenho:**

<!-- - **Plugin size**: Large plugins take longer to install at runtime -->
<!-- - **Network speed**: WASM files are 15-30MB -->
<!-- - **Device memory**: Low-memory devices may experience slowdowns -->
<!-- - **Browser**: Chrome/Edge perform best; Safari slightly slower -->

- **Tamanho do plugin**: Plugins grandes demoram mais para instalar em tempo de execução
- **Velocidade da rede**: Arquivos WASM têm 15-30MB
- **Memória do dispositivo**: Dispositivos com pouca memória podem apresentar lentidão
- **Navegador**: Chrome/Edge têm melhor desempenho; Safari é ligeiramente mais lento

<blockquote>
<!-- <strong>Note:</strong> Opera Mini support is not currently confirmed. -->
<strong>Nota:</strong> O suporte ao Opera Mini não está confirmado atualmente.
</blockquote>

<!-- ## When developing with Playground {#when-developing-with-playground} -->

## Ao desenvolver com o Playground {#when-developing-with-playground}

<!-- ### Iframe quirks {#iframe-quirks} -->

### Peculiaridades do iframe {#iframe-quirks}

<!-- Playground renders WordPress in an [`iframe`](/developers/architecture/browser-iframe-rendering) so clicking links with `target="_top"` will reload the page you're working on. -->

O Playground renderiza o WordPress em um [`iframe`](/developers/architecture/browser-iframe-rendering), então clicar em links com `target="_top"` recarregará a página em que você está trabalhando.

<!-- Also, JavaScript popups originating in the `iframe` may not always display. -->

Além disso, pop-ups JavaScript originados no `iframe` podem nem sempre ser exibidos.

<!-- ### Run WordPress PHP functions {#run-wordpress-php-functions} -->

### Executar funções PHP do WordPress {#run-wordpress-php-functions}

<!-- Playground supports running PHP code in Blueprints using the [`runPHP` step](/blueprints/steps#RunPHPStep). To run WordPress-specific PHP functions, you'd need to first require [wp-load.php](https://github.com/WordPress/WordPress/blob/master/wp-load.php): -->

O Playground suporta a execução de código PHP em Blueprints usando o [passo `runPHP`](/blueprints/steps#RunPHPStep). Para executar funções PHP específicas do WordPress, é necessário primeiro importar [wp-load.php](https://github.com/WordPress/WordPress/blob/master/wp-load.php):

```json
{
	"step": "runPHP",
	"code": "<?php require_once('wordpress/wp-load.php'); OTHER_CODE ?>"
}
```

<!-- ### Using WP-CLI {#using-wp-cli} -->

### Usando WP-CLI {#using-wp-cli}

<!-- You can execute `wp-cli` commands via the Blueprints [`wp-cli`](/blueprints/steps#WPCLIStep) step. However, since Playground runs in the browser, it doesn't support the [full array](https://developer.wordpress.org/cli/commands/) of available commands. While there is no definite list of supported commands, experimenting in [the online demo](https://playground.wordpress.net/demos/wp-cli.html) will help you assess what's possible. -->

Você pode executar comandos `wp-cli` através do passo [`wp-cli`](/blueprints/steps#WPCLIStep) dos Blueprints. No entanto, como o Playground roda no navegador, ele não suporta a [lista completa](https://developer.wordpress.org/cli/commands/) de comandos disponíveis. Embora não haja uma lista definitiva de comandos suportados, experimentar na [demonstração online](https://playground.wordpress.net/demos/wp-cli.html) ajudará você a avaliar o que é possível.
