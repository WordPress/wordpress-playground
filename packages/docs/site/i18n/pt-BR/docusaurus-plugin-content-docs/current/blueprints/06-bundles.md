---
title: Pacotes de Blueprint
slug: /blueprints/bundles
description: Saiba mais sobre pacotes de Blueprint, pacotes independentes que incluem um arquivo blueprint.json e todos os recursos necessários.
---

<!--
title: Blueprint Bundles
description: Learn about Blueprint bundles, self-contained packages that include a blueprint.json file and all its required resources.
-->

# Pacotes de Blueprint

<!--
# Blueprint Bundles
-->

Pacotes de Blueprint são pacotes autocontidos que incluem uma declaração de Blueprint (`blueprint.json`) e todos os recursos adicionais necessários para compilá-lo e executá-lo. Isso facilita distribuir e compartilhar configurações completas do WordPress Playground.

<!--
Blueprint bundles are self-contained packages that include a Blueprint declaration (`blueprint.json`) along with all the additional resources required to compile and run it. This makes it easier to distribute and share complete WordPress Playground setups.
-->

## O que são pacotes de Blueprint?

<!--
## What are Blueprint Bundles?
-->

Um pacote de Blueprint é uma coleção de arquivos que inclui:

<!--
A Blueprint bundle is a collection of files that includes:
-->

1. Um arquivo `blueprint.json` que define a configuração do Blueprint
2. Quaisquer recursos adicionais referenciados pelo Blueprint (temas, plugins, arquivos de conteúdo, etc.)

<!--
1. A `blueprint.json` file that defines the Blueprint configuration
2. Any additional resources referenced by the Blueprint (themes, plugins, content files, etc.)
-->

Pacotes de Blueprint podem ser distribuídos em vários formatos:

<!--
Blueprint bundles can be distributed in various formats:
-->

- Um arquivo ZIP com `blueprint.json` no nível superior e recursos adicionais
- Um diretório dentro de um repositório git em que o `blueprint.json` fica junto dos demais recursos
- Um diretório local no seu computador
- Um objeto JavaScript inline com os arquivos relevantes embutidos

<!--
- A ZIP file with a top-level `blueprint.json` file and additional resources
- A directory inside a git repository where `blueprint.json` resides alongside other resources
- A local directory on your computer
- An inline JavaScript object with the relevant files inlined
-->

## Usar pacotes de Blueprint

<!--
## Using Blueprint Bundles
-->

### No site

<!--
### On the Website
-->

<!--
The WordPress Playground website supports Blueprint bundles through **New → Blueprint URL** in the Dock or through the `?blueprint-url=` query parameter. You can provide a URL to a ZIP file containing your Blueprint bundle:
-->

O site do WordPress Playground aceita pacotes de Blueprint por **New → Blueprint URL** no Dock ou pelo parâmetro de consulta `?blueprint-url=`. Você pode informar a URL de um arquivo ZIP com o seu pacote de Blueprint:

```
https://playground.wordpress.net/?blueprint-url=https://example.com/my-blueprint-bundle.zip
```

<!--
```
https://playground.wordpress.net/?blueprint-url=https://example.com/my-blueprint-bundle.zip
```
-->

O ZIP deve conter um `blueprint.json` na raiz, além dos recursos adicionais referenciados pelo Blueprint.

<!--
The ZIP file should contain a `blueprint.json` file at the root level, along with any additional resources referenced by the Blueprint.
-->

### Na CLI

<!--
### In the CLI
-->

O Playground CLI aceita pacotes de Blueprint pela opção `--blueprint=`. Você pode informar:

<!--
The Playground CLI supports Blueprint bundles through the `--blueprint=` option. You can provide:
-->

- Caminho para um diretório local com um pacote de Blueprint
- Caminho para um arquivo ZIP local com um pacote de Blueprint
- URL de um pacote remoto (http:// ou https://)

<!--
- A path to a local directory containing a Blueprint bundle
- A path to a local ZIP file containing a Blueprint bundle
- A URL to a remote Blueprint bundle (http:// or https://)
-->

Por exemplo:

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

Por padrão, a CLI restringe o acesso a arquivos locais por segurança. Se o Blueprint precisar ler arquivos no mesmo diretório pai, conceda permissão com a flag `--blueprint-may-read-adjacent-files`:

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

## Criar pacotes de Blueprint

<!--
## Creating Blueprint Bundles
-->

### Estrutura básica

<!--
### Basic Structure
-->

Um pacote de Blueprint básico pode ser assim:

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

### Exemplo de Blueprint com recursos empacotados

<!--
### Example Blueprint with Bundled Resources
-->

Exemplo de `blueprint.json` que referencia recursos empacotados:

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

Neste exemplo, o Blueprint referencia vários recursos empacotados:

<!--
In this example, the Blueprint references several bundled resources:
-->

- Arquivo de texto em `/bundled-text-file.txt`
- ZIP do tema em `/theme.zip`
- ZIP do plugin em `/plugin.zip`
- Arquivo de conteúdo WXR em `/content/sample-content.wxr`

<!--
- A text file at `/bundled-text-file.txt`
- A theme ZIP file at `/theme.zip`
- A plugin ZIP file at `/plugin.zip`
- A WXR content file at `/content/sample-content.wxr`
-->

### Criar um pacote ZIP

<!--
### Creating a ZIP Bundle
-->

Para criar um pacote ZIP, crie um diretório com o `blueprint.json` e todos os recursos necessários e compacte:

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

## Flexibilidade da estrutura do ZIP

<!--
## ZIP File Structure Flexibility
-->

Pacotes de Blueprint aceitam `blueprint.json` em dois locais dentro do ZIP:

<!--
Blueprint bundles support `blueprint.json` at two locations within a ZIP file:
-->

1. **Na raiz** (padrão): `blueprint.json` fica diretamente na raiz do ZIP
2. **Um nível de pasta**: `blueprint.json` fica dentro de um único diretório de primeiro nível

<!--
1. **Root level** (standard): `blueprint.json` sits directly at the ZIP root
2. **One directory deep**: `blueprint.json` sits inside a single top-level directory
-->

Assim, ZIPs criados com «Comprimir» no macOS (que envolvem o conteúdo em uma pasta) funcionam automaticamente. O diretório de metadados `__MACOSX` é ignorado na detecção.

<!--
This means ZIP files created with macOS's right-click "Compress" feature (which wraps contents in a folder) work automatically. The `__MACOSX` metadata directory is ignored during detection.
-->

**Exemplo: estas duas estruturas de ZIP funcionam:**

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

Se vários diretórios de primeiro nível contiverem `blueprint.json`, o Playground retorna um erro para evitar ambiguidade.

<!--
If multiple top-level directories contain a `blueprint.json`, Playground returns an error to avoid ambiguity.
-->

## Solução de problemas

<!--
## Troubleshooting
-->

Se tiver problemas com pacotes de Blueprint:

<!--
If you encounter issues with Blueprint bundles:
-->

1. Confira se o `blueprint.json` está na raiz do ZIP ou dentro de um único diretório de primeiro nível
2. Verifique se os caminhos nas referências a recursos empacotados estão corretos
3. Confirme se o ZIP está bem formado
4. Na CLI, veja se precisa da flag `--blueprint-may-read-adjacent-files`
5. Garanta que todos os recursos necessários estão no pacote

<!--
1. Ensure your `blueprint.json` file is at the root level of your ZIP file or inside a single top-level directory
2. Check that all paths in your bundled resource references are correct
3. Verify that your ZIP file is properly formatted
4. When using the CLI, check if you need the `--blueprint-may-read-adjacent-files` flag
5. Ensure all required resources are included in the bundle
-->
