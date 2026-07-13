---
title: Importando conteúdo para o WordPress com Blueprints
slug: /guides/import-content-with-blueprints
description: Compare exportações WXR, runPHP e snapshots ZIP para importar conteúdo em uma nova instância do WordPress Playground.
---

<!-- # Importing content into WordPress with Blueprints -->

# Importando conteúdo para o WordPress com Blueprints

<!--
A new WordPress Playground site starts with basic content. A Blueprint can help
fill that gap from a WordPress export file, generate content with WordPress APIs,
or restore a Playground ZIP snapshot.

This guide focuses on choosing a Blueprint content import method and presents a
small benchmark comparing three approaches. Importing data can be useful for
theme starter content, test fixtures, educational content, and other
demo-building strategies. For more options, see
[Providing content for your demo with Playground](/guides/providing-content-for-your-demo).
-->

Um novo site do WordPress Playground começa com um conteúdo básico. Uma Blueprint
pode ajudar a preencher este gap a partir de um arquivo de exportação do WordPress, gerar
conteúdo com as APIs do WordPress ou restaurar um snapshot ZIP do Playground.

Este guia se concentra na escolha dos métodos de importação de conteúdo via blueprints criar um pequeno benchmark comparando estes três métodos de
importação. Importação de dados podem ser úties para conteúdo inicial de temas, base de testes e conteúdo educacional para outras estratégias
de criação de demonstrações, consulte [Fornecer conteúdo para sua demonstração com o Playground](/guides/providing-content-for-your-demo).

<!-- These approaches solve different problems: -->

Essas abordagens resolvem problemas diferentes:

<!--
| Method                                                                        | Best for                                                          | What it moves                                                                                 |
| ----------------------------------------------------------------------------- | ----------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| [`importWxr`](#import-a-wordpress-xml-export-with-importwxr)                  | Portable content shared between WordPress sites without overwriting existing content | Posts, pages, custom post types, terms, authors, comments, and attachment references          |
| [`runPHP`](#generate-content-with-runphp)                                     | Small, deterministic fixtures and content that needs custom logic | Anything the PHP code creates through WordPress APIs                                          |
| [`importWordPressFiles`](#restore-a-playground-zip-with-importwordpressfiles) | Restoring a complete Playground demo                              | The database and any WordPress files present in the ZIP, such as plugins, themes, and uploads |
-->

| Método                                                                             | Melhor opção para                                                                                                           | O que transfere                                                                                    |
| ---------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| [`importWxr`](#importar-uma-exportação-xml-do-wordpress-com-importwxr)             | Conteúdo portátil compartilhado entre sites WordPress ideal para importar o conteúdo sem sobrescrever o conteúdo antecessor | Posts, páginas, tipos de post personalizados, termos, autores, comentários e referências de anexos |
| [`runPHP`](#gerar-conteúdo-com-runphp)                                             | Pequenos conjuntos de dados determinísticos e lógica personalizada                                                          | Tudo o que o código PHP criar por meio das APIs do WordPress                                       |
| [`importWordPressFiles`](#restaurar-um-zip-do-playground-com-importwordpressfiles) | Restaurar uma demonstração completa do Playground                                                                           | O banco de dados e os arquivos WordPress presentes no ZIP, como plugins, temas e arquivos enviados |

<!--
If you only need posts and terms, start with WXR. If the content is generated or
depends on setup logic, use `runPHP`. If the database, media, plugins, themes,
and settings must be restored together, use a ZIP snapshot.
-->

Se você precisa apenas de posts e termos, comece com WXR. Se o conteúdo for
gerado ou depender da lógica de configuração, use `runPHP`. Se o banco de dados,
a mídia, os plugins, os temas e as configurações precisarem ser restaurados
juntos, use um snapshot ZIP.

<!-- ## Import a WordPress XML export with `importWxr` -->

## Importar uma exportação XML do WordPress com `importWxr`

<!--
WordPress calls its XML export format WordPress eXtended RSS, or WXR. Create one
from **Tools > Export** in an existing WordPress site, then pass it to the
[`importWxr` step](/blueprints/steps).

This example expects `content.xml` next to `blueprint.json` in a
[Blueprint bundle](/blueprints/bundles):
-->

O WordPress chama seu formato de exportação XML de WordPress eXtended RSS, ou
WXR. Crie um em **Ferramentas > Exportar** em um site WordPress existente e
depois forneça-o ao [passo `importWxr`](/blueprints/steps).

Este exemplo espera encontrar `content.xml` ao lado de `blueprint.json` em um
[pacote de Blueprint](/blueprints/bundles):

```json
{
	"$schema": "https://playground.wordpress.net/blueprint-schema.json",
	"landingPage": "/wp-admin/edit.php",
	"preferredVersions": {
		"php": "8.3",
		"wp": "7.0"
	},
	"login": true,
	"steps": [
		{
			"step": "importWxr",
			"file": {
				"resource": "bundled",
				"path": "/content.xml"
			},
			"fetchAttachments": false,
			"rewriteUrls": true,
			"importComments": false,
			"authorsMode": "default-author",
			"defaultAuthorUsername": "admin"
		}
	]
}
```

<!--
For a hosted file, replace the `bundled` resource with a
[`url` resource](/blueprints/steps/resources#urlreference). Set
`fetchAttachments` to `true` when the importer must download the media files
referenced by the WXR file. Network transfer can dominate the total setup time,
so the benchmark later in this guide disables attachment fetching.

`importWxr` can also map imported authors to local users, create users, and
apply explicit URL replacements. See the
[`importWxr` options](/blueprints/steps) before importing content from
another domain.
-->

Para um arquivo hospedado, substitua o recurso `bundled` por um [recurso `url`](/blueprints/steps/resources#urlreference).
Defina `fetchAttachments` como `true` quando o importador precisar baixar os arquivos de mídia referenciados pelo arquivo WXR.
A transferência de rede pode dominar o tempo total de configuração, por isso o benchmark apresentado mais adiante desativa a obtenção de anexos.

O `importWxr` também pode mapear autores importados para usuários locais, criar
usuários e aplicar substituições explícitas de URL. Consulte as
[opções de `importWxr`](/blueprints/steps) antes de importar conteúdo de outro
domínio.

<!-- ### Pros -->

### Vantagens

<!--
- Uses WordPress's standard, portable content exchange format.
- Preserves post types, taxonomies, post meta, authors, comments, and content
  relationships represented in the export.
- Can fetch attachments and rewrite old content URLs for the new site.
- Keeps content separate from the destination's WordPress core, plugins,
  themes, and most site settings.
- Is easy to inspect, version, and edit manually in any text editor because the
  source is XML.
-->

- Usa o formato padrão e portátil do WordPress para troca de conteúdo.
- Preserva tipos de post, taxonomias, metadados de posts, autores, comentários e
  relações de conteúdo representadas na exportação.
- Pode obter anexos e reescrever URLs de conteúdo antigas para o novo site.
- Mantém o conteúdo separado do núcleo do WordPress, dos plugins, dos temas e da
  maioria das configurações do site de destino.
- É fácil de inspecionar, pode ser editado manualmente por qualquer editor de texto, versionar e editar porque a origem está em XML.

<!-- ### Cons -->

### Desvantagens

<!--
- Does not clone the whole site. Plugins, themes, plugin tables, options, and
  files that are not represented in WXR need separate Blueprint steps.
- Attachment imports require network access and depend on the old media URLs
  remaining available.
- Large XML files use more parsing time and memory than restoring an existing
  SQLite database.
- Re-importing the same file can create duplicates; it is not an idempotent
  synchronization format.
- The Blueprint installs the WordPress Importer dependency automatically, which
  adds setup work before the WXR import starts.
-->

- Não clona o site inteiro. Plugins, temas, tabelas de plugins, opções e arquivos
  que não estão representados no WXR precisam de passos de Blueprint separados.
- A importação de anexos exige acesso à rede e depende da disponibilidade das
  URLs antigas de mídia.
- Arquivos XML grandes usam mais tempo de análise e memória do que a restauração
  de um banco de dados SQLite existente.
- Reimportar o mesmo arquivo pode criar duplicatas; esse não é um formato de
  sincronização idempotente.
- O Blueprint instala automaticamente a dependência WordPress Importer, o que
  adiciona trabalho de configuração antes do início da importação WXR.

<!-- ## Generate content with `runPHP` -->

## Gerar conteúdo com `runPHP`

<!--
The [`runPHP` step](/blueprints/steps) can call WordPress APIs directly.
Always load `/wordpress/wp-load.php` before calling functions such as
`wp_insert_post()`.

The following example creates the 100 posts used by the benchmark:
-->

O [passo `runPHP`](/blueprints/steps) pode chamar as APIs do WordPress
diretamente. Sempre carregue `/wordpress/wp-load.php` antes de chamar funções
como `wp_insert_post()`.

O exemplo a seguir cria os 100 posts usados pelo benchmark:

```json
{
	"$schema": "https://playground.wordpress.net/blueprint-schema.json",
	"landingPage": "/wp-admin/edit.php",
	"preferredVersions": {
		"php": "8.3",
		"wp": "7.0"
	},
	"login": true,
	"steps": [
		{
			"step": "runPHP",
			"code": "<?php\nrequire_once '/wordpress/wp-load.php';\n\nfor ( $index = 1; $index <= 100; $index++ ) {\n\t$result = wp_insert_post(\n\t\tarray(\n\t\t\t'post_title'   => 'Benchmark post ' . $index,\n\t\t\t'post_content' => '<!-- wp:paragraph --><p>Blueprint import benchmark content.</p><!-- /wp:paragraph -->',\n\t\t\t'post_status'  => 'publish',\n\t\t\t'post_type'    => 'post',\n\t\t),\n\t\ttrue\n\t);\n\tif ( is_wp_error( $result ) ) {\n\t\tthrow new RuntimeException( $result->get_error_message() );\n\t}\n}"
		}
	]
}
```

<!--
For larger programs, keep the code in a small plugin or split the setup across
focused steps instead of maintaining a very long JSON string. Use WordPress
APIs rather than writing directly to database tables so hooks, caches, and data
validation still run.
-->

Para programas maiores, mantenha o código em um pequeno plugin ou divida a
configuração em passos específicos em vez de manter uma string JSON muito
longa. Use as APIs do WordPress em vez de gravar diretamente nas tabelas do
banco de dados para que os ganchos, caches e a validação de dados continuem
funcionando.

<!-- ### Pros -->

### Vantagens

<!--
- Provides complete control over the generated data and its relationships.
- Requires no content file and no network access.
- Can configure options, post meta, users, taxonomies, and plugin-specific data
  in the same operation.
- Works well for small test fixtures whose source of truth should remain code.
- Can be made idempotent by looking up existing records before creating them.
-->

- Oferece controle completo sobre os dados gerados e suas relações.
- Não exige arquivo de conteúdo nem acesso à rede.
- Pode configurar opções, metadados de posts, usuários, taxonomias e dados
  específicos de plugins na mesma operação.
- Funciona bem para pequenos dados de teste cuja fonte de verdade deve
  permanecer no código.
- Pode se tornar idempotente ao procurar registros existentes antes de criá-los.

<!-- ### Cons -->

### Desvantagens

<!--
- Custom PHP is more verbose than exporting existing editorial content.
- The script must handle errors, reruns, dependencies, and partial failures.
- Code can become coupled to a plugin's APIs or database model.
- Creating many records one at a time still runs WordPress hooks and database
  writes for every record, so performance degrades as the dataset grows.
- A Blueprint is trusted input. Only run PHP from a source you trust.
-->

- O PHP personalizado é mais detalhado do que exportar conteúdo editorial
  existente.
- O script precisa tratar erros, novas execuções, dependências e falhas parciais.
- O código pode ficar acoplado às APIs ou ao modelo de banco de dados de um
  plugin.
- Criar muitos registros individualmente ainda executa os ganchos do WordPress e
  gravações no banco de dados para cada registro, portanto o desempenho piora à
  medida que o conjunto de dados cresce.
- Um Blueprint é uma entrada confiável. Execute PHP apenas de uma fonte em que
  você confia.

<!-- ## Restore a Playground ZIP with `importWordPressFiles` -->

## Restaurar um ZIP do Playground com `importWordPressFiles`

<!--
The [`importWordPressFiles` step](/blueprints/steps) is a
site restore, not a content-only import. It unpacks top-level WordPress files
from a ZIP and replaces the corresponding paths in the new instance. A ZIP
created with Playground's **Download as zip** option includes `wp-content`, its
SQLite database, uploads, and a manifest used to adjust Playground scope URLs.

Place the downloaded file next to `blueprint.json` and reference it as a bundled
resource:
-->

O [passo `importWordPressFiles`](/blueprints/steps) é uma restauração de site,
não uma importação apenas de conteúdo. Ele descompacta os arquivos WordPress de
nível superior de um ZIP e substitui os caminhos correspondentes na nova
instância. Um ZIP criado com a opção **Download as zip** do Playground inclui
`wp-content`, seu banco de dados SQLite, os arquivos enviados e um manifesto
usado para ajustar as URLs de escopo do Playground.

Coloque o arquivo baixado ao lado de `blueprint.json` e referencie-o como um
recurso `bundled`:

```json
{
	"$schema": "https://playground.wordpress.net/blueprint-schema.json",
	"landingPage": "/",
	"preferredVersions": {
		"php": "8.3",
		"wp": "7.0"
	},
	"login": true,
	"steps": [
		{
			"step": "importWordPressFiles",
			"wordPressFilesZip": {
				"resource": "bundled",
				"path": "/site.zip"
			}
		}
	]
}
```

<!--
The ZIP may contain `wp-content` only, a complete WordPress directory, or a
WordPress directory nested inside a wrapper folder. Use `pathInZip` when the
archive contains several sites or when automatic root detection is not enough.

Keep the source and destination WordPress, PHP, theme, and plugin versions
compatible. The step upgrades the imported database and adjusts Playground
scope URLs, but it is not a general migration tool for arbitrary production
server configurations.
-->

O ZIP pode conter apenas `wp-content`, um diretório WordPress completo ou um
diretório WordPress aninhado em uma pasta externa. Use `pathInZip` quando o
arquivo contiver vários sites ou quando a detecção automática da raiz não for
suficiente.

Mantenha compatíveis as versões do WordPress, PHP, tema e plugin na origem e no
destino. O passo atualiza o banco de dados importado e ajusta as URLs de escopo
do Playground, mas não é uma ferramenta geral de migração para configurações
arbitrárias de servidores de produção.

<!-- ### Pros -->

### Vantagens

<!--
- Restores the database, uploads, plugins, themes, and settings together.
- Preserves plugin-specific tables and options that WXR cannot represent.
- Avoids recreating every post through WordPress APIs, which can be efficient
  for a prepared, repeatable demo.
- Works offline when the snapshot is bundled with the Blueprint.
- Produces the closest copy of the source Playground instance.
-->

- Restaura juntos o banco de dados, os arquivos enviados, os plugins, os temas e
  as configurações.
- Preserva tabelas e opções específicas de plugins que o WXR não pode
  representar.
- Evita recriar cada post por meio das APIs do WordPress, o que pode ser
  eficiente para uma demonstração preparada e repetível.
- Funciona offline quando o snapshot está incluído no pacote do Blueprint.
- Produz a cópia mais próxima da instância de origem do Playground.

<!-- ### Cons -->

### Desvantagens

<!--
- Replaces any top-level paths present in the ZIP, so it can overwrite existing
  site state rather than merge content into it.
- Is larger, opaque, and harder to review or resolve in version-control merges.
- Couples the snapshot to its WordPress, PHP, theme, plugin, and database
  versions more tightly than WXR.
- Is unsuitable for importing selected posts into an existing site.
- Must only be restored from a trusted source; it can contain executable PHP
  and an entire database.
-->

- Substitui todos os caminhos de nível superior presentes no ZIP, por isso pode
  sobrescrever o estado atual do site em vez de mesclar conteúdo a ele.
- É maior, menos transparente e mais difícil de revisar ou resolver em mesclagens
  de controle de versão.
- Acopla o snapshot às versões do WordPress, PHP, tema, plugin e banco de dados
  de forma mais rígida que o WXR.
- Não é adequado para importar posts selecionados em um site existente.
- Deve ser restaurado apenas de uma fonte confiável; pode conter PHP executável
  e um banco de dados inteiro.

<!-- ### Test results for the different methods -->

### Resultado dos testes entre os diferentes métodos

<!--
The following test results were measured on July 13, 2026, on an Apple M4 Pro with
24 GB of memory. It used Node.js 22.16, WordPress 7.0, PHP 8.3, 100 posts,
and five fresh-site rounds per method:
-->

O resultado dos testes a seguir foi medido em 13 de julho de 2026, em um Apple M4 Pro com
24 GB de memória. Foram usados Node.js 22.16, WordPress 7.0, PHP 8.3, 100 posts e
cinco rodadas com um site novo para cada método:

<!--
| Method                       |     Input size | Median | Minimum | Maximum | Relative to fastest |
| ---------------------------- | -------------: | -----: | ------: | ------: | ------------------: |
| XML / `importWxr`            |      106.0 KiB | 2.21 s |  2.16 s |  2.25 s |               6.90x |
| PHP / `runPHP`               | Generated code | 2.78 s |  2.76 s |  2.80 s |               8.68x |
| ZIP / `importWordPressFiles` |       50.5 KiB | 320 ms |  318 ms |  322 ms |               1.00x |
-->

| Método                       | Tamanho da entrada | Mediana | Mínimo | Máximo | Em relação ao mais rápido |
| ---------------------------- | -----------------: | ------: | -----: | -----: | ------------------------: |
| XML / `importWxr`            |          106.0 KiB |  2.21 s | 2.16 s | 2.25 s |                     6.90x |
| PHP / `runPHP`               |      Código gerado |  2.78 s | 2.76 s | 2.80 s |                     8.68x |
| ZIP / `importWordPressFiles` |           50.5 KiB |  320 ms | 318 ms | 322 ms |                     1.00x |

<!--
Treat these values as a reference from one machine, not a universal ranking.
The dataset shape matters: attachments favor a self-contained ZIP, complex
WordPress hooks can slow `runPHP`, and WXR's portability may be more important
than raw speed.
-->

Considere esses valores como referência de uma única máquina, não como uma
classificação universal. O formato do conjunto de dados importa: os anexos
favorecem um ZIP autocontido, ganchos complexos do WordPress podem tornar
`runPHP` mais lento e a portabilidade do WXR pode ser mais importante que a
velocidade bruta.

<!-- ## Other content sources -->

## Outras fontes de conteúdo

<!--
Blueprints also support [`importThemeStarterContent`](/blueprints/steps)
for a theme's registered starter content and the
[`wp-cli` step](/blueprints/steps) for commands such as
`wp post generate`. They are useful when the theme or WP-CLI command is already
the canonical source of the demo data, but they are outside this content import
benchmark.
-->

Os Blueprints também oferecem suporte a
[`importThemeStarterContent`](/blueprints/steps) para o conteúdo inicial
registrado de um tema e ao [passo `wp-cli`](/blueprints/steps) para comandos como
`wp post generate`. Eles são úteis quando o tema ou o comando WP-CLI já é a
fonte canônica dos dados da demonstração, mas estão fora deste benchmark de
importação de conteúdo.
