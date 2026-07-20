---
sidebar_position: 5
slug: /developers/apis/query-api
description: Esta página detalha a Query API do WordPress Playground, permitindo configurar uma instância WP via parâmetros de URL.
---

<!--
# Query API
-->

# API de Query

<!--
WordPress Playground exposes a simple API that you can use to configure the Playground in the browser.
-->

O WordPress Playground expõe uma API simples que você pode usar para configurar o Playground no navegador.

<!--
It works by passing configuration options as query parameters to the Playground URL. For example, to install the pendant theme, you would use the following URL:
-->

Ela funciona passando opções de configuração como parâmetros de consulta (query) para a URL do Playground. Por exemplo, para instalar o tema pendant, você usaria a seguinte URL:

```text
https://playground.wordpress.net/?theme=pendant
```

<!--
You can go ahead and try it out. The Playground will automatically install the theme and log you in as an admin. You may even embed this URL in your website using an `<iframe>` tag:
-->

Você pode testar isso agora mesmo. O Playground instalará automaticamente o tema e fará login como administrador. Você pode até incorporar essa URL no seu site usando uma tag `<iframe>`:

```html
<iframe src="https://playground.wordpress.net/?theme=pendant"></iframe>
```

<!--
## Available options
-->

## Opções disponíveis

<!--
| `storage`          |                       | Controls the storage lifecycle. Use `storage=temp` to create a genuinely temporary Playground that is discarded when the page is refreshed or closed. Without it, Playground may autosave the new Playground when browser storage and saving are available.                                                                                                                                                                                                                 |
| `can-save`         |                       | Controls whether the Playground shell offers automatic browser saving. Use `can-save=no` to start a temporary Playground and hide the Dock save status/persistence prompt.                                                                                                                                                                                                                                                                                                  |
| `overlay`          |                       | Opens a Playground tool on page load. Supports `new` for the Dock's **New** pane. For example, `?overlay=new`. `blueprints` is kept as a compatibility alias that opens the same **New** pane, so `?overlay=blueprints` still works. The parameter is removed from the URL when the pane is closed.                                                                                                                                                                         |
-->

| Opção              | Valor padrão          | Descrição                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| ------------------ | --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `php`              | `8.5`                 | Carrega a versão especificada do PHP. Aceita `7.4`, `8.0`, `8.1`, `8.2`, `8.3`, `8.4`, `8.5` ou `latest`.                                                                                                                                                                                                                                                                                                                                                    |
| `wp`               | `latest`              | Carrega a versão especificada do WordPress. Aceita as três últimas versões principais do WordPress. A partir de 1º de junho de 2024, isso significa `6.3`, `6.4` ou `6.5`. Você também pode usar os valores genéricos `latest`, `nightly` ou `beta`.                                                                                                                                                                                                         |
| `blueprint-url`    |                       | A URL do Blueprint usada para configurar esta instância do Playground.                                                                                                                                                                                                                                                                                                                                                                                       |
| `networking`       | `yes`                 | Ativa ou desativa o suporte a rede no Playground. Aceita `yes` ou `no`.                                                                                                                                                                                                                                                                                                                                                                                      |
| `plugin`           |                       | Instala o plugin especificado. Use o nome do plugin conforme aparece na URL do Diretório de Plugins do WordPress. Por exemplo, se a URL for `https://wordpress.org/plugins/wp-lazy-loading/`, o nome do plugin seria `wp-lazy-loading`. Você pode pré-instalar vários plugins com `plugin=coblocks&plugin=wp-lazy-loading&…`. Instalar um plugin faz login automático como admin. Mais de um plugin pode ser instalado repetindo o atributo `plugin` na URL. |
| `theme`            |                       | Instala o tema especificado. Use o nome do tema conforme aparece na URL do Diretório de Temas do WordPress. Por exemplo, se a URL for `https://wordpress.org/themes/disco/`, o nome do tema seria `disco`. Instalar um tema faz login automático como admin. Vários temas podem ser instalados repetindo o atributo `theme` na URL.                                                                                                                          |
| `url`              | `/wp-admin/`          | Carrega a página inicial do WordPress especificada nesta instância do Playground.                                                                                                                                                                                                                                                                                                                                                                            |
| `mode`             | `browser-full-screen` | Determina como a instância do WordPress é exibida: envolta em uma interface de navegador ou em largura total para uma experiência contínua. Aceita `browser-full-screen` ou `seamless`.                                                                                                                                                                                                                                                                      |
| `lazy`             |                       | Adia o carregamento dos assets do Playground até alguém clicar no botão "Executar". Não aceita valores. Se `lazy` for adicionado como parâmetro de URL, o carregamento será adiado.                                                                                                                                                                                                                                                                          |
| `login`            | `yes`                 | Faz login do usuário como admin. Aceita `yes` ou `no`.                                                                                                                                                                                                                                                                                                                                                                                                       |
| `multisite`        | `no`                  | Ativa o modo multisite do WordPress. Aceita `yes` ou `no`.                                                                                                                                                                                                                                                                                                                                                                                                   |
| `import-site`      |                       | Importa arquivos do site e banco de dados a partir de um arquivo ZIP especificado por uma URL.                                                                                                                                                                                                                                                                                                                                                               |
| `import-wxr`       |                       | Importa conteúdo do site a partir de um arquivo WXR especificado por uma URL. Usa o plugin WordPress Importer, então o usuário admin padrão deve estar logado.                                                                                                                                                                                                                                                                                               |
| `site-slug`        |                       | Seleciona qual site carregar do armazenamento do navegador. Se o site especificado não existir, o usuário será solicitado a salvar um novo site com o slug especificado.                                                                                                                                                                                                                                                                                     |
| `storage`          |                       | Controla o ciclo de vida do armazenamento. Use `storage=temp` para criar um Playground realmente temporário, que será descartado quando a página for atualizada ou fechada. Sem esse parâmetro, o Playground poderá salvar automaticamente o novo Playground quando o armazenamento do navegador e o salvamento estiverem disponíveis.                                                                                                                       |
| `language`         | `en_US`               | Define o idioma da instância do WordPress. Deve ser usado em conjunto com `networking=yes`; caso contrário o WordPress não conseguirá baixar traduções.                                                                                                                                                                                                                                                                                                      |
| `core-pr`          |                       | Instala um PR específico do core em https://github.com/WordPress/wordpress-develop. Aceita o número do PR. Por exemplo, `core-pr=6883`.                                                                                                                                                                                                                                                                                                                      |
| `gutenberg-pr`     |                       | Instala um PR específico do Gutenberg em https://github.com/WordPress/gutenberg. Aceita o número do PR. Por exemplo, `gutenberg-pr=65337`.                                                                                                                                                                                                                                                                                                                   |
| `gutenberg-branch` |                       | Instala um branch específico de https://github.com/WordPress/gutenberg. Aceita o nome do branch. Por exemplo, `gutenberg-branch=trunk`.                                                                                                                                                                                                                                                                                                                      |
| `page-title`       |                       | Personaliza o título da aba do navegador. Útil para identificar diferentes instâncias do Playground ao trabalhar com várias abas. O parâmetro é preservado ao navegar entre sites.                                                                                                                                                                                                                                                                           |
| `can-save`         |                       | Controla se a interface do Playground oferece salvamento automático no navegador. Use `can-save=no` para iniciar um Playground temporário e ocultar o status de salvamento e a solicitação de persistência do Dock.                                                                                                                                                                                                                                          |
| `mcp-port`         | `7999`                | Define a porta WebSocket usada pelo bridge MCP para comunicar com o servidor MCP. Por exemplo, `mcp-port=8080`.                                                                                                                                                                                                                                                                                                                                              |
| `overlay`          |                       | Abre uma ferramenta do Playground ao carregar a página. Aceita `new` para o painel **New** do Dock. Por exemplo, `?overlay=new`. `blueprints` é mantido como um alias de compatibilidade que abre o mesmo painel **New**, portanto `?overlay=blueprints` continua funcionando. O parâmetro é removido da URL quando o painel é fechado.                                                                                                                      |

<!--
For example, the following code embeds a Playground with a preinstalled Gutenberg plugin and opens the post editor:
-->

Por exemplo, o código a seguir incorpora um Playground com o plugin Gutenberg pré-instalado e abre o editor de posts:

```html
<iframe src="https://playground.wordpress.net/?plugin=gutenberg&url=/wp-admin/post-new.php&mode=seamless"> </iframe>
```

<div class="callout callout-info">

**Política de CORS**

<!--
To import files from a URL, such as a site zip package, they must be served with `Access-Control-Allow-Origin` header set. For reference, see: [Cross-Origin Resource Sharing (CORS)](https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS#the_http_response_headers).
-->

Para importar arquivos de uma URL, como um pacote zip de site, eles devem ser servidos com o cabeçalho `Access-Control-Allow-Origin` configurado. Para referência, veja: [Cross-Origin Resource Sharing (CORS)](https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS#the_http_response_headers).

</div>

<!--
## GitHub Export Options
-->

## Opções de exportação para o GitHub

<!--
The following additional query parameters may be used to pre-configure the GitHub export form:
-->

Os seguintes parâmetros de consulta adicionais podem ser usados para pré-configurar o formulário de exportação para o GitHub:

- `gh-ensure-auth`: Se definido como `yes`, o Playground exibirá um modal para garantir que o usuário esteja autenticado com o GitHub antes de prosseguir.
- `ghexport-repo-url`: A URL do repositório GitHub para exportação.
- `ghexport-pr-action`: A ação a ser tomada ao exportar (criar ou atualizar).
- `ghexport-playground-root`: O diretório raiz no Playground de onde exportar.
- `ghexport-repo-root`: O diretório raiz no repositório para onde exportar.
- `ghexport-content-type`: O tipo de conteúdo da exportação (plugin, theme, wp-content, custom-paths).
- `ghexport-plugin`: Caminho do plugin. Quando o tipo de conteúdo for `plugin`, pré-seleciona o plugin a ser exportado.
- `ghexport-theme`: Nome do diretório do tema. Quando o tipo de conteúdo for `theme`, pré-seleciona o tema a ser exportado.
- `ghexport-path`: Um caminho relativo a `ghexport-playground-root`. Pode ser fornecido múltiplas vezes. Quando o tipo de conteúdo for `custom-paths`, pré-preenche a lista de caminhos a exportar.
- `ghexport-commit-message`: A mensagem de commit a ser usada na exportação.
- `ghexport-allow-include-zip`: Se deve oferecer uma opção para incluir um arquivo zip na exportação para o GitHub (`yes`, `no`). Opcional. O padrão é `yes`.
