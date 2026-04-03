---
title: Paquetes de Blueprint
slug: /blueprints/bundles
description: Conoce los paquetes de Blueprint, paquetes autocontenidos que incluyen un archivo blueprint.json y todos los recursos necesarios.
---

<!--
title: Blueprint Bundles
description: Learn about Blueprint bundles, self-contained packages that include a blueprint.json file and all its required resources.
-->

# Paquetes de Blueprint

<!--
# Blueprint Bundles
-->

Los paquetes de Blueprint son paquetes autocontenidos que incluyen una declaración de Blueprint (`blueprint.json`) junto con todos los recursos adicionales necesarios para compilarlo y ejecutarlo. Así es más fácil distribuir y compartir configuraciones completas de WordPress Playground.

<!--
Blueprint bundles are self-contained packages that include a Blueprint declaration (`blueprint.json`) along with all the additional resources required to compile and run it. This makes it easier to distribute and share complete WordPress Playground setups.
-->

## ¿Qué son los paquetes de Blueprint?

<!--
## What are Blueprint Bundles?
-->

Un paquete de Blueprint es una colección de archivos que incluye:

<!--
A Blueprint bundle is a collection of files that includes:
-->

1. Un archivo `blueprint.json` que define la configuración del Blueprint
2. Cualquier recurso adicional al que haga referencia el Blueprint (temas, plugins, archivos de contenido, etc.)

<!--
1. A `blueprint.json` file that defines the Blueprint configuration
2. Any additional resources referenced by the Blueprint (themes, plugins, content files, etc.)
-->

Los paquetes de Blueprint pueden distribuirse en varios formatos:

<!--
Blueprint bundles can be distributed in various formats:
-->

- Un archivo ZIP con un `blueprint.json` en el nivel superior y recursos adicionales
- Un directorio dentro de un repositorio git donde `blueprint.json` convive con otros recursos
- Un directorio local en tu equipo
- Un objeto JavaScript en línea con los archivos pertinentes incrustados

<!--
- A ZIP file with a top-level `blueprint.json` file and additional resources
- A directory inside a git repository where `blueprint.json` resides alongside other resources
- A local directory on your computer
- An inline JavaScript object with the relevant files inlined
-->

## Uso de paquetes de Blueprint

<!--
## Using Blueprint Bundles
-->

### En el sitio web

<!--
### On the Website
-->

El sitio de WordPress Playground admite paquetes de Blueprint mediante el parámetro de consulta `?blueprint-url=`. Puedes indicar la URL de un archivo ZIP con tu paquete de Blueprint:

<!--
The WordPress Playground website supports Blueprint bundles through the `?blueprint-url=` query parameter. You can provide a URL to a ZIP file containing your Blueprint bundle:
-->

```
https://playground.wordpress.net/?blueprint-url=https://example.com/my-blueprint-bundle.zip
```

<!--
```
https://playground.wordpress.net/?blueprint-url=https://example.com/my-blueprint-bundle.zip
```
-->

El archivo ZIP debe incluir un `blueprint.json` en la raíz, junto con los recursos adicionales a los que haga referencia el Blueprint.

<!--
The ZIP file should contain a `blueprint.json` file at the root level, along with any additional resources referenced by the Blueprint.
-->

### En la CLI

<!--
### In the CLI
-->

Playground CLI admite paquetes de Blueprint mediante la opción `--blueprint=`. Puedes indicar:

<!--
The Playground CLI supports Blueprint bundles through the `--blueprint=` option. You can provide:
-->

- La ruta a un directorio local que contenga un paquete de Blueprint
- La ruta a un archivo ZIP local que contenga un paquete de Blueprint
- La URL de un paquete de Blueprint remoto (http:// o https://)

<!--
- A path to a local directory containing a Blueprint bundle
- A path to a local ZIP file containing a Blueprint bundle
- A URL to a remote Blueprint bundle (http:// or https://)
-->

Por ejemplo:

<!--
For example:
-->

```bash
# Using a local ZIP file
npx @wp-playground/cli --blueprint=./my-blueprint.zip server

# Using a remote URL
npx @wp-playground/cli --blueprint=https://example.com/my-blueprint.zip server

# Using a local directory
npx @wp-playground/cli --blueprint=./my-blueprint-directory server
```

<!--
```bash
# Using a local ZIP file
npx @wp-playground/cli --blueprint=./my-blueprint.zip server

# Using a remote URL
npx @wp-playground/cli --blueprint=https://example.com/my-blueprint.zip server

# Using a local directory
npx @wp-playground/cli --blueprint=./my-blueprint-directory server
```
-->

Por defecto, la CLI restringe el acceso a archivos locales por seguridad. Si tu Blueprint necesita leer archivos en el mismo directorio padre, debes conceder permiso explícitamente con la opción `--blueprint-may-read-adjacent-files`:

<!--
By default, the CLI restricts access to local files for security reasons. If your Blueprint needs to access files in the same parent directory, you need to explicitly grant permission using the `--blueprint-may-read-adjacent-files` flag:
-->

```bash
npx @wp-playground/cli --blueprint=./my-blueprint.json --blueprint-may-read-adjacent-files server
```

<!--
```bash
npx @wp-playground/cli --blueprint=./my-blueprint.json --blueprint-may-read-adjacent-files server
```
-->

## Crear paquetes de Blueprint

<!--
## Creating Blueprint Bundles
-->

### Estructura básica

<!--
### Basic Structure
-->

Un paquete de Blueprint básico puede tener este aspecto:

<!--
A basic Blueprint bundle might look like this:
-->

```
my-blueprint-bundle/
├── blueprint.json
├── theme.zip
├── plugin.zip
└── content/
    └── sample-content.wxr
```

<!--
```
my-blueprint-bundle/
├── blueprint.json
├── theme.zip
├── plugin.zip
└── content/
    └── sample-content.wxr
```
-->

### Ejemplo de Blueprint con recursos incluidos

<!--
### Example Blueprint with Bundled Resources
-->

Aquí tienes un ejemplo de archivo `blueprint.json` que referencia recursos incluidos en el paquete:

<!--
Here's an example of a `blueprint.json` file that references bundled resources:
-->

```json
{
	"landingPage": "/my-file.txt",
	"steps": [
		{
			"step": "writeFile",
			"path": "/wordpress/my-file.txt",
			"data": {
				"resource": "bundled",
				"path": "/bundled-text-file.txt"
			}
		},
		{
			"step": "installTheme",
			"themeData": {
				"resource": "bundled",
				"path": "/theme.zip"
			}
		},
		{
			"step": "installPlugin",
			"pluginData": {
				"resource": "bundled",
				"path": "/plugin.zip"
			}
		},
		{
			"step": "importWxr",
			"file": {
				"resource": "bundled",
				"path": "/content/sample-content.wxr"
			}
		}
	]
}
```

<!--
```json
{
	"landingPage": "/my-file.txt",
	"steps": [
		{
			"step": "writeFile",
			"path": "/wordpress/my-file.txt",
			"data": {
				"resource": "bundled",
				"path": "/bundled-text-file.txt"
			}
		},
		{
			"step": "installTheme",
			"themeData": {
				"resource": "bundled",
				"path": "/theme.zip"
			}
		},
		{
			"step": "installPlugin",
			"pluginData": {
				"resource": "bundled",
				"path": "/plugin.zip"
			}
		},
		{
			"step": "importWxr",
			"file": {
				"resource": "bundled",
				"path": "/content/sample-content.wxr"
			}
		}
	]
}
```
-->

En este ejemplo, el Blueprint referencia varios recursos incluidos:

<!--
In this example, the Blueprint references several bundled resources:
-->

- Un archivo de texto en `/bundled-text-file.txt`
- Un ZIP de tema en `/theme.zip`
- Un ZIP de plugin en `/plugin.zip`
- Un archivo de contenido WXR en `/content/sample-content.wxr`

<!--
- A text file at `/bundled-text-file.txt`
- A theme ZIP file at `/theme.zip`
- A plugin ZIP file at `/plugin.zip`
- A WXR content file at `/content/sample-content.wxr`
-->

### Crear un paquete ZIP

<!--
### Creating a ZIP Bundle
-->

Para crear un paquete ZIP, crea un directorio con tu `blueprint.json` y todos los recursos necesarios y comprímelo:

<!--
To create a ZIP bundle, simply create a directory with your `blueprint.json` and all required resources, then zip it up:
-->

```bash
# Create a directory for your bundle
mkdir my-blueprint-bundle
cd my-blueprint-bundle

# Create your blueprint.json and add resources
# ...

# Zip it up
zip -r ../my-blueprint-bundle.zip .
```

<!--
```bash
# Create a directory for your bundle
mkdir my-blueprint-bundle
cd my-blueprint-bundle

# Create your blueprint.json and add resources
# ...

# Zip it up
zip -r ../my-blueprint-bundle.zip .
```
-->

## Flexibilidad en la estructura del ZIP

<!--
## ZIP File Structure Flexibility
-->

Los paquetes de Blueprint admiten `blueprint.json` en dos ubicaciones dentro de un archivo ZIP:

<!--
Blueprint bundles support `blueprint.json` at two locations within a ZIP file:
-->

1. **En la raíz** (habitual): `blueprint.json` está directamente en la raíz del ZIP
2. **Un nivel de carpeta**: `blueprint.json` está dentro de un único directorio de primer nivel

<!--
1. **Root level** (standard): `blueprint.json` sits directly at the ZIP root
2. **One directory deep**: `blueprint.json` sits inside a single top-level directory
-->

Así, los ZIP creados con «Comprimir» del menú contextual en macOS (que envuelven el contenido en una carpeta) funcionan sin pasos extra. El directorio de metadatos `__MACOSX` se ignora al detectar el Blueprint.

<!--
This means ZIP files created with macOS's right-click "Compress" feature (which wraps contents in a folder) work automatically. The `__MACOSX` metadata directory is ignored during detection.
-->

**Ejemplo: estas dos estructuras de ZIP son válidas:**

<!--
**Example: Both of these ZIP structures work:**
-->

```
# Structure A (root level)
my-bundle.zip/
├── blueprint.json
├── theme.zip
└── plugin.zip

# Structure B (one directory deep — macOS-style)
my-bundle.zip/
├── my-bundle/
│   ├── blueprint.json
│   ├── theme.zip
│   └── plugin.zip
└── __MACOSX/         ← ignored
```

<!--
```
# Structure A (root level)
my-bundle.zip/
├── blueprint.json
├── theme.zip
└── plugin.zip

# Structure B (one directory deep — macOS-style)
my-bundle.zip/
├── my-bundle/
│   ├── blueprint.json
│   ├── theme.zip
│   └── plugin.zip
└── __MACOSX/         ← ignored
```
-->

Si varios directorios de primer nivel contienen un `blueprint.json`, Playground devuelve un error para evitar ambigüedades.

<!--
If multiple top-level directories contain a `blueprint.json`, Playground returns an error to avoid ambiguity.
-->

## Solución de problemas

<!--
## Troubleshooting
-->

Si tienes problemas con los paquetes de Blueprint:

<!--
If you encounter issues with Blueprint bundles:
-->

1. Comprueba que `blueprint.json` esté en la raíz del ZIP o dentro de un único directorio de primer nivel
2. Verifica que las rutas en las referencias a recursos incluidos sean correctas
3. Comprueba que el ZIP esté bien formado
4. Si usas la CLI, comprueba si necesitas la opción `--blueprint-may-read-adjacent-files`
5. Asegúrate de que el paquete incluye todos los recursos necesarios

<!--
1. Ensure your `blueprint.json` file is at the root level of your ZIP file or inside a single top-level directory
2. Check that all paths in your bundled resource references are correct
3. Verify that your ZIP file is properly formatted
4. When using the CLI, check if you need the `--blueprint-may-read-adjacent-files` flag
5. Ensure all required resources are included in the bundle
-->
