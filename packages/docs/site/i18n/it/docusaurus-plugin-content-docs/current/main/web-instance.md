---
title: Istanza web
slug: /web-instance
description: Una guida dettagliata all'interfaccia web di playground.wordpress.net, con il Dock, la persistenza, le impostazioni e gli strumenti del sito.
---

<!--
# WordPress Playground web instance
-->

# Istanza web di WordPress Playground

<!--
[https://playground.wordpress.net/](https://playground.wordpress.net/) runs
WordPress in your browser without a server. The page opens a Playground, shows
the WordPress site, and keeps the site tools in the **Dock**.
-->

[https://playground.wordpress.net/](https://playground.wordpress.net/) esegue WordPress nel tuo browser senza bisogno di un server. La pagina apre un Playground, mostra il sito WordPress e raccoglie gli strumenti del sito nel **Dock**.

<!--
![The Playground web instance with the Dock visible at the bottom of the page](https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/static/img/dock/dock-overview.webp)
-->

![L'istanza web di Playground con il Dock visibile in fondo alla pagina](https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/static/img/dock/dock-overview.webp)

<!--
The Dock has an address field, a save status, layout controls, and destinations for creating, storing, inspecting, and exporting Playgrounds.
-->

Il Dock contiene un campo indirizzo, uno stato di salvataggio, i controlli del layout e le sezioni per creare, archiviare, ispezionare ed esportare i Playground.

<!--
## Customize Playground
-->

## Personalizza Playground

<!--
The Dock includes these destinations:
-->

Il Dock include queste sezioni:

<!--
- **New**: Start from the Blueprint gallery, a public Blueprint URL, a new
  Blueprint, a pull request preview, a GitHub repository, or an imported `.zip`
  file.
- **Playgrounds**: Switch between recent and saved Playgrounds.
- **Blueprint**: View, edit, export, and run the current Blueprint.
- **Site Settings**: Configure WordPress version, PHP version, language,
  networking, and multisite.
- **Database**: Inspect or download the SQLite database and open database tools.
- **Files**: Browse and edit files in the WordPress filesystem.
- **Logs**: Inspect PHP errors, warnings, and notices.
- **Export**: Download a `.zip`, copy the original setup link, or export selected
  files to a GitHub pull request.
-->

- **Nuovo**: parti dalla galleria dei Blueprint, dall'URL pubblico di un Blueprint, da un nuovo Blueprint, dall'anteprima di una pull request, da un repository GitHub o da un file `.zip` importato.
- **Playground**: passa da un Playground recente o salvato a un altro.
- **Blueprint**: visualizza, modifica, esporta ed esegui il Blueprint corrente.
- **Impostazioni del sito**: configura versione di WordPress, versione di PHP, lingua, rete e multisito.
- **Database**: ispeziona o scarica il database SQLite e apri gli strumenti per il database.
- **File**: esplora e modifica i file del filesystem di WordPress.
- **Log**: ispeziona errori, avvisi e notice di PHP.
- **Esporta**: scarica un `.zip`, copia il link della configurazione originale oppure esporta i file selezionati in una pull request su GitHub.

<!--
## Navigate inside WordPress
-->

## Naviga dentro WordPress

<!--
Use the Dock address field to open a path inside the current WordPress site.
For example, enter `/wp-admin/` to open the dashboard or
`/wp-admin/plugins.php` to open the Plugins screen. **Refresh page** reloads
the current WordPress path.
-->

Usa il campo indirizzo del Dock per aprire un percorso all'interno del sito WordPress corrente. Per esempio, inserisci `/wp-admin/` per aprire la bacheca oppure `/wp-admin/plugins.php` per aprire la schermata dei plugin. **Aggiorna pagina** ricarica il percorso WordPress corrente.

<!--
![The Refresh page button in the Dock](https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/static/img/refresh-playground-button.webp)
-->

![Il pulsante Aggiorna pagina nel Dock](https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/static/img/refresh-playground-button.webp)

<!--
You can also use the [Query Params API](/developers/apis/query-api/) to open Playground with a specific setup, such as a WordPress version, PHP version, plugin, theme, or Blueprint.
-->

Puoi anche usare la [Query Params API](/developers/apis/query-api/) per aprire Playground con una configurazione specifica, come una versione di WordPress, una versione di PHP, un plugin, un tema o un Blueprint.

<!--
## Understand the save status
-->

## Comprendi lo stato di salvataggio

<!--
The status next to the address field tells you how the current Playground is stored:
-->

Lo stato accanto al campo indirizzo indica come è archiviato il Playground corrente:

<!--
- **Autosaved** means the Playground is stored in this browser and can be recovered from **Your Playgrounds**. Playground keeps up to five recent autosaves.
- **Saved** means the Playground was stored permanently in browser storage or saved to a local directory.
- **Unsaved** means the Playground has not been saved. Temporary Playgrounds, including `?storage=temp`, are lost when the tab is closed or refreshed.
-->

- **Salvato automaticamente** significa che il Playground è archiviato in questo browser e può essere recuperato da **I tuoi Playground**. Playground conserva fino a cinque salvataggi automatici recenti.
- **Salvato** significa che il Playground è stato archiviato in modo permanente nell'archiviazione del browser oppure salvato in una directory locale.
- **Non salvato** significa che il Playground non è stato salvato. I Playground temporanei, compresi quelli con `?storage=temp`, vengono persi quando la scheda viene chiusa o aggiornata.

<!--
Click **Autosaved** or **Unsaved** to open **Store permanently**.
-->

Fai clic su **Salvato automaticamente** o **Non salvato** per aprire **Archivia in modo permanente**.

<!--
![The Store permanently pane with a Playground name and the Save button](https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/static/img/saving-playground.webp)
-->

![Il pannello Archivia in modo permanente con il nome del Playground e il pulsante Salva](https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/static/img/saving-playground.webp)

<!--
Store permanently can keep an autosaved Playground in browser storage so autosave pruning no longer removes it. In browsers that support the File System Access API, it can also save the Playground to a local directory.
-->

Archivia in modo permanente può conservare un Playground salvato automaticamente nell'archiviazione del browser, così la pulizia dei salvataggi automatici non lo rimuove più. Nei browser che supportano la File System Access API, può anche salvare il Playground in una directory locale.

<!--
Browser storage still belongs to the browser. The browser may remove stored data when storage pressure or privacy settings require it. Export a ZIP when you need a portable backup.
-->

L'archiviazione del browser resta comunque nelle mani del browser, che può rimuovere i dati archiviati quando lo richiedono la pressione sullo spazio o le impostazioni di privacy. Esporta uno ZIP quando ti serve un backup portabile.

<!--
## Start a Playground
-->

## Avvia un Playground

<!--
Open **New Playground** from the Dock by clicking **New**. The pane contains
**Blueprint gallery**, **From a URL**, **Write a Blueprint**, **Preview a PR**,
**From GitHub**, and **Import zip**.
-->

Apri **Nuovo Playground** dal Dock facendo clic su **Nuovo**. Il pannello contiene **Galleria dei Blueprint**, **Da un URL**, **Scrivi un Blueprint**, **Anteprima di una PR**, **Da GitHub** e **Importa zip**.

<!--
![The New Playground pane with the Blueprint gallery selected](https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/static/img/dock/dock-new-playground.webp)
-->

![Il pannello Nuovo Playground con la galleria dei Blueprint selezionata](https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/static/img/dock/dock-new-playground.webp)

<!--
The Blueprint gallery starts with **Vanilla WordPress**, which creates a clean
WordPress install. **From a URL** opens a public Blueprint URL. **Write a
Blueprint** opens an editor for a new Blueprint. **Import zip** restores a ZIP
exported from Playground.
-->

La galleria dei Blueprint inizia con **Vanilla WordPress**, che crea un'installazione pulita di WordPress. **Da un URL** apre l'URL pubblico di un Blueprint. **Scrivi un Blueprint** apre un editor per un nuovo Blueprint. **Importa zip** ripristina uno ZIP esportato da Playground.

<!--
![The New Playground pane with Import zip selected](https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/static/img/dock/dock-new-playground-import-zip.webp)
-->

![Il pannello Nuovo Playground con Importa zip selezionato](https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/static/img/dock/dock-new-playground-import-zip.webp)

<!--
## Return to recent and saved Playgrounds
-->

## Torna ai Playground recenti e salvati

<!--
Open **Your Playgrounds** from the Dock by clicking **Playgrounds**. It lists the current Playground, recent autosaves, and Playgrounds you saved permanently.
-->

Apri **I tuoi Playground** dal Dock facendo clic su **Playground**. L'elenco mostra il Playground corrente, i salvataggi automatici recenti e i Playground che hai salvato in modo permanente.

<!--
![The Your Playgrounds pane with the current Playground](https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/static/img/dock/your-playgrounds.webp)
-->

![Il pannello I tuoi Playground con il Playground corrente](https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/static/img/dock/your-playgrounds.webp)

<!--
Autosaved Playgrounds are recovery points. Playground retains up to five recent
autosaves. Use **Store permanently** to keep one as a saved Playground.
-->

I Playground salvati automaticamente sono punti di ripristino. Playground ne conserva al massimo cinque recenti. Usa **Archivia in modo permanente** per conservarne uno come Playground salvato.

<!--
## Change site settings
-->

## Modifica le impostazioni del sito

<!--
Open **Site Settings** to change runtime and WordPress setup options.
-->

Apri **Impostazioni del sito** per modificare le opzioni di runtime e di configurazione di WordPress.

<!--
![The Site Settings pane](https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/static/img/dock/dock-site-settings.webp)
-->

![Il pannello Impostazioni del sito](https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/static/img/dock/dock-site-settings.webp)

<!--
PHP version and networking can be applied to an existing stored Playground. WordPress version, language, and multisite change the WordPress installation itself, so they require a fresh Playground.
-->

La versione di PHP e la rete possono essere applicate a un Playground già archiviato. La versione di WordPress, la lingua e il multisito modificano l'installazione di WordPress stessa, quindi richiedono un nuovo Playground.

<!--
Running an edited Blueprint keeps stored and autosaved Playgrounds. It discards a temporary Playground because the new run starts from a fresh setup.
-->

L'esecuzione di un Blueprint modificato mantiene i Playground archiviati e quelli salvati automaticamente, mentre elimina un Playground temporaneo, perché la nuova esecuzione parte da una configurazione pulita.

<!--
## Inspect the current Blueprint
-->

## Ispeziona il Blueprint corrente

<!--
Open **Blueprint** to view and edit the Blueprint for the current Playground.
-->

Apri **Blueprint** per visualizzare e modificare il Blueprint del Playground corrente.

<!--
![The Blueprint editor pane](https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/static/img/dock/dock-current-blueprint.webp)
-->

![Il pannello dell'editor dei Blueprint](https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/static/img/dock/dock-current-blueprint.webp)

<!--
The editor can run the edited Blueprint in a new Playground. For a stored or autosaved Playground, the original Playground remains available in **Your Playgrounds**.
-->

L'editor può eseguire il Blueprint modificato in un nuovo Playground. Se il Playground è archiviato o salvato automaticamente, quello originale resta disponibile in **I tuoi Playground**.

<!--
## Inspect files, database, and logs
-->

## Ispeziona file, database e log

<!--
Open **Files** to browse and edit the current Playground files.
-->

Apri **File** per esplorare e modificare i file del Playground corrente.

<!--
![The Files pane with a WordPress file selected](https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/static/img/dock/files.webp)
-->

![Il pannello File con un file di WordPress selezionato](https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/static/img/dock/files.webp)

<!--
Open **Database** to use database tools or download the SQLite database.
-->

Apri **Database** per usare gli strumenti del database o scaricare il database SQLite.

<!--
![The Database pane](https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/static/img/dock/database.webp)
-->

![Il pannello Database](https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/static/img/dock/database.webp)

<!--
Open **Logs** to inspect PHP errors, warnings, and notices.
-->

Apri **Log** per ispezionare errori, avvisi e notice di PHP.

<!--
![The PHP error log pane](https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/static/img/dock/logs.webp)
-->

![Il pannello del log degli errori di PHP](https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/static/img/dock/logs.webp)

<!--
## Export and share {#playground-options-menu}
-->

## Esporta e condividi {#playground-options-menu}

<!--
Open **Export** to download or share the current Playground.
-->

Apri **Esporta** per scaricare o condividere il Playground corrente.

<!--
![The Export pane with Download as .zip highlighted](https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/static/img/export-playground.webp)
-->

![Il pannello Esporta con Scarica come .zip evidenziato](https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/static/img/export-playground.webp)

<!--
**Download as .zip** exports the current files, database, plugins, themes, uploads, and edits. The ZIP can be restored later with **New → Import zip**.
-->

**Scarica come .zip** esporta i file, il database, i plugin, i temi, i caricamenti e le modifiche correnti. Lo ZIP può essere ripristinato in seguito con **Nuovo → Importa zip**.

<!--
**Copy original setup link** copies a link that recreates only the original
setup. It does not include edits made after the Playground started.
-->

**Copia il link della configurazione originale** copia un link che ricrea soltanto la configurazione iniziale. Non include le modifiche fatte dopo l'avvio del Playground.

<!--
**Export to GitHub** can create a pull request with selected files from the current Playground.
-->

**Esporta su GitHub** può creare una pull request con i file selezionati del Playground corrente.

<!--
## Change the Dock layout
-->

## Modifica il layout del Dock

<!--
The Dock can be shown as a floating panel or full-width bar. Use **Full width** to switch layouts.
-->

Il Dock può essere mostrato come pannello flottante o come barra a tutta larghezza. Usa **Tutta larghezza** per cambiare layout.

<!--
| Floating                                                   | Full width                                                    |
| ---------------------------------------------------------- | ------------------------------------------------------------- |
| ![The default floating Dock](https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/static/img/dock/dock-overview.webp) | ![The full-width Dock layout](https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/static/img/dock/dock-full-width.webp) |
-->

| Flottante                                                                                                                                                                 | Tutta larghezza                                                                                                                                                                    |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ![Il Dock flottante predefinito](https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/static/img/dock/dock-overview.webp) | ![Il layout del Dock a tutta larghezza](https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/static/img/dock/dock-full-width.webp) |

<!--
Use **Hide tools** to collapse the Dock to its address field and save status.
Use **Show tools** to reopen the tool row.
-->

Usa **Nascondi strumenti** per ridurre il Dock al solo campo indirizzo e allo stato di salvataggio. Usa **Mostra strumenti** per riaprire la riga degli strumenti.

<!--
![The Playground with Dock tools hidden](https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/static/img/dock/dock-hidden-tools.webp)
-->

![Playground con gli strumenti del Dock nascosti](https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/static/img/dock/dock-hidden-tools.webp)

<!--
You can drag the floating Dock on desktop. Drag it past the left or right edge
to fold it into a corner launcher, then click the launcher to restore the Dock.
-->

Su desktop puoi trascinare il Dock flottante. Trascinalo oltre il bordo sinistro o destro per ridurlo a un avviatore d'angolo, poi fai clic sull'avviatore per ripristinare il Dock.

<!--
![The Dock folded into the corner launcher](https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/static/img/dock/dock-corner-launcher.webp)
-->

![Il Dock ridotto all'avviatore d'angolo](https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/static/img/dock/dock-corner-launcher.webp)

<!--
On narrow screens, the Dock uses a full-width mobile layout.
-->

Sugli schermi stretti il Dock usa un layout mobile a tutta larghezza.

<!--
![The Dock on a mobile viewport](https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/static/img/dock/dock-mobile.webp)
-->

![Il Dock su uno schermo mobile](https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/static/img/dock/dock-mobile.webp)

<div class="callout callout-warning">

<!--
The site at https://playground.wordpress.net is there to support the community, but there are no guarantees it will continue to work if the traffic grows significantly.
-->

Il sito https://playground.wordpress.net è a disposizione della comunità, ma non ci sono garanzie che continui a funzionare se il traffico cresce in modo significativo.

<!--
If you need certain availability, you should [host your own WordPress Playground](/developers/architecture/host-your-own-playground).
-->

Se hai bisogno di una disponibilità garantita, dovresti [ospitare il tuo WordPress Playground](/developers/architecture/host-your-own-playground).

</div>
