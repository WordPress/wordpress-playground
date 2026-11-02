---
title: Importación de contenido en WordPress con Blueprints
slug: /guides/import-content-with-blueprints
description: Compara exportaciones WXR, runPHP e instantáneas ZIP para importar contenido en una nueva instancia de WordPress Playground.
---

<!-- # Importing content into WordPress with Blueprints -->

# Importación de contenido en WordPress con Blueprints

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

Un nuevo sitio de WordPress Playground comienza con contenido básico. Un
Blueprint puede ayudar a cubrir esa carencia a partir de un archivo de
exportación de WordPress, generar contenido con las API de WordPress o restaurar
una instantánea ZIP de Playground.

Esta guía se centra en elegir un método de Blueprint para importar contenido y
presenta un pequeño benchmark que compara tres enfoques. Importar datos puede ser
útil para el contenido inicial de temas, los datos de prueba, el contenido
educativo y otras estrategias para crear demostraciones. Para conocer más
opciones, consulta
[Proporcionar contenido para tu demostración con Playground](/guides/providing-content-for-your-demo).

<!-- These approaches solve different problems: -->

Estos enfoques resuelven problemas diferentes:

<!--
| Method                                                                        | Best for                                                          | What it moves                                                                                 |
| ----------------------------------------------------------------------------- | ----------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| [`importWxr`](#import-a-wordpress-xml-export-with-importwxr)                  | Portable content shared between WordPress sites without overwriting existing content | Posts, pages, custom post types, terms, authors, comments, and attachment references          |
| [`runPHP`](#generate-content-with-runphp)                                     | Small, deterministic fixtures and content that needs custom logic | Anything the PHP code creates through WordPress APIs                                          |
| [`importWordPressFiles`](#restore-a-playground-zip-with-importwordpressfiles) | Restoring a complete Playground demo                              | The database and any WordPress files present in the ZIP, such as plugins, themes, and uploads |
-->

| Método                                                                             | Recomendado para                                                                             | Qué transfiere                                                                                                |
| ---------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| [`importWxr`](#importar-una-exportación-xml-de-wordpress-con-importwxr)            | Contenido portátil compartido entre sitios WordPress sin sobrescribir el contenido existente | Entradas, páginas, tipos de contenido personalizados, términos, autores, comentarios y referencias a adjuntos |
| [`runPHP`](#generar-contenido-con-runphp)                                          | Pequeños datos de prueba deterministas y lógica personalizada                                | Todo lo que el código PHP crea mediante las API de WordPress                                                  |
| [`importWordPressFiles`](#restaurar-un-zip-de-playground-con-importwordpressfiles) | Restaurar una demostración completa de Playground                                            | La base de datos y los archivos WordPress presentes en el ZIP, como plugins, temas y archivos subidos         |

<!--
If you only need posts and terms, start with WXR. If the content is generated or
depends on setup logic, use `runPHP`. If the database, media, plugins, themes,
and settings must be restored together, use a ZIP snapshot.
-->

Si solo necesitas entradas y términos, empieza con WXR. Si el contenido se
genera o depende de lógica de configuración, usa `runPHP`. Si la base de datos,
los medios, los plugins, los temas y los ajustes deben restaurarse juntos, usa
una instantánea ZIP.

<!-- ## Import a WordPress XML export with `importWxr` -->

## Importar una exportación XML de WordPress con `importWxr`

<!--
WordPress calls its XML export format WordPress eXtended RSS, or WXR. Create one
from **Tools > Export** in an existing WordPress site, then pass it to the
[`importWxr` step](/blueprints/steps).

This example expects `content.xml` next to `blueprint.json` in a
[Blueprint bundle](/blueprints/bundles):
-->

WordPress denomina a su formato de exportación XML WordPress eXtended RSS, o
WXR. Crea uno desde **Herramientas > Exportar** en un sitio WordPress existente
y pásalo al [paso `importWxr`](/blueprints/steps).

Este ejemplo espera encontrar `content.xml` junto a `blueprint.json` en un
[paquete de Blueprint](/blueprints/bundles):

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
[`url` resource](/blueprints/steps/resources#urlreference). Set `fetchAttachments`
to `true` when the importer must download the media files referenced by the WXR
file. Network transfer can dominate the total setup time, so the benchmark later
in this guide disables attachment fetching.

`importWxr` can also map imported authors to local users, create users, and
apply explicit URL replacements. See the
[`importWxr` options](/blueprints/steps) before importing content from
another domain.
-->

Para un archivo alojado, sustituye el recurso `bundled` por un
[recurso `url`](/blueprints/steps/resources#urlreference). Establece
`fetchAttachments` en `true` cuando el importador deba descargar los archivos de
medios referenciados por el archivo WXR. La transferencia de red puede dominar
el tiempo total de configuración, por lo que el benchmark posterior desactiva la
descarga de adjuntos.

`importWxr` también puede asignar autores importados a usuarios locales, crear
usuarios y aplicar sustituciones explícitas de URL. Consulta las
[opciones de `importWxr`](/blueprints/steps) antes de importar contenido desde
otro dominio.

<!-- ### Pros -->

### Ventajas

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

- Usa el formato estándar y portátil de intercambio de contenido de WordPress.
- Conserva tipos de contenido, taxonomías, metadatos de entradas, autores,
  comentarios y relaciones de contenido representadas en la exportación.
- Puede descargar adjuntos y reescribir las URL antiguas para el nuevo sitio.
- Mantiene el contenido separado del núcleo de WordPress, los plugins, los temas
  y la mayoría de los ajustes del sitio de destino.
- Es fácil de inspeccionar, versionar y editar manualmente con cualquier editor
  de texto porque el origen es XML.

<!-- ### Cons -->

### Desventajas

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

- No clona el sitio completo. Los plugins, temas, tablas de plugins, opciones y
  archivos no representados en WXR necesitan pasos de Blueprint separados.
- La importación de adjuntos requiere acceso a la red y depende de que las URL
  antiguas de medios sigan disponibles.
- Los archivos XML grandes usan más tiempo de análisis y memoria que restaurar
  una base de datos SQLite existente.
- Volver a importar el mismo archivo puede crear duplicados; no es un formato de
  sincronización idempotente.
- El Blueprint instala automáticamente la dependencia WordPress Importer, lo que
  añade trabajo de configuración antes de iniciar la importación WXR.

<!-- ## Generate content with `runPHP` -->

## Generar contenido con `runPHP`

<!--
The [`runPHP` step](/blueprints/steps) can call WordPress APIs directly.
Always load `/wordpress/wp-load.php` before calling functions such as
`wp_insert_post()`.

The following example creates the 100 posts used by the benchmark:
-->

El [paso `runPHP`](/blueprints/steps) puede llamar directamente a las API de
WordPress. Carga siempre `/wordpress/wp-load.php` antes de llamar a funciones
como `wp_insert_post()`.

El siguiente ejemplo crea las 100 entradas usadas por el benchmark:

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

Para programas mayores, mantén el código en un pequeño plugin o divide la
configuración en pasos específicos en lugar de mantener una cadena JSON muy
larga. Usa las API de WordPress en vez de escribir directamente en las tablas de
la base de datos para que los hooks, las cachés y la validación sigan
funcionando.

<!-- ### Pros -->

### Ventajas

<!--
- Provides complete control over the generated data and its relationships.
- Requires no content file and no network access.
- Can configure options, post meta, users, taxonomies, and plugin-specific data
  in the same operation.
- Works well for small test fixtures whose source of truth should remain code.
- Can be made idempotent by looking up existing records before creating them.
-->

- Ofrece control completo sobre los datos generados y sus relaciones.
- No requiere un archivo de contenido ni acceso a la red.
- Puede configurar opciones, metadatos de entradas, usuarios, taxonomías y datos
  específicos de plugins en la misma operación.
- Funciona bien con pequeños datos de prueba cuya fuente de verdad debe seguir
  siendo el código.
- Puede hacerse idempotente buscando registros existentes antes de crearlos.

<!-- ### Cons -->

### Desventajas

<!--
- Custom PHP is more verbose than exporting existing editorial content.
- The script must handle errors, reruns, dependencies, and partial failures.
- Code can become coupled to a plugin's APIs or database model.
- Creating many records one at a time still runs WordPress hooks and database
  writes for every record, so performance degrades as the dataset grows.
- A Blueprint is trusted input. Only run PHP from a source you trust.
-->

- El PHP personalizado es más extenso que exportar contenido editorial
  existente.
- El script debe gestionar errores, nuevas ejecuciones, dependencias y fallos
  parciales.
- El código puede quedar acoplado a las API o al modelo de base de datos de un
  plugin.
- Crear muchos registros uno a uno sigue ejecutando los hooks de WordPress y
  escrituras en la base de datos para cada registro, por lo que el rendimiento
  empeora al crecer el conjunto de datos.
- Un Blueprint es una entrada de confianza. Ejecuta PHP solo desde una fuente en
  la que confíes.

<!-- ## Restore a Playground ZIP with `importWordPressFiles` -->

## Restaurar un ZIP de Playground con `importWordPressFiles`

<!--
The [`importWordPressFiles` step](/blueprints/steps) is a
site restore, not a content-only import. It unpacks top-level WordPress files
from a ZIP and replaces the corresponding paths in the new instance. A ZIP
created with Playground's **Download as zip** option includes `wp-content`, its
SQLite database, uploads, and a manifest used to adjust Playground scope URLs.

Place the downloaded file next to `blueprint.json` and reference it as a bundled
resource:
-->

El [paso `importWordPressFiles`](/blueprints/steps) restaura un sitio, no importa
solo contenido. Descomprime los archivos WordPress de nivel superior de un ZIP y
reemplaza las rutas correspondientes en la nueva instancia. Un ZIP creado con la
opción **Download as zip** de Playground incluye `wp-content`, su base de datos
SQLite, los archivos subidos y un manifiesto usado para ajustar las URL de
ámbito de Playground.

Coloca el archivo descargado junto a `blueprint.json` y haz referencia a él como
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

El ZIP puede contener solo `wp-content`, un directorio WordPress completo o un
directorio WordPress anidado en una carpeta contenedora. Usa `pathInZip` cuando
el archivo contenga varios sitios o cuando la detección automática de la raíz no
sea suficiente.

Mantén compatibles las versiones de WordPress, PHP, temas y plugins de origen y
destino. El paso actualiza la base de datos importada y ajusta las URL de ámbito
de Playground, pero no es una herramienta de migración general para
configuraciones arbitrarias de servidores de producción.

<!-- ### Pros -->

### Ventajas

<!--
- Restores the database, uploads, plugins, themes, and settings together.
- Preserves plugin-specific tables and options that WXR cannot represent.
- Avoids recreating every post through WordPress APIs, which can be efficient
  for a prepared, repeatable demo.
- Works offline when the snapshot is bundled with the Blueprint.
- Produces the closest copy of the source Playground instance.
-->

- Restaura juntos la base de datos, los archivos subidos, los plugins, los temas
  y los ajustes.
- Conserva tablas y opciones específicas de plugins que WXR no puede
  representar.
- Evita recrear cada entrada mediante las API de WordPress, lo que puede ser
  eficiente para una demostración preparada y repetible.
- Funciona sin conexión cuando la instantánea está incluida con el Blueprint.
- Produce la copia más fiel de la instancia de Playground de origen.

<!-- ### Cons -->

### Desventajas

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

- Sustituye todas las rutas de nivel superior presentes en el ZIP, por lo que
  puede sobrescribir el estado existente del sitio en vez de combinar contenido.
- Es mayor, opaco y más difícil de revisar o resolver en fusiones del control de
  versiones.
- Acopla la instantánea a sus versiones de WordPress, PHP, temas, plugins y base
  de datos de forma más estrecha que WXR.
- No es adecuado para importar entradas seleccionadas en un sitio existente.
- Solo debe restaurarse desde una fuente de confianza; puede contener PHP
  ejecutable y una base de datos completa.

<!-- ### Test results for the different methods -->

### Resultados de las pruebas de los distintos métodos

<!--
The following test results were measured on July 13, 2026, on an Apple M4 Pro with
24 GB of memory. It used Node.js 22.16, WordPress 7.0, PHP 8.3, 100 posts,
and five fresh-site rounds per method:
-->

Los siguientes resultados de las pruebas se midieron el 13 de julio de 2026 en
un Apple M4 Pro con 24 GB de memoria. Se usaron Node.js 22.16, WordPress 7.0, PHP
8.3, 100 entradas y cinco rondas con un sitio nuevo para cada método:

<!--
| Method                       |     Input size | Median | Minimum | Maximum | Relative to fastest |
| ---------------------------- | -------------: | -----: | ------: | ------: | ------------------: |
| XML / `importWxr`            |      106.0 KiB | 2.21 s |  2.16 s |  2.25 s |               6.90x |
| PHP / `runPHP`               | Generated code | 2.78 s |  2.76 s |  2.80 s |               8.68x |
| ZIP / `importWordPressFiles` |       50.5 KiB | 320 ms |  318 ms |  322 ms |               1.00x |
-->

| Método                       | Tamaño de entrada | Mediana | Mínimo | Máximo | Respecto al más rápido |
| ---------------------------- | ----------------: | ------: | -----: | -----: | ---------------------: |
| XML / `importWxr`            |         106.0 KiB |  2.21 s | 2.16 s | 2.25 s |                  6.90x |
| PHP / `runPHP`               |   Código generado |  2.78 s | 2.76 s | 2.80 s |                  8.68x |
| ZIP / `importWordPressFiles` |          50.5 KiB |  320 ms | 318 ms | 322 ms |                  1.00x |

<!--
Treat these values as a reference from one machine, not a universal ranking.
The dataset shape matters: attachments favor a self-contained ZIP, complex
WordPress hooks can slow `runPHP`, and WXR's portability may be more important
than raw speed.
-->

Considera estos valores una referencia de un solo equipo, no una clasificación
universal. La forma del conjunto de datos importa: los adjuntos favorecen un ZIP
autocontenido, los hooks complejos de WordPress pueden ralentizar `runPHP` y la
portabilidad de WXR puede ser más importante que la velocidad bruta.

<!-- ## Other content sources -->

## Otras fuentes de contenido

<!--
Blueprints also support [`importThemeStarterContent`](/blueprints/steps)
for a theme's registered starter content and the
[`wp-cli` step](/blueprints/steps) for commands such as
`wp post generate`. They are useful when the theme or WP-CLI command is already
the canonical source of the demo data, but they are outside this content import
benchmark.
-->

Los Blueprints también admiten
[`importThemeStarterContent`](/blueprints/steps) para el contenido inicial
registrado de un tema y el [paso `wp-cli`](/blueprints/steps) para comandos como
`wp post generate`. Son útiles cuando el tema o el comando WP-CLI ya es la fuente
canónica de los datos de la demostración, pero quedan fuera de este benchmark de
importación de contenido.
