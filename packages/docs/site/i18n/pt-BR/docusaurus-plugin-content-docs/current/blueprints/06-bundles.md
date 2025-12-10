---
title: Pacotes de Blueprint
slug: /blueprints/bundles
description: Saiba mais sobre pacotes de Blueprint, pacotes independentes que incluem um arquivo blueprint.json e todos os seus recursos necessários.
---

# Pacotes de Blueprint

Pacotes de Blueprint são coleções independentes que incluem uma declaração de Blueprint (`blueprint.json`) junto com todos os recursos adicionais necessários para compilar e executá-lo. Isso facilita a distribuição e compartilhamento de configurações completas do WordPress Playground.

## O que são Pacotes de Blueprint?

Um pacote de Blueprint é uma coleção de arquivos que inclui:

1. Um arquivo `blueprint.json` que define a configuração do Blueprint
2. Quaisquer recursos adicionais referenciados pelo Blueprint (temas, plugins, arquivos de conteúdo, etc.)

Pacotes de Blueprint podem ser distribuídos em vários formatos:

-   Um arquivo ZIP com um arquivo `blueprint.json` no nível superior e recursos adicionais
-   Um diretório dentro de um repositório git onde `blueprint.json` reside junto com outros recursos
-   Um diretório local no seu computador
-   Um objeto JavaScript inline com os arquivos relevantes embutidos

## Usando Pacotes de Blueprint

### No Website

O website do WordPress Playground suporta pacotes de Blueprint através do parâmetro de consulta `?blueprint-url=`. Você pode fornecer uma URL para um arquivo ZIP contendo seu pacote de Blueprint:

```
https://playground.wordpress.net/?blueprint-url=https://example.com/my-blueprint-bundle.zip
```

O arquivo ZIP deve conter um arquivo `blueprint.json` no nível raiz, junto com quaisquer recursos adicionais referenciados pelo Blueprint.

### Na CLI

A CLI do Playground suporta pacotes de Blueprint através da opção `--blueprint=`. Você pode fornecer:

-   Um caminho para um diretório local contendo um pacote de Blueprint
-   Um caminho para um arquivo ZIP local contendo um pacote de Blueprint
-   Uma URL para um pacote de Blueprint remoto (http:// ou https://)

Por exemplo:

```bash
# Usando um arquivo ZIP local
npx @wp-playground/cli --blueprint=./my-blueprint.zip server

# Usando uma URL remota
npx @wp-playground/cli --blueprint=https://example.com/my-blueprint.zip server

# Usando um diretório local
npx @wp-playground/cli --blueprint=./my-blueprint-directory server
```

Por padrão, a CLI restringe o acesso a arquivos locais por razões de segurança. Se seu Blueprint precisar acessar arquivos no mesmo diretório pai, você precisa conceder permissão explicitamente usando a flag `--blueprint-may-read-adjacent-files`:

```bash
npx @wp-playground/cli --blueprint=./my-blueprint.json --blueprint-may-read-adjacent-files server
```

## Criando Pacotes de Blueprint

### Estrutura Básica

Um pacote de Blueprint básico pode se parecer com isto:

```
my-blueprint-bundle/
├── blueprint.json
├── theme.zip
├── plugin.zip
└── content/
	└── sample-content.wxr
```

### Exemplo de Blueprint com Recursos Empacotados

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

Neste exemplo, o Blueprint referencia vários recursos empacotados:

-   Um arquivo de texto em `/bundled-text-file.txt`
-   Um arquivo ZIP de tema em `/theme.zip`
-   Um arquivo ZIP de plugin em `/plugin.zip`
-   Um arquivo de conteúdo WXR em `/content/sample-content.wxr`

### Criando um Pacote ZIP

Para criar um pacote ZIP, simplesmente crie um diretório com seu `blueprint.json` e todos os recursos necessários, depois compacte-o:

```bash
# Crie um diretório para seu pacote
mkdir my-blueprint-bundle
cd my-blueprint-bundle

# Crie seu blueprint.json e adicione recursos
# ...

# Compacte
zip -r ../my-blueprint-bundle.zip .
```

## Solução de Problemas

Se encontrar problemas com pacotes de Blueprint:

1. Certifique-se de que seu arquivo `blueprint.json` está no nível raiz do seu arquivo ZIP
2. Verifique se todos os caminhos em suas referências de recursos empacotados estão corretos
3. Verifique se seu arquivo ZIP está adequadamente formatado
4. Ao usar a CLI, verifique se você precisa da flag `--blueprint-may-read-adjacent-files`
5. Certifique-se de que todos os recursos necessários estão incluídos no pacote
