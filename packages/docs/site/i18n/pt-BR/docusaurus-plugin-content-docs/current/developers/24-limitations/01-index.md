---
slug: /developers/limitations
description: Conheça as limitações atuais do WordPress Playground, incluindo comportamentos específicos do navegador, armazenamento temporário por design, peculiaridades de iframe e suporte ao WP-CLI.
---

<!--
description: Learn about the current limitations of WordPress Playground, including browser-specific behaviors, temporary storage by design, iframe quirks, and WP-CLI support.
-->

# Limitações

<!--
# Limitations
-->

O WordPress Playground está em desenvolvimento ativo e tem algumas limitações que você deve considerar ao executá-lo e ao desenvolver com ele.

<!--
WordPress Playground is under active development and has some limitations you should keep in mind when running it and developing with it.
-->

Você pode acompanhar o status dessas questões no [quadro do projeto Playground](https://github.com/orgs/WordPress/projects/180).

<!-- ## In the browser -->

## No navegador

<!-- ### Temporary by design -->

### Temporário por design

<!--
### Temporary by design
-->

O Playground cria instâncias novas do WordPress a cada carregamento de página. Atualizar a página do navegador descarta todas as alterações no banco de dados, os arquivos enviados e outras modificações.

<!--
Playground creates fresh WordPress instances on each page load. Refreshing the browser page discards all database changes, uploads, and modifications.
-->

**Por que isso acontece**: o Playground transmite o WordPress diretamente para o seu navegador em vez de servi-lo a partir de um servidor tradicional. Cada atualização recomeça do zero.

<!--
**Why this happens**: Playground streams WordPress directly to your browser rather than serving it from a traditional server. Each refresh starts a clean slate.
-->

**Para preservar seu trabalho:**

<!--
**To persist your work:**
-->

- **Salvar**: ative o armazenamento do navegador pelo botão “Save” (canto superior direito, ao lado da barra de endereços) antes de atualizar a página pela barra do navegador.
- **Para desenvolvimento**: use o [Playground CLI](/developers/local-development/wp-playground-cli), que oferece armazenamento local persistente

<!--
- **Save**: Enable browser storage via the "Save" button (top right, next to address bar), before refreshing the page via the browser bar.
- **For development**: Use [Playground CLI](/developers/local-development/wp-playground-cli) which supports persistent local storage
-->

<div class="callout callout-tip">
O botão de atualização dedicado dentro do Playground apenas recarrega o conteúdo do WordPress — ele preserva seu estado PHP/WP. O botão de atualização do navegador (F5 ou Cmd+R) destrói a instância inteira.
</div>

![Refresh Button](https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/static/img/refresh-playground-button.webp)

<blockquote>
<figure>
<figcaption><i>1. Exportando o Playground:</i></figcaption>

![Save Button](https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/static/img/export-playground.webp)

</figure>

<figure>
<figcaption><i>2. Botão Save:</i></figcaption>

<!--
<figcaption><i>2. Save button:</i></figcaption>
-->

![Save Button](https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/static/img/saving-playground.webp)

</figure>
</blockquote>

<!-- ### Browser support -->

### Suporte a navegadores

<!--
### Browser support
-->

O WordPress Playground foi feito para funcionar nos principais navegadores de computadores e dispositivos móveis. Isso inclui:

<!--
WordPress Playground is designed to work across all major desktop and mobile browsers. This includes:
-->

- **Navegadores para computadores**: Chrome, Firefox, Safari, Edge e outros baseados em Chromium
- **Navegadores para dispositivos móveis**: Safari (iOS), Chrome (Android) e outras variantes

<!--
- **Desktop browsers**: Chrome, Firefox, Safari, Edge, and other Chromium-based browsers
- **Mobile browsers**: Safari (iOS), Chrome (Android), and other mobile browser variants
-->

O Playground usa tecnologias web modernas e deve se comportar de forma consistente nesses ambientes. Ainda assim, alguns recursos avançados podem ter níveis de suporte diferentes conforme o navegador e a versão.

<!-- ### Performance expectations -->

### Expectativas de desempenho

<!--
### Performance expectations
-->

Os tempos de carregamento variam conforme o que o Playground precisa configurar:

<!--
Loading times vary based on what Playground needs to set up:
-->

| Cenário                                | Tempo de carregamento típico          |
| -------------------------------------- | ------------------------------------- |
| WordPress novo (sem plugins)           | 5–10 segundos                         |
| Com plugins pequenos                   | 10–20 segundos                        |
| Com plugins grandes (ex.: WooCommerce) | 30–60 segundos                        |
| Em dispositivos móveis                 | 1,5–2× mais lento que em computadores |

<!--
| Scenario                               | Typical Load Time          |
| -------------------------------------- | -------------------------- |
| Fresh WordPress (no plugins)           | 5-10 seconds               |
| With small plugins                     | 10-20 seconds              |
| With large plugins (e.g., WooCommerce) | 30-60 seconds              |
| On mobile devices                      | 1.5-2x slower than desktop |
-->

![Gráfico com os tempos típicos de carregamento do WordPress Playground](https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/static/img/playground-performance-graph.webp)

<!--
![Graph showing typical WordPress Playground load times](https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/static/img/playground-performance-graph.webp)
-->

**Fatores que afetam o desempenho:**

<!--
**Factors that affect performance:**
-->

- **Tamanho do plugin**: plugins grandes demoram mais para instalar em tempo de execução
- **Velocidade da rede**: arquivos WASM têm entre 15 e 30 MB
- **Memória do dispositivo**: a alocação inicial de memória WASM é de 64 MB, crescendo dinamicamente conforme necessário. Dispositivos com pouca memória podem ficar mais lentos
- **Navegador**: Chrome e Edge costumam ter melhor desempenho; Safari, um pouco mais lento

<!--
- **Plugin size**: Large plugins take longer to install at runtime
- **Network speed**: WASM files are 15-30MB
- **Device memory**: Initial WASM memory allocation is 64MB, growing dynamically as needed. Low-memory devices may experience slowdowns
- **Browser**: Chrome/Edge perform best; Safari slightly slower
-->

<blockquote>
<strong>Nota:</strong> o suporte ao Opera Mini ainda não está confirmado.
</blockquote>

<!-- ## When developing with Playground -->

## Ao desenvolver com o Playground

<!-- ### Iframe quirks -->

### Peculiaridades do iframe

<!--
### Iframe quirks
-->

O Playground renderiza o WordPress em um [`iframe`](/developers/architecture/browser-iframe-rendering), então clicar em links com `target="_top"` recarrega a página em que você está trabalhando.

<!--
Playground renders WordPress in an [`iframe`](/developers/architecture/browser-iframe-rendering) so clicking links with `target="_top"` will reload the page you're working on.
-->

Além disso, pop-ups JavaScript originados no `iframe` podem nem sempre aparecer.

<!-- ### Run WordPress PHP functions -->

### Executar funções PHP do WordPress

<!--
### Run WordPress PHP functions
-->

O Playground permite executar código PHP em Blueprints com o [passo `runPHP`](/blueprints/steps#RunPHPStep). Para usar funções PHP específicas do WordPress, é preciso antes incluir [wp-load.php](https://github.com/WordPress/WordPress/blob/master/wp-load.php):

<!--
Playground supports running PHP code in Blueprints using the [`runPHP` step](/blueprints/steps#RunPHPStep). To run WordPress-specific PHP functions, you'd need to first require [wp-load.php](https://github.com/WordPress/WordPress/blob/master/wp-load.php):
-->

```json
{
	"step": "runPHP",
	"code": "<?php require_once('wordpress/wp-load.php'); OTHER_CODE ?>"
}
```

<!-- ### Using WP-CLI -->

### Usando WP-CLI

Você pode executar comandos `wp-cli` pelo passo [`wp-cli`](/blueprints/steps#WPCLIStep) dos Blueprints. No entanto, como o Playground roda no navegador, ele não oferece suporte à [lista completa](https://developer.wordpress.org/cli/commands/) de comandos disponíveis. Não existe uma lista definitiva de comandos suportados, então experimentar na [demo online](https://playground.wordpress.net/demos/wp-cli.html) ajuda a avaliar o que é possível.

<!--
You can execute `wp-cli` commands via the Blueprints [`wp-cli`](/blueprints/steps#WPCLIStep) step. However, since Playground runs in the browser, it doesn't support the [full array](https://developer.wordpress.org/cli/commands/) of available commands. While there is no definite list of supported commands, experimenting in [the online demo](https://playground.wordpress.net/demos/wp-cli.html) will help you assess what's possible.
-->

Quando você usa o [Playground CLI](/developers/local-development/wp-playground-cli), o comando `php` pode executar scripts PHP, incluindo um arquivo `wp-cli.phar` montado, diretamente no ambiente de execução PHP em WASM.

<!--
When using the [Playground CLI](/developers/local-development/wp-playground-cli), the `php` command can run PHP scripts, including a mounted `wp-cli.phar`, directly in the WASM PHP runtime.
-->

## Melhorias recentes {#recent-improvements}

Várias limitações anteriores foram resolvidas:

- **Arquivos grandes no Playground CLI (>2 GB)**: a CLI agora pode transmitir as respostas diretamente, em vez de armazená-las em buffer na memória. Isso permite exportar sites grandes (por exemplo, backups do All-in-One WP Migration) que antes falhavam.
- **Envio de arquivos via cURL no PHP**: envios de formulários multipart com `CURLFile` agora funcionam corretamente no navegador. O deadlock de `Expect: 100-continue` e os problemas de encaminhamento multipart no proxy CORS foram resolvidos.
- **Respostas PHP de longa duração**: o service worker agora transmite o corpo da resposta depois de receber os cabeçalhos, em vez de armazenar a resposta inteira em buffer. Assim, o corpo da resposta fica fora do tempo limite de 25 segundos das mensagens, e as importações de sites e outras operações demoradas podem continuar depois que os cabeçalhos são recebidos.
- **Tratamento de erros ao baixar arquivos**: quando não é possível baixar um arquivo WASM ou um script necessário devido a um problema de rede, bloqueador de anúncios ou situação semelhante, o Playground exibe um modal de erro útil em vez de uma página em branco.

<!--
## Recent improvements {#recent-improvements}

Several previous limitations have been addressed:

- **Large file downloads in Playground CLI (>2 GB)**: The CLI can now stream responses directly instead of buffering them in memory, enabling large site exports (e.g., All-in-One WP Migration backups) that previously failed.
- **PHP cURL file uploads**: Multipart form uploads via `CURLFile` now work correctly in the browser. The `Expect: 100-continue` deadlock and CORS proxy multipart forwarding issues have been resolved.
- **Long-running PHP responses**: The service worker now streams the response body after receiving the headers instead of buffering the entire response. This keeps the response body outside the 25-second message timeout, so site imports and other long-running operations can continue after the headers are received.
- **Download error handling**: When a required WASM or script download fails because of a network issue, an ad blocker, or a similar problem, Playground displays a helpful error modal instead of a blank page.
-->
