---
slug: /contributing/code
title: Contributi al codice
description: Una guida per i contributi al codice, che copre come fare il fork del repository, configurare un ambiente locale e inviare una pull request.
---

<!--
# Code contributions
-->

# Contributi al codice

<!--
Like all WordPress projects, Playground uses GitHub to manage code and track issues. The main repository is at [https://github.com/WordPress/wordpress-playground](https://github.com/WordPress/wordpress-playground) and the Playground Tools repository is at [https://github.com/WordPress/playground-tools/](https://github.com/WordPress/playground-tools/).

:::info Contribute to Playground Tools

This guide includes links to the main repository, but all the steps and options apply for both. If you're interested in the plugins or [local development](/developers/local-development/) tools—start there.

:::

Browse [the list of open issues](https://github.com/wordpress/wordpress-playground/issues) to find what to work on. The [`Good First Issue`](https://github.com/wordpress/wordpress-playground/issues?q=is%3Aopen+is%3Aissue+label%3A%22Good+First+Issue%22) label is a recommended starting point for first-time contributors.

Be sure to review the following resources before you begin:

-   [Coding principles](/contributing/coding-standards)
-   [Architecture](/developers/architecture)
-   [Vision and Philosophy](https://github.com/WordPress/wordpress-playground/issues/472)
-   [WordPress Playground Roadmap](https://github.com/WordPress/wordpress-playground/issues/525)
-->

Come tutti i progetti WordPress, Playground usa GitHub per gestire il codice e tracciare le issue. Il repository principale è su [https://github.com/WordPress/wordpress-playground](https://github.com/WordPress/wordpress-playground) e il repository Playground Tools è su [https://github.com/WordPress/playground-tools/](https://github.com/WordPress/playground-tools/).

:::info Contribuire a Playground Tools

Questa guida include link al repository principale, ma tutti i passaggi e le opzioni si applicano ad entrambi. Se sei interessato ai plugin o agli strumenti di [sviluppo locale](/developers/local-development/)—inizia da lì.

:::

Sfoglia [l'elenco delle issue aperte](https://github.com/wordpress/wordpress-playground/issues) per trovare su cosa lavorare. L'etichetta [`Good First Issue`](https://github.com/wordpress/wordpress-playground/issues?q=is%3Aopen+is%3Aissue+label%3A%22Good+First+Issue%22) è un punto di partenza consigliato per i contributori alle prime armi.

Assicurati di rivedere le seguenti risorse prima di iniziare:

-   [Principi di codifica](/contributing/coding-standards)
-   [Architettura](/developers/architecture)
-   [Visione e Filosofia](https://github.com/WordPress/wordpress-playground/issues/472)
-   [Roadmap di WordPress Playground](https://github.com/WordPress/wordpress-playground/issues/525)

<!--
## Contribute Pull Requests

[Fork the Playground repository](https://github.com/WordPress/wordpress-playground/fork) and clone it to your local machine. To do that, copy and paste these commands into your terminal:

```bash
git clone -b trunk --single-branch --depth 1 --recurse-submodules

# replace `YOUR-GITHUB-USERNAME` with your GitHub username:
git@github.com:YOUR-GITHUB-USERNAME/wordpress-playground.git
cd wordpress-playground
npm install
```

Create a branch, make changes, and test it locally by running the following command:

```bash
npm run dev
```

Playground will open in a new browser tab and refresh automatically with each change.

When your'e ready, commit the changes and submit a Pull Request.

:::info Formatting

We handle code formatting and linting automatically. Relax, type away, and let the machines do the work.

:::
-->

## Contribuire con Pull Request

[Fai il fork del repository Playground](https://github.com/WordPress/wordpress-playground/fork) e clonalo sulla tua macchina locale. Per farlo, copia e incolla questi comandi nel tuo terminale:

```bash
git clone -b trunk --single-branch --depth 1 --recurse-submodules

# sostituisci `YOUR-GITHUB-USERNAME` con il tuo username GitHub:
git@github.com:YOUR-GITHUB-USERNAME/wordpress-playground.git
cd wordpress-playground
npm install
```

Crea un branch, fai le modifiche e testalo localmente eseguendo il seguente comando:

```bash
npm run dev
```

Playground si aprirà in una nuova scheda del browser e si aggiornerà automaticamente ad ogni modifica.

Quando sei pronto, committa le modifiche e invia una Pull Request.

:::info Formattazione

Gestiamo automaticamente la formattazione del codice e il linting. Rilassati, scrivi e lascia che le macchine facciano il lavoro.

:::

<!--
### Running a local Multisite

WordPress Multisite has a few [restrictions when run locally](https://developer.wordpress.org/advanced-administration/multisite/prepare-network/#restrictions). If you plan to test a Multisite network using Playground's `enableMultisite` step, make sure you either change `wp-now`'s default port or set a local test domain running via HTTPS.

To change `wp-now`'s default port to the one supported by WordPress Multisite, run it using the `--port=80` flag:

```bash
npx @wp-now/wp-now start --port=80
```

There are a few ways to set up a local test domain, including editing your `hosts` file. If you're unsure how to do that, we suggest installing [Laravel Valet](https://laravel.com/docs/11.x/valet) and then running the following command:

```bash
valet proxy playground.test http://127.0.0.1:5400 --secure
```

Your dev server is now available on https://playground.test.
-->

### Eseguire un Multisite locale

WordPress Multisite ha alcune [restrizioni quando viene eseguito localmente](https://developer.wordpress.org/advanced-administration/multisite/prepare-network/#restrictions). Se prevedi di testare una rete Multisite usando il passo `enableMultisite` di Playground, assicurati di cambiare la porta predefinita di `wp-now` o di impostare un dominio di test locale in esecuzione tramite HTTPS.

Per cambiare la porta predefinita di `wp-now` a quella supportata da WordPress Multisite, eseguilo usando il flag `--port=80`:

```bash
npx @wp-now/wp-now start --port=80
```

Ci sono diversi modi per impostare un dominio di test locale, incluso modificare il tuo file `hosts`. Se non sei sicuro di come farlo, suggeriamo di installare [Laravel Valet](https://laravel.com/docs/11.x/valet) e poi eseguire il seguente comando:

```bash
valet proxy playground.test http://127.0.0.1:5400 --secure
```

Il tuo server di sviluppo è ora disponibile su https://playground.test.

<!--
## Debugging

### Use VS Code and Chrome

If you're using VS Code and have Chrome installed, you can debug Playground in the code editor:

-   Open the project folder in VS Code.
-   Select Run > Start Debugging from the main menu or press `F5`/`fn`+`F5`.

### Debugging PHP

Playground logs PHP errors in the browser console after every PHP request.
-->

## Debug

### Usa VS Code e Chrome

Se stai usando VS Code e hai Chrome installato, puoi fare il debug di Playground nell'editor di codice:

-   Apri la cartella del progetto in VS Code.
-   Seleziona Esegui > Avvia debug dal menu principale o premi `F5`/`fn`+`F5`.

### Debug di PHP

Playground registra gli errori PHP nella console del browser dopo ogni richiesta PHP.
