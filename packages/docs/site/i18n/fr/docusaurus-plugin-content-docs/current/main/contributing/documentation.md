---
slug: /contributing/documentation
title: Contributions à la documentation
description: Un guide sur la façon de contribuer à la documentation de Playground, depuis l'ouverture des issues jusqu'à la soumission des pull requests.
---

<!--# Documentation contributions-->
# Contributions à la documentation

<!--[WordPress Playground's documentation site](/) is maintained by volunteers like you, who'd love your help.-->
[Le site de documentation de Playground](/) est maintenu par des bénévoles comme vous, qui apprécieraient votre aide.

<!--All documentation-related issues are labeled [`[Type] Documentation`](https://github.com/WordPress/wordpress-playground/issues?q=is%3Aissue%20state%3Aopen%20label%3A%22%5BType%5D%20Documentation%22) or [`[Type] Developer Documentation`](https://github.com/WordPress/wordpress-playground/issues?q=is%3Aissue%20state%3Aopen%20label%3A%22%5BType%5D%20Developer%20Documentation%22) in the [WordPress/wordpress-playground](https://github.com/WordPress/wordpress-playground) repository. Browse the list of open issues to find one you'd like to work on. Alternatively, if you believe something is missing from the current documentation, open an issue to discuss your suggestion.-->
Toutes les issues liées à la documentation sont étiquetées [`[Type] Documentation`](https://github.com/WordPress/wordpress-playground/issues?q=is%3Aissue%20state%3Aopen%20label%3A%22%5BType%5D%20Documentation%22) ou [`[Type] Developer Documentation`](https://github.com/WordPress/wordpress-playground/issues?q=is%3Aissue%20state%3Aopen%20label%3A%22%5BType%5D%20Developer%20Documentation%22) dans le dépôt [WordPress/wordpress-playground](https://github.com/WordPress/wordpress-playground). Parcourez la liste des issues ouvertes pour en trouver une sur laquelle vous aimeriez travailler. Alternativement, si vous pensez qu'il manque quelque chose à la documentation actuelle, ouvrez une issue pour discuter de votre suggestion.

<!--## How can I contribute?-->
## Comment puis-je contribuer ?

<!--You can contribute by [opening an issue in the project repository](https://github.com/WordPress/wordpress-playground/issues/new) and describing what you'd like to add or change.-->
Vous pouvez contribuer en [ouvrant une issue dans le dépôt du projet](https://github.com/WordPress/wordpress-playground/issues/new) et en décrivant ce que vous aimeriez ajouter ou modifier.

<!--If you feel up to it, write the content in the issue description, and the project contributors will take care of the rest.-->
Si vous vous sentez prêt·e à le faire, écrivez le contenu dans la description de l’issue, et les contributeurs ou contributrices du projet s’occuperont du reste.

<!--Would you like to see the documentation in your language? Check the [Translation section](/contributing/translations).-->
Vous souhaitez voir la documentation dans votre langue ? Consultez la [section Traductions](/contributing/translations).

<!--### Forking the repo, edit files locally and opening Pull Requests-->
### Forker le dépôt, modifier des fichiers localement et ouvrir des Pull Requests

<!--If you are familiar with markdown, you can [fork](https://docs.github.com/en/pull-requests/collaborating-with-pull-requests/working-with-forks/fork-a-repo) the `wordpress-playground` repo and propose changes and new documentation pages by submitting a Pull Request.-->
Si vous êtes familier ou familière avec markdown, vous pouvez [forker](https://docs.github.com/en/pull-requests/collaborating-with-pull-requests/working-with-forks/fork-a-repo) le dépôt `wordpress-playground` et proposer des changements et de nouvelles pages de documentation en soumettant une pull request (demande de tirage).

<!--The process of creating a branch to open new PRs with translated pages on the [WordPress/wordpress-playground](https://github.com/WordPress/wordpress-playground) repository is the same than contributing to other WordPress repositories such as gutenberg:
https://developer.wordpress.org/block-editor/contributors/code/git-workflow/-->
Le processus de création d'une branche pour ouvrir de nouvelles PR avec les pages traduites dans le dépôt [WordPress/wordpress-playground](https://github.com/WordPress/wordpress-playground) est le même que pour contribuer à d'autres dépôt WordPress comme celui de Gutenberg :
https://developer.wordpress.org/block-editor/contributors/code/git-workflow/

<!--The documentation files (`.md` files) are stored in Playground's GitHub repository, [under `/packages/docs/site/docs`](https://github.com/WordPress/wordpress-playground/tree/trunk/packages/docs/site/docs) for English and [`/packages/docs/site/i18n`](https://github.com/WordPress/wordpress-playground/tree/trunk/packages/docs/site/i18n) for other languages.-->
Les fichiers de documentation (fichiers `.md`) sont stockés dans le dépôt GitHub de Playground, [sous `/packages/docs/site/docs`](https://github.com/WordPress/wordpress-playground/tree/trunk/packages/docs/site/docs) pour l'anglais et [`/packages/docs/site/i18n`](https://github.com/WordPress/wordpress-playground/tree/trunk/packages/docs/site/i18n) pour les autres langues.

<!--### Edit in the browser-->
### Modifier dans le navigateur

<!--If logged in GitHub, you can also edit existing files (or add new ones) and submit a PR directly from the GitHub UI:-->
Si vous êtes connecté·e à GitHub, vous pouvez également modifier des fichiers existants (ou en ajouter de nouveaux) et soumettre un PR directement depuis l'interface utilisateur GitHub :

<!--1. Find the page you'd like to edit or the directory of the chapter you'd like to add a new page to.
2. Click the **Add Files** button to add a new file, or click on an existing file and then click the pencil icon to edit it.
3. GitHub will ask you to fork the repository and create a new branch with your changes.
4. An editor will open where you can make the changes.
5. When you're done, click the **Commit Changes** button and submit a Pull Request.-->

1. Recherchez la page que vous souhaitez modifier ou le répertoire du chapitre auquel vous souhaitez ajouter une nouvelle page.
2. Cliquez sur le bouton **Ajouter des fichiers** pour ajouter un nouveau fichier, ou cliquez sur un fichier existant puis sur l'icône du crayon pour le modifier.
3. GitHub vous demandera de forker le dépôt et de créer une nouvelle branche avec vos modifications.
4. Un éditeur s’ouvre pour vous permettre d'y effectuer les modifications.
5. Lorsque vous avez terminé, cliquez sur le bouton **Commit Changes** et soumettez une Pull Request.

<!--That's it! You've just contributed to the WordPress Playground documentation.-->
Voilà, c’est fait ! Vous venez de contribuer à la documentation de WordPress Playground.

<!--This approach means you don't need to clone the repository, set up a local development environment, or run any commands.-->
Cette approche signifie que vous n’avez pas besoin de cloner le dépôt, de mettre en place un environnement de développement local ou d’exécuter des commandes.

<!--The downside is that you won't be able to preview your changes. Keep reading to learn how to review your changes before submitting a Pull Request.-->
L’inconvénient, c’est que vous ne pourrez pas prévisualiser vos modifications. Continuez à lire pour savoir comment réviser vos modifications avant de soumettre une Pull Request.

<!--### Local preview-->
### Prévisualisation en local

<!--Clone the repository and navigate to the directory on your device. Now run the following commands:-->
Cloner le dépôt et naviguer vers le répertoire de votre machine. Lancer à présent les commandes suivantes :

<!--```bash
npm install
npm run build:docs
npm run dev:docs
```-->
```bash
npm install
npm run build:docs
npm run dev:docs
```

<!--The documentation site opens in a new browser tab and refreshes automatically with each change. Continue to edit the relevant file in your code editor and test the changes in real-time.-->
Le site de documentation s’ouvre dans un nouvel onglet du navigateur et s’actualise automatiquement à chaque modification. Continuez à modifier le fichier concerné dans votre éditeur de code et testez les changements en temps réel.
