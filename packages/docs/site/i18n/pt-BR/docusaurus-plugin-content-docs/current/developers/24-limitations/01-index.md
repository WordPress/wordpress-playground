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

<!-- ### Browser storage and recovery -->

### Armazenamento do navegador e recuperação

<!-- Playground runs WordPress in the browser. New Playgrounds are autosaved when -->
<!-- browser storage and saving are available, and they appear in **Your -->
<!-- Playgrounds**. Playground keeps up to five recent autosaves. After five exist, -->
<!-- creating another deletes the oldest one. Autosaves are recovery points, not -->
<!-- long-term backups. Store an autosave permanently or export a ZIP when you want -->
<!-- to keep it. -->

O Playground executa o WordPress no navegador. Quando o armazenamento do navegador e o salvamento estão disponíveis, novos Playgrounds são salvos automaticamente e aparecem em **Seus Playgrounds**. O Playground mantém até cinco salvamentos automáticos recentes. Depois que existem cinco, a criação de outro exclui o mais antigo. Salvamentos automáticos são pontos de recuperação, não backups de longo prazo. Armazene um salvamento automático permanentemente ou exporte um ZIP quando quiser mantê-lo.

<!-- Use these storage modes deliberately: -->

Use estes modos de armazenamento de forma consciente:

<!-- - **Autosaved**: stored in browser storage and retained only while it is one of up to five recent autosaves. -->
<!-- - **Saved**: stored permanently in browser storage or saved to a local directory. -->
<!-- - **Temporary**: created with `?storage=temp` or when saving is unavailable. It is discarded when the tab closes or the browser page refreshes. -->

- **Salvo automaticamente**: fica no armazenamento do navegador e é mantido apenas enquanto estiver entre os cinco salvamentos automáticos mais recentes.
- **Salvo**: fica armazenado permanentemente no navegador ou salvo em uma pasta local.
- **Temporário**: é criado com `?storage=temp` ou quando o salvamento não está disponível. Ele é descartado quando a aba é fechada ou a página do navegador é atualizada.

<!-- The Playground **Refresh page** button reloads the WordPress page inside the current Playground. Browser refresh (Cmd+R or F5) reloads the whole Playground app. A stored or autosaved Playground can recover after that reload, but a temporary Playground cannot. -->

O botão **Atualizar página** do Playground recarrega a página do WordPress dentro do Playground atual. A atualização do navegador (Cmd+R ou F5) recarrega todo o aplicativo do Playground. Um Playground armazenado ou salvo automaticamente pode ser recuperado depois dessa atualização, mas um Playground temporário não pode.

<!-- ![The Dock controls for refreshing WordPress, opening storage choices, and exporting the Playground](https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/static/img/dock/persistence-controls.webp) -->

![Os controles do Dock para atualizar o WordPress, abrir opções de armazenamento e exportar o Playground](https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/static/img/dock/persistence-controls.webp)

<!-- Browser storage still belongs to the browser. Storage pressure, private browsing, profile changes, or clearing site data can remove it. Export a ZIP when you need a portable backup. -->

O armazenamento do navegador ainda pertence ao navegador. Limitações de espaço, navegação privativa, mudanças de perfil ou a limpeza dos dados do site podem removê-lo. Exporte um ZIP quando precisar de um backup portátil.

<!-- ![The Your Playgrounds pane with the current Playground](https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/static/img/dock/your-playgrounds.webp) -->

![O painel Seus Playgrounds com o Playground atual](https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/static/img/dock/your-playgrounds.webp)

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

<!-- ### Performance expectations -->

### Expectativas de desempenho

<!-- Loading times vary based on what Playground needs to set up: -->

Os tempos de carregamento variam de acordo com o que o Playground precisa configurar:

<!-- ![Playground performance graph](https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/static/img/playground-performance-graph.webp) -->

![Save Button](https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/static/img/playground-performance-graph.webp)

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

<!-- <blockquote> -->
<!-- <strong>Note:</strong> Opera Mini support is not currently confirmed. -->
<!-- </blockquote> -->

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
