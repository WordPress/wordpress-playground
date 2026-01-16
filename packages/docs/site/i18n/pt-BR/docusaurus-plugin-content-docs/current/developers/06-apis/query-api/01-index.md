---
sidebar_position: 5
slug: /developers/apis/query-api
---

<!-- # Query API -->

# API de Query

<!-- WordPress Playground exposes a simple API that you can use to configure the Playground in the browser. -->

O WordPress Playground expõe uma API simples que você pode usar para configurar o Playground no navegador.

<!-- It works by passing configuration options as query parameters to the Playground URL. For example, to install the pendant theme, you would use the following URL: -->

Ela funciona passando opções de configuração como parâmetros de consulta (query) para a URL do Playground. Por exemplo, para instalar o tema pendant, você usaria a seguinte URL:

```text
https://playground.wordpress.net/?theme=pendant
```

<!-- You can go ahead and try it out. The Playground will automatically install the theme and log you in as an admin. You may even embed this URL in your website using an `<iframe>` tag: -->

Você pode testar isso agora mesmo. O Playground irá instalar automaticamente o tema e fazer login como administrador. Você pode até incorporar essa URL no seu site usando uma tag `<iframe>`:

```html
<iframe src="https://playground.wordpress.net/?theme=pendant"></iframe>
```

<!-- ## Available options -->

## Opções disponíveis

| Opção                    | Valor padrão          | Descrição                                                                                                                                                                                                                                                                                                                                                                               |
| ------------------------ | --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `php`                    | `8.0`                 | Carrega a versão especificada do PHP. Aceita `7.4`, `8.0`, `8.1`, `8.2`, `8.3`, `8.4`, `8.5` ou `latest`.                                                                                                                                                                                                                                                                               |
| `wp`                     | `latest`              | Carrega a versão especificada do WordPress. Aceita as três últimas versões principais do WordPress. Em junho de 2024, são `6.3`, `6.4` ou `6.5`. Você também pode usar os valores genéricos `latest`, `nightly` ou `beta`.                                                                                                                                                              |
| `blueprint-url`          |                       | A URL do Blueprint que será usada para configurar esta instância do Playground.                                                                                                                                                                                                                                                                                                         |
| `networking`             | `yes`                 | Ativa ou desativa o suporte a rede no Playground. Aceita `yes` ou `no`.                                                                                                                                                                                                                                                                                                                 |
| `plugin`                 |                       | Instala o plugin especificado. Use o nome do plugin conforme aparece na URL do Diretório de Plugins do WordPress. Por exemplo, se a URL for `https://wordpress.org/plugins/wp-lazy-loading/`, o nome do plugin seria `wp-lazy-loading`. Você pode pré-instalar múltiplos plugins usando `plugin=coblocks&plugin=wp-lazy-loading&…`. Instalar um plugin faz login automático como admin. |
| `theme`                  |                       | Instala o tema especificado. Use o nome do tema conforme aparece na URL do Diretório de Temas do WordPress. Por exemplo, se a URL for `https://wordpress.org/themes/disco/`, o nome do tema seria `disco`. Instalar um tema faz login automático como admin.                                                                                                                            |
| `url`                    | `/wp-admin/`          | Carrega a página inicial do WordPress especificada nesta instância do Playground.                                                                                                                                                                                                                                                                                                       |
| `mode`                   | `browser-full-screen` | Determina como a instância do WordPress é exibida. Pode ser envolta em uma interface de navegador ou em largura total para uma experiência sem bordas. Aceita `browser-full-screen` ou `seamless`.                                                                                                                                                                                      |
| `lazy`                   |                       | Adia o carregamento dos assets do Playground até que alguém clique no botão "Executar". Não aceita valores. Se `lazy` for adicionado como parâmetro de URL, o carregamento será adiado.                                                                                                                                                                                                 |
| `login`                  | `yes`                 | Faz login do usuário como admin. Aceita `yes` ou `no`.                                                                                                                                                                                                                                                                                                                                  |
| `multisite`              | `no`                  | Ativa o modo multisite do WordPress. Aceita `yes` ou `no`.                                                                                                                                                                                                                                                                                                                              |
| `import-site`            |                       | Importa arquivos do site e banco de dados a partir de um arquivo ZIP especificado por uma URL.                                                                                                                                                                                                                                                                                          |
| `import-wxr`             |                       | Importa conteúdo do site a partir de um arquivo WXR especificado por uma URL. Usa o plugin WordPress Importer, então o usuário admin padrão deve estar logado.                                                                                                                                                                                                                          |
| `site-slug`              |                       | Seleciona qual site carregar do armazenamento do navegador.                                                                                                                                                                                                                                                                                                                             |
| `language`               | `en_US`               | Define o idioma da instância do WordPress. Deve ser usado em conjunto com `networking=yes`, caso contrário o WordPress não conseguirá baixar traduções.                                                                                                                                                                                                                                 |
| `core-pr`                |                       | Instala um PR específico do core em https://github.com/WordPress/wordpress-develop. Aceita o número do PR. Por exemplo, `core-pr=6883`.                                                                                                                                                                                                                                                 |
| `gutenberg-pr`           |                       | Instala um PR específico do Gutenberg em https://github.com/WordPress/gutenberg. Aceita o número do PR. Por exemplo, `gutenberg-pr=65337`.                                                                                                                                                                                                                                              |
| `if-stored-site-missing` |                       | Indica como lidar com o cenário em que o parâmetro `site-slug` identifica um site que não existe. Use `if-stored-site-missing=prompt` para indicar que o usuário deve ser perguntado se deseja salvar um novo site com o `site-slug` especificado.                                                                                                                                      |

<!-- For example, the following code embeds a Playground with a preinstalled Gutenberg plugin and opens the post editor: -->

Por exemplo, o código a seguir incorpora um Playground com o plugin Gutenberg pré-instalado e abre o editor de posts:

```html
<iframe src="https://playground.wordpress.net/?plugin=gutenberg&url=/wp-admin/post-new.php&mode=seamless"> </iframe>
```

:::info Política de CORS

<!-- To import files from a URL, such as a site zip package, they must be served with `Access-Control-Allow-Origin` header set. For reference, see: [Cross-Origin Resource Sharing (CORS)](https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS#the_http_response_headers). -->

Para importar arquivos de uma URL, como um pacote zip de site, eles devem ser servidos com o cabeçalho `Access-Control-Allow-Origin` configurado. Para referência, veja: [Cross-Origin Resource Sharing (CORS)](https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS#the_http_response_headers).

:::

<!-- ## GitHub Export Options -->

## Opções de exportação para o GitHub

<!-- The following additional query parameters may be used to pre-configure the GitHub export form: -->

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
