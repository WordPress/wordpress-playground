---
slug: /contributing/coding-standards
title: Principi di codifica
description: Dettaglia i principi di codifica per Playground, concentrandosi su messaggi di errore utili, un'API pubblica minimale e Blueprints.
---

<!--
# Coding principles
-->

# Principi di codifica

<!--
## Error messages

A good error message informs the user of the following steps to take. Any ambiguity in errors thrown by Playground [Public APIs](/developers/apis/) will prompt the developers to open issues.

Consider a network error, for example—can we infer the type of error and display a relevant message summarizing the next steps?

-   **Network error**: "Your internet connection twitched. Try to reload the page.
-   **404**: "Could not find the file".
-   **403**: "The server blocked access to the file".
-   **CORS**: clarify it's a browser security feature and add a link to a detailed explanation (on MDN or another reliable source). Suggest the user move their file somewhere else, like `raw.githubusercontent.com`, and link to a resource explaining how to set up CORS headers on their servers.

We handle code formatting and linting automatically. Relax, type away, and let the machines do the work.
-->

## Messaggi di errore

Un buon messaggio di errore informa l'utente sui passaggi successivi da seguire. Qualsiasi ambiguità negli errori generati dalle [API pubbliche](/developers/apis/) di Playground spingerà gli sviluppatori ad aprire issue.

Considera un errore di rete, per esempio—possiamo dedurre il tipo di errore e visualizzare un messaggio rilevante che riassuma i prossimi passaggi?

-   **Errore di rete**: "La tua connessione internet ha avuto un problema. Prova a ricaricare la pagina."
-   **404**: "Impossibile trovare il file".
-   **403**: "Il server ha bloccato l'accesso al file".
-   **CORS**: chiarisci che è una funzionalità di sicurezza del browser e aggiungi un link a una spiegazione dettagliata (su MDN o un'altra fonte affidabile). Suggerisci all'utente di spostare il proprio file altrove, come `raw.githubusercontent.com`, e linka a una risorsa che spiega come impostare gli header CORS sui loro server.

Gestiamo automaticamente la formattazione del codice e il linting. Rilassati, scrivi e lascia che le macchine facciano il lavoro.

<!--
## Public API

Playground aims to keep the narrowest possible API scope.

Public APIs are easy to add and hard to remove. It only takes one PR to introduce a new API, but it may take a thousand to remove it, especially if other projects have already consumed it.

-   Don't expose unnecessary functions, classes, constants, or other components.
-->

## API pubblica

Playground mira a mantenere lo scope dell'API il più ristretto possibile.

Le API pubbliche sono facili da aggiungere e difficili da rimuovere. Serve solo una PR per introdurre una nuova API, ma potrebbero servire mille per rimuoverla, specialmente se altri progetti l'hanno già utilizzata.

-   Non esporre funzioni, classi, costanti o altri componenti non necessari.

<!--
## Blueprints

[Blueprints](/blueprints/getting-started) are the primary way to interact with Playground. These JSON files describe a set of steps that Playground executes in order.

### Guidelines

Blueprint steps should be **concise and focused**. They should do one thing and do it well.

-   If you need to create a new step, try refactoring an existing one first.
-   If that's not enough, ensure the new step delivers a new capability. Don't replicate the functionality of existing steps.
-   Assume the step would be called more than once.
-   Assume it would run in a specific order.
-   Add unit tests to verify that.

Blueprints should be **intuitive and straightforward**.

-   Don't require arguments that can be optional.
-   Use plain argument. For example, `slug` instead of `path`.
-   Define constants in virtual JSON files—don't modify PHP files.
-   Define a TypeScript type for the Blueprint. That's how Playground generates its JSON schema.
-   Write a function to handle a Blueprint step. Accept the argument of the type you defined.
-   Provide a usage example in the doc string. It's automatically reflected in the docs.
-->

## Blueprints

I [Blueprints](/blueprints/getting-started) sono il modo principale per interagire con Playground. Questi file JSON descrivono una serie di passaggi che Playground esegue in ordine.

### Linee guida

I passaggi dei Blueprints dovrebbero essere **concisi e mirati**. Dovrebbero fare una cosa e farla bene.

-   Se devi creare un nuovo passaggio, prova prima a refactorizzare uno esistente.
-   Se non è sufficiente, assicurati che il nuovo passaggio fornisca una nuova capacità. Non replicare la funzionalità dei passaggi esistenti.
-   Assumi che il passaggio verrà chiamato più di una volta.
-   Assumi che verrà eseguito in un ordine specifico.
-   Aggiungi test unitari per verificarlo.

I Blueprints dovrebbero essere **intuitivi e diretti**.

-   Non richiedere argomenti che possono essere opzionali.
-   Usa argomenti semplici. Per esempio, `slug` invece di `path`.
-   Definisci le costanti in file JSON virtuali—non modificare i file PHP.
-   Definisci un tipo TypeScript per il Blueprint. È così che Playground genera il suo schema JSON.
-   Scrivi una funzione per gestire un passaggio del Blueprint. Accetta l'argomento del tipo che hai definito.
-   Fornisci un esempio di utilizzo nella stringa di documentazione. Viene automaticamente riflesso nella documentazione.
