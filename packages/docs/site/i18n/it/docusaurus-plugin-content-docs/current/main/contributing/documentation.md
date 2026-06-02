---
slug: /contributing/documentation
title: Contributi alla documentazione
description: Una guida su come contribuire alla documentazione Playground, dall'apertura di issue all'invio di pull request.
---

<!--
# Documentation contributions
-->

# Contributi alla documentazione

<!--
[WordPress Playground's documentation site](/) is maintained by volunteers like you, who'd love your help.
-->

Il [sito di documentazione di WordPress Playground](/) è mantenuto da volontari come te, che apprezzerebbero il tuo aiuto.

<!--
All documentation-related issues are labeled [`[Type] Documentation`](https://github.com/WordPress/wordpress-playground/issues?q=is%3Aissue%20state%3Aopen%20label%3A%22%5BType%5D%20Documentation%22) or [`[Type] Developer Documentation`](https://github.com/WordPress/wordpress-playground/issues?q=is%3Aissue%20state%3Aopen%20label%3A%22%5BType%5D%20Developer%20Documentation%22) in the [WordPress/wordpress-playground](https://github.com/WordPress/wordpress-playground) repository. Browse the list of open issues to find one you'd like to work on. Alternatively, if you believe something is missing from the current documentation, open an issue to discuss your suggestion.
-->

Tutte le issue relative alla documentazione sono etichettate [`[Type] Documentation`](https://github.com/WordPress/wordpress-playground/issues?q=is%3Aissue%20state%3Aopen%20label%3A%22%5BType%5D%20Documentation%22) o [`[Type] Developer Documentation`](https://github.com/WordPress/wordpress-playground/issues?q=is%3Aissue%20state%3Aopen%20label%3A%22%5BType%5D%20Developer%20Documentation%22) nel repository [WordPress/wordpress-playground](https://github.com/WordPress/wordpress-playground). Sfoglia l'elenco delle issue aperte per trovarne una su cui vorresti lavorare. In alternativa, se ritieni che qualcosa manchi dalla documentazione attuale, apri una issue per discutere il tuo suggerimento.

<!--
## How can I contribute?
-->

## Come posso contribuire?

<!--
You can contribute by [opening an issue in the project repository](https://github.com/WordPress/wordpress-playground/issues/new) and describing what you'd like to add or change.
-->

Puoi contribuire [aprendo una issue nel repository del progetto](https://github.com/WordPress/wordpress-playground/issues/new) e descrivendo cosa vorresti aggiungere o cambiare.

<!--
If you feel up to it, write the content in the issue description, and the project contributors will take care of the rest.
-->

Se ti senti all'altezza, scrivi il contenuto nella descrizione dell'issue, e i contributori del progetto si occuperanno del resto.

<!--
Would you like to see the documentation in your language? Check the [Translation section](/contributing/translations).
-->

Vorresti vedere la documentazione nella tua lingua? Controlla la [sezione Traduzioni](/contributing/translations).

<!--
### Forking the repo, edit files locally and opening Pull Requests

If you are familiar with markdown, you can [fork](https://docs.github.com/en/pull-requests/collaborating-with-pull-requests/working-with-forks/fork-a-repo) the `wordpress-playground` repo and propose changes and new documentation pages by submitting a Pull Request.

The process of creating a branch to open new PRs with translated pages on the [WordPress/wordpress-playground](https://github.com/WordPress/wordpress-playground) repository is the same than contributing to other WordPress repositories such as gutenberg:
https://developer.wordpress.org/block-editor/contributors/code/git-workflow/

The documentation files (`.md` files) are stored in Playground's GitHub repository, [under `/packages/docs/site/docs`](https://github.com/WordPress/wordpress-playground/tree/trunk/packages/docs/site/docs) for English and [`/packages/docs/site/i18n`](https://github.com/WordPress/wordpress-playground/tree/trunk/packages/docs/site/i18n) for other languages.
-->

### Fare il fork del repository, modificare i file localmente e aprire Pull Request

Se hai familiarità con markdown, puoi [fare il fork](https://docs.github.com/en/pull-requests/collaborating-with-pull-requests/working-with-forks/fork-a-repo) del repository `wordpress-playground` e proporre modifiche e nuove pagine di documentazione inviando una Pull Request.

Il processo di creazione di un branch per aprire nuove PR con pagine tradotte sul repository [WordPress/wordpress-playground](https://github.com/WordPress/wordpress-playground) è lo stesso del contribuire ad altri repository WordPress come gutenberg:
https://developer.wordpress.org/block-editor/contributors/code/git-workflow/

I file di documentazione (file `.md`) sono memorizzati nel repository GitHub di Playground, [sotto `/packages/docs/site/docs`](https://github.com/WordPress/wordpress-playground/tree/trunk/packages/docs/site/docs) per l'inglese e [`/packages/docs/site/i18n`](https://github.com/WordPress/wordpress-playground/tree/trunk/packages/docs/site/i18n) per altre lingue.

<!--
### Edit in the browser

If logged in GitHub, you can also edit existing files (or add new ones) and submit a PR directly from the GitHub UI:

1. Find the page you'd like to edit or the directory of the chapter you'd like to add a new page to.
2. Click the **Add Files** button to add a new file, or click on an existing file and then click the pencil icon to edit it.
3. GitHub will ask you to fork the repository and create a new branch with your changes.
4. An editor will open where you can make the changes.
5. When you're done, click the **Commit Changes** button and submit a Pull Request.

That's it! You've just contributed to the WordPress Playground documentation.

This approach means you don't need to clone the repository, set up a local development environment, or run any commands.

The downside is that you won't be able to preview your changes. Keep reading to learn how to review your changes before submitting a Pull Request.
-->

### Modificare nel browser

Se sei loggato su GitHub, puoi anche modificare file esistenti (o aggiungerne di nuovi) e inviare una PR direttamente dall'interfaccia GitHub:

1. Trova la pagina che vorresti modificare o la directory del capitolo a cui vorresti aggiungere una nuova pagina.
2. Clicca il pulsante **Add Files** per aggiungere un nuovo file, o clicca su un file esistente e poi clicca l'icona della matita per modificarlo.
3. GitHub ti chiederà di fare il fork del repository e creare un nuovo branch con le tue modifiche.
4. Si aprirà un editor dove puoi fare le modifiche.
5. Quando hai finito, clicca il pulsante **Commit Changes** e invia una Pull Request.

Ecco fatto! Hai appena contribuito alla documentazione WordPress Playground.

Questo approccio significa che non devi clonare il repository, configurare un ambiente di sviluppo locale o eseguire comandi.

Lo svantaggio è che non sarai in grado di visualizzare in anteprima le tue modifiche. Continua a leggere per imparare come rivedere le tue modifiche prima di inviare una Pull Request.

<!--
### Local preview

Clone the repository and navigate to the directory on your device. Now run the following commands:

```bash
npm install
npm run build:docs
npm run dev:docs
```

The documentation site opens in a new browser tab and refreshes automatically with each change. Continue to edit the relevant file in your code editor and test the changes in real-time.
-->

### Anteprima locale

Clona il repository e naviga nella directory sul tuo dispositivo. Ora esegui i seguenti comandi:

```bash
npm install
npm run build:docs
npm run dev:docs
```

Il sito di documentazione si apre in una nuova scheda del browser e si aggiorna automaticamente ad ogni modifica. Continua a modificare il file rilevante nel tuo editor di codice e testa le modifiche in tempo reale.
