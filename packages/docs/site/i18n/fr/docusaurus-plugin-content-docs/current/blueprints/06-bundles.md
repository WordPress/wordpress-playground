---
title: Paquets Blueprint
slug: /blueprints/bundles
description: Découvrez les paquets Blueprint, des packages autonomes qui incluent un fichier blueprint.json et toutes les ressources nécessaires.
---

<!--
title: Blueprint Bundles
description: Learn about Blueprint bundles, self-contained packages that include a blueprint.json file and all its required resources.
-->

# Paquets Blueprint

<!--
# Blueprint Bundles
-->

Les paquets Blueprint sont des dépendances autonomes qui contiennent une déclaration Blueprint (`blueprint.json`) ainsi que toutes les ressources supplémentaires nécessaires pour le compiler et l’exécuter. Cela facilite la distribution et le partage d’installations WordPress Playground complètes.

<!--
Blueprint bundles are self-contained packages that include a Blueprint declaration (`blueprint.json`) along with all the additional resources required to compile and run it. This makes it easier to distribute and share complete WordPress Playground setups.
-->

## Qu’est-ce qu’un paquet Blueprint ?

<!--
## What are Blueprint Bundles?
-->

Un paquet Blueprint est un ensemble de fichiers qui comprend :

<!--
A Blueprint bundle is a collection of files that includes:
-->

1. Un fichier `blueprint.json` qui définit la configuration du Blueprint
2. Toutes les ressources supplémentaires référencées par le Blueprint (thèmes, extensions, fichiers de contenu, etc.)

<!--
1. A `blueprint.json` file that defines the Blueprint configuration
2. Any additional resources referenced by the Blueprint (themes, plugins, content files, etc.)
-->

Les paquets Blueprint peuvent être distribués sous plusieurs formes :

<!--
Blueprint bundles can be distributed in various formats:
-->

- Un fichier ZIP avec un fichier `blueprint.json` à la racine et des ressources supplémentaires
- Un répertoire dans un dépôt Git où un fichier `blueprint.json` se trouve à côté des autres ressources
- Un répertoire local sur votre ordinateur
- Un objet JavaScript intégré avec les fichiers pertinents incorporés

<!--
- A ZIP file with a top-level `blueprint.json` file and additional resources
- A directory inside a git repository where `blueprint.json` resides alongside other resources
- A local directory on your computer
- An inline JavaScript object with the relevant files inlined
-->

## Utiliser les paquets Blueprint

<!--
## Using Blueprint Bundles
-->

### Sur le site

<!--
### On the Website
-->

Le site WordPress Playground prend en charge les paquets Blueprint via le paramètre de requête `?blueprint-url=`. Vous pouvez fournir l’URL d’un fichier ZIP contenant votre paquet Blueprint :

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

Le fichier ZIP doit contenir un fichier `blueprint.json` à la racine, ainsi que toutes les ressources supplémentaires référencées par le Blueprint.

<!--
The ZIP file should contain a `blueprint.json` file at the root level, along with any additional resources referenced by the Blueprint.
-->

### Dans la CLI

<!--
### In the CLI
-->

Playground CLI prend en charge les paquets Blueprint via l’option `--blueprint=`. Vous pouvez indiquer :

<!--
The Playground CLI supports Blueprint bundles through the `--blueprint=` option. You can provide:
-->

- Le chemin vers un répertoire local contenant un paquet Blueprint
- Le chemin vers un fichier ZIP local contenant un paquet Blueprint
- L’URL d’un paquet Blueprint distant (http:// ou https://)

<!--
- A path to a local directory containing a Blueprint bundle
- A path to a local ZIP file containing a Blueprint bundle
- A URL to a remote Blueprint bundle (http:// or https://)
-->

Par exemple :

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

Par défaut, la CLI limite l’accès aux fichiers locaux pour des raisons de sécurité. Si votre Blueprint doit accéder à des fichiers dans le même répertoire parent, vous devez l’autoriser explicitement avec le drapeau `--blueprint-may-read-adjacent-files` :

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

## Créer des paquets Blueprint

<!--
## Creating Blueprint Bundles
-->

### Structure de base

<!--
### Basic Structure
-->

Un paquet Blueprint basique peut ressembler à ceci :

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

### Exemple de Blueprint avec ressources groupées

<!--
### Example Blueprint with Bundled Resources
-->

Voici un exemple de fichier `blueprint.json` qui référence des ressources groupées :

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

Dans cet exemple, le Blueprint référence plusieurs ressources groupées :

<!--
In this example, the Blueprint references several bundled resources:
-->

- Un fichier texte à `/bundled-text-file.txt`
- Un fichier ZIP de thème à `/theme.zip`
- Un fichier ZIP d’extension à `/plugin.zip`
- Un fichier de contenu WXR à `/content/sample-content.wxr`

<!--
- A text file at `/bundled-text-file.txt`
- A theme ZIP file at `/theme.zip`
- A plugin ZIP file at `/plugin.zip`
- A WXR content file at `/content/sample-content.wxr`
-->

### Créer un paquet ZIP

<!--
### Creating a ZIP Bundle
-->

Pour créer un paquet ZIP, créez un répertoire avec votre `blueprint.json` et toutes les ressources requises, puis compressez-le :

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

## Souplesse de la structure des fichiers ZIP

<!--
## ZIP File Structure Flexibility
-->

Les paquets Blueprint acceptent `blueprint.json` à deux emplacements dans un fichier ZIP :

<!--
Blueprint bundles support `blueprint.json` at two locations within a ZIP file:
-->

1. **À la racine** (habituel) : `blueprint.json` est directement à la racine du ZIP
2. **Un niveau de dossier** : le fichier `blueprint.json` se trouve dans un seul répertoire de premier niveau

<!--
1. **Root level** (standard): `blueprint.json` sits directly at the ZIP root
2. **One directory deep**: `blueprint.json` sits inside a single top-level directory
-->

Ainsi, les ZIP créés avec « Compresser » au clic droit sous macOS (qui enveloppent le contenu dans un dossier) fonctionnent automatiquement. Le dossier de métadonnées `__MACOSX` est ignoré lors de la détection.

<!--
This means ZIP files created with macOS's right-click "Compress" feature (which wraps contents in a folder) work automatically. The `__MACOSX` metadata directory is ignored during detection.
-->

**Exemple : ces deux structures ZIP conviennent :**

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

Si plusieurs répertoires de premier niveau contiennent un `blueprint.json`, Playground renvoie une erreur pour éviter toute ambiguïté.

<!--
If multiple top-level directories contain a `blueprint.json`, Playground returns an error to avoid ambiguity.
-->

## Dépannage

<!--
## Troubleshooting
-->

En cas de problème avec les paquets Blueprint :

<!--
If you encounter issues with Blueprint bundles:
-->

1. Vérifiez que le fichier `blueprint.json` se trouve à la racine du ZIP ou dans un seul répertoire de premier niveau
2. Contrôlez l'exactitude des chemins référençant les ressources groupées
3. Vérifiez l'intégrité du fichier ZIP
4. Avec la CLI, vérifiez si le drapeau `--blueprint-may-read-adjacent-files` est nécessaire
5. Assurez-vous de la présence de toutes les ressources nécessaires dans le paquet

<!--
1. Ensure your `blueprint.json` file is at the root level of your ZIP file or inside a single top-level directory
2. Check that all paths in your bundled resource references are correct
3. Verify that your ZIP file is properly formatted
4. When using the CLI, check if you need the `--blueprint-may-read-adjacent-files` flag
5. Ensure all required resources are included in the bundle
-->
