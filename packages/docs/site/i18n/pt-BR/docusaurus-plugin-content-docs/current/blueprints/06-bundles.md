---
title: Pacotes Blueprint
slug: /blueprints/bundles
description: Aprenda sobre pacotes Blueprint, pacotes autocontidos que incluem um arquivo blueprint.json e todos os seus recursos necessários.
---

<!-- # Blueprint Bundles -->

# Pacotes Blueprint

<!-- Blueprint bundles are self-contained packages that include a Blueprint declaration (`blueprint.json`) along with all the additional resources required to compile and run it. This makes it easier to distribute and share complete WordPress Playground setups. -->

Pacotes Blueprint são pacotes autocontidos que incluem uma declaração Blueprint (`blueprint.json`) junto com todos os recursos adicionais necessários para compilar e executá-lo. Isso facilita a distribuição e compartilhamento de configurações completas do WordPress Playground.

<!-- ## What are Blueprint Bundles? -->

## O que são Pacotes Blueprint?

<!-- A Blueprint bundle is a collection of files that includes: -->

Um pacote Blueprint é uma coleção de arquivos que inclui:

<!-- 1. A `blueprint.json` file that defines the Blueprint configuration -->
<!-- 2. Any additional resources referenced by the Blueprint (themes, plugins, content files, etc.) -->

1. Um arquivo `blueprint.json` que define a configuração do Blueprint
2. Quaisquer recursos adicionais referenciados pelo Blueprint (temas, plugins, arquivos de conteúdo, etc.)

<!-- Blueprint bundles can be distributed in various formats: -->

Pacotes Blueprint podem ser distribuídos em vários formatos:

<!-- -   A ZIP file with a top-level `blueprint.json` file and additional resources -->
<!-- -   A directory inside a git repository where `blueprint.json` resides alongside other resources -->
<!-- -   A local directory on your computer -->
<!-- -   An inline JavaScript object with the relevant files inlined -->

-   Um arquivo ZIP com um arquivo `blueprint.json` de nível superior e recursos adicionais
-   Um diretório dentro de um repositório git onde `blueprint.json` reside junto com outros recursos
-   Um diretório local no seu computador
-   Um objeto JavaScript inline com os arquivos relevantes incorporados

<!-- ## Using Blueprint Bundles -->

## Usando Pacotes Blueprint

<!-- ### On the Website -->

### No Site

<!-- The WordPress Playground website supports Blueprint bundles through the `?blueprint-url=` query parameter. You can provide a URL to a ZIP file containing your Blueprint bundle: -->

O site WordPress Playground suporta pacotes Blueprint através do parâmetro de consulta `?blueprint-url=`. Você pode fornecer uma URL para um arquivo ZIP contendo seu pacote Blueprint:

```
https://playground.wordpress.net/?blueprint-url=https://example.com/my-blueprint-bundle.zip
```

<!-- The ZIP file should contain a `blueprint.json` file at the root level, along with any additional resources referenced by the Blueprint. -->

O arquivo ZIP deve conter um arquivo `blueprint.json` no nível raiz, junto com quaisquer recursos adicionais referenciados pelo Blueprint.

<!-- ### In the CLI -->

### No CLI

<!-- The Playground CLI supports Blueprint bundles through the `--blueprint=` option. You can provide: -->

O CLI do Playground suporta pacotes Blueprint através da opção `--blueprint=`. Você pode fornecer:

<!-- -   A path to a local directory containing a Blueprint bundle -->
<!-- -   A path to a local ZIP file containing a Blueprint bundle -->
<!-- -   A URL to a remote Blueprint bundle (http:// or https://) -->

-   Um caminho para um diretório local contendo um pacote Blueprint
-   Um caminho para um arquivo ZIP local contendo um pacote Blueprint
-   Uma URL para um pacote Blueprint remoto (http:// ou https://)

<!-- For example: -->

Por exemplo:

```bash
# Using a local ZIP file
npx @wp-playground/cli --blueprint=./my-blueprint.zip server

# Using a remote URL
npx @wp-playground/cli --blueprint=https://example.com/my-blueprint.zip server

# Using a local directory
npx @wp-playground/cli --blueprint=./my-blueprint-directory server
```

<!-- By default, the CLI restricts access to local files for security reasons. If your Blueprint needs to access files in the same parent directory, you need to explicitly grant permission using the `--blueprint-may-read-adjacent-files` flag: -->

Por padrão, o CLI restringe o acesso a arquivos locais por razões de segurança. Se seu Blueprint precisar acessar arquivos no mesmo diretório pai, você precisa conceder permissão explicitamente usando a flag `--blueprint-may-read-adjacent-files`:

```bash
npx @wp-playground/cli --blueprint=./my-blueprint.json --blueprint-may-read-adjacent-files server
```

<!-- ## Creating Blueprint Bundles -->

## Criando Pacotes Blueprint

<!-- ### Basic Structure -->

### Estrutura Básica

<!-- A basic Blueprint bundle might look like this: -->

Um pacote Blueprint básico pode parecer assim:

```
my-blueprint-bundle/
├── blueprint.json
├── theme.zip
├── plugin.zip
└── content/
    └── sample-content.wxr
```

<!-- ### Example Blueprint with Bundled Resources -->

### Exemplo de Blueprint com Recursos Empacotados

<!-- Here's an example of a `blueprint.json` file that references bundled resources: -->

Aqui está um exemplo de um arquivo `blueprint.json` que referencia recursos empacotados:

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

<!-- In this example, the Blueprint references several bundled resources: -->

Neste exemplo, o Blueprint referencia vários recursos empacotados:

<!-- -   A text file at `/bundled-text-file.txt` -->
<!-- -   A theme ZIP file at `/theme.zip` -->
<!-- -   A plugin ZIP file at `/plugin.zip` -->
<!-- -   A WXR content file at `/content/sample-content.wxr` -->

-   Um arquivo de texto em `/bundled-text-file.txt`
-   Um arquivo ZIP de tema em `/theme.zip`
-   Um arquivo ZIP de plugin em `/plugin.zip`
-   Um arquivo de conteúdo WXR em `/content/sample-content.wxr`

<!-- ### Creating a ZIP Bundle -->

### Criando um Pacote ZIP

<!-- To create a ZIP bundle, simply create a directory with your `blueprint.json` and all required resources, then zip it up: -->

Para criar um pacote ZIP, simplesmente crie um diretório com seu `blueprint.json` e todos os recursos necessários, depois compacte-o:

```bash
# Create a directory for your bundle
mkdir my-blueprint-bundle
cd my-blueprint-bundle

# Create your blueprint.json and add resources
# ...

# Zip it up
zip -r ../my-blueprint-bundle.zip .
```

<!-- ## Troubleshooting -->

## Solução de Problemas

<!-- If you encounter issues with Blueprint bundles: -->

Se você encontrar problemas com pacotes Blueprint:

<!-- 1. Ensure your `blueprint.json` file is at the root level of your ZIP file -->
<!-- 2. Check that all paths in your bundled resource references are correct -->
<!-- 3. Verify that your ZIP file is properly formatted -->
<!-- 4. When using the CLI, check if you need the `--blueprint-may-read-adjacent-files` flag -->
<!-- 5. Ensure all required resources are included in the bundle -->

1. Certifique-se de que seu arquivo `blueprint.json` está no nível raiz do seu arquivo ZIP
2. Verifique se todos os caminhos nas suas referências de recursos empacotados estão corretos
3. Verifique se seu arquivo ZIP está formatado corretamente
4. Ao usar o CLI, verifique se você precisa da flag `--blueprint-may-read-adjacent-files`
5. Certifique-se de que todos os recursos necessários estão incluídos no pacote
