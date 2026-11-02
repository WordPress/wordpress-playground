---
title: Importazione di contenuti in WordPress con i Blueprint
slug: /guides/import-content-with-blueprints
description: Confronta esportazioni WXR, runPHP e snapshot ZIP per importare contenuti in una nuova istanza di WordPress Playground.
---

<!-- # Importing content into WordPress with Blueprints -->

# Importazione di contenuti in WordPress con i Blueprint

<!--
A new WordPress Playground site starts with basic content. A Blueprint can help
fill that gap from a WordPress export file, generate content with WordPress APIs,
or restore a Playground ZIP snapshot.

This guide focuses on choosing a Blueprint content import method and presents a
small benchmark comparing three approaches. Importing data can be useful for
theme starter content, test fixtures, educational content, and other
demo-building strategies. For more options, see
[Providing content for your demo with Playground](/guides/providing-content-for-your-demo).
-->

Un nuovo sito WordPress Playground contiene inizialmente contenuti di base. Un
Blueprint può aiutare a colmare questa lacuna a partire da un file di
esportazione di WordPress, generare contenuti con le API di WordPress oppure
ripristinare uno snapshot ZIP di Playground.

Questa guida si concentra sulla scelta di un metodo Blueprint per importare
contenuti e presenta un piccolo benchmark che confronta tre approcci.
L'importazione dei dati può essere utile per i contenuti iniziali dei temi, i
dati di test, i contenuti didattici e altre strategie per creare demo. Per altre
opzioni, consulta
[Fornire contenuti per la tua demo con Playground](/guides/providing-content-for-your-demo).

<!-- These approaches solve different problems: -->

Questi approcci risolvono problemi diversi:

<!--
| Method                                                                        | Best for                                                          | What it moves                                                                                 |
| ----------------------------------------------------------------------------- | ----------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| [`importWxr`](#import-a-wordpress-xml-export-with-importwxr)                  | Portable content shared between WordPress sites without overwriting existing content | Posts, pages, custom post types, terms, authors, comments, and attachment references          |
| [`runPHP`](#generate-content-with-runphp)                                     | Small, deterministic fixtures and content that needs custom logic | Anything the PHP code creates through WordPress APIs                                          |
| [`importWordPressFiles`](#restore-a-playground-zip-with-importwordpressfiles) | Restoring a complete Playground demo                              | The database and any WordPress files present in the ZIP, such as plugins, themes, and uploads |
-->

| Metodo                                                                                     | Ideale per                                                                            | Cosa trasferisce                                                                                          |
| ------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| [`importWxr`](#importare-unesportazione-xml-di-wordpress-con-importwxr)                    | Contenuti portabili condivisi tra siti WordPress senza sovrascrivere quelli esistenti | Articoli, pagine, tipi di contenuto personalizzati, termini, autori, commenti e riferimenti agli allegati |
| [`runPHP`](#generare-contenuti-con-runphp)                                                 | Piccoli dati di test deterministici e logica personalizzata                           | Tutto ciò che il codice PHP crea tramite le API di WordPress                                              |
| [`importWordPressFiles`](#ripristinare-un-file-zip-di-playground-con-importwordpressfiles) | Ripristinare una demo completa di Playground                                          | Il database e i file WordPress presenti nel file ZIP, come plugin, temi e file caricati                   |

<!--
If you only need posts and terms, start with WXR. If the content is generated or
depends on setup logic, use `runPHP`. If the database, media, plugins, themes,
and settings must be restored together, use a ZIP snapshot.
-->

Se ti servono solo articoli e termini, inizia con WXR. Se i contenuti vengono
generati o dipendono dalla logica di configurazione, usa `runPHP`. Se database,
media, plugin, temi e impostazioni devono essere ripristinati insieme, usa uno
snapshot ZIP.

<!-- ## Import a WordPress XML export with `importWxr` -->

## Importare un'esportazione XML di WordPress con `importWxr`

<!--
WordPress calls its XML export format WordPress eXtended RSS, or WXR. Create one
from **Tools > Export** in an existing WordPress site, then pass it to the
[`importWxr` step](/blueprints/steps).

This example expects `content.xml` next to `blueprint.json` in a
[Blueprint bundle](/blueprints/bundles):
-->

WordPress chiama il proprio formato di esportazione XML WordPress eXtended RSS,
o WXR. Creane uno da **Strumenti > Esporta** in un sito WordPress esistente,
quindi passalo al [passaggio `importWxr`](/blueprints/steps).

Questo esempio prevede che `content.xml` si trovi accanto a `blueprint.json` in
un [bundle Blueprint](/blueprints/bundles):

```json
{
	"$schema": "https://playground.wordpress.net/blueprint-schema.json",
	"landingPage": "/wp-admin/edit.php",
	"preferredVersions": {
		"php": "8.3",
		"wp": "7.0"
	},
	"login": true,
	"steps": [
		{
			"step": "importWxr",
			"file": {
				"resource": "bundled",
				"path": "/content.xml"
			},
			"fetchAttachments": false,
			"rewriteUrls": true,
			"importComments": false,
			"authorsMode": "default-author",
			"defaultAuthorUsername": "admin"
		}
	]
}
```

<!--
For a hosted file, replace the `bundled` resource with a
[`url` resource](/blueprints/steps/resources#urlreference). Set `fetchAttachments`
to `true` when the importer must download the media files referenced by the WXR
file. Network transfer can dominate the total setup time, so the benchmark later
in this guide disables attachment fetching.

`importWxr` can also map imported authors to local users, create users, and
apply explicit URL replacements. See the
[`importWxr` options](/blueprints/steps) before importing content from
another domain.
-->

Per un file ospitato, sostituisci la risorsa `bundled` con una
[risorsa `url`](/blueprints/steps/resources#urlreference). Imposta
`fetchAttachments` su `true` quando l'importatore deve scaricare i file
multimediali indicati nel file WXR. Il trasferimento di rete può incidere sulla
maggior parte del tempo totale di configurazione, quindi il benchmark più avanti
disabilita il recupero degli allegati.

`importWxr` può anche associare gli autori importati agli utenti locali, creare
utenti e applicare sostituzioni esplicite degli URL. Consulta le
[opzioni di `importWxr`](/blueprints/steps) prima di importare contenuti da un
altro dominio.

<!-- ### Pros -->

### Vantaggi

<!--
- Uses WordPress's standard, portable content exchange format.
- Preserves post types, taxonomies, post meta, authors, comments, and content
  relationships represented in the export.
- Can fetch attachments and rewrite old content URLs for the new site.
- Keeps content separate from the destination's WordPress core, plugins,
  themes, and most site settings.
- Is easy to inspect, version, and edit manually in any text editor because the
  source is XML.
-->

- Usa il formato standard e portabile di WordPress per lo scambio di contenuti.
- Conserva tipi di contenuto, tassonomie, metadati degli articoli, autori,
  commenti e relazioni tra contenuti rappresentate nell'esportazione.
- Può recuperare gli allegati e riscrivere i vecchi URL dei contenuti per il
  nuovo sito.
- Mantiene i contenuti separati dal core di WordPress, dai plugin, dai temi e
  dalla maggior parte delle impostazioni del sito di destinazione.
- È facile da esaminare, versionare e modificare manualmente con qualsiasi editor
  di testo perché la sorgente è XML.

<!-- ### Cons -->

### Svantaggi

<!--
- Does not clone the whole site. Plugins, themes, plugin tables, options, and
  files that are not represented in WXR need separate Blueprint steps.
- Attachment imports require network access and depend on the old media URLs
  remaining available.
- Large XML files use more parsing time and memory than restoring an existing
  SQLite database.
- Re-importing the same file can create duplicates; it is not an idempotent
  synchronization format.
- The Blueprint installs the WordPress Importer dependency automatically, which
  adds setup work before the WXR import starts.
-->

- Non clona l'intero sito. Plugin, temi, tabelle dei plugin, opzioni e file non
  rappresentati nel WXR richiedono passaggi Blueprint separati.
- L'importazione degli allegati richiede l'accesso alla rete e dipende dalla
  disponibilità dei vecchi URL dei media.
- I file XML di grandi dimensioni richiedono più tempo di analisi e memoria
  rispetto al ripristino di un database SQLite esistente.
- Reimportare lo stesso file può creare duplicati; non è un formato di
  sincronizzazione idempotente.
- Il Blueprint installa automaticamente la dipendenza WordPress Importer,
  aggiungendo lavoro di configurazione prima dell'importazione WXR.

<!-- ## Generate content with `runPHP` -->

## Generare contenuti con `runPHP`

<!--
The [`runPHP` step](/blueprints/steps) can call WordPress APIs directly.
Always load `/wordpress/wp-load.php` before calling functions such as
`wp_insert_post()`.

The following example creates the 100 posts used by the benchmark:
-->

Il [passaggio `runPHP`](/blueprints/steps) può chiamare direttamente le API di
WordPress. Carica sempre `/wordpress/wp-load.php` prima di chiamare funzioni come
`wp_insert_post()`.

L'esempio seguente crea i 100 articoli usati dal benchmark:

```json
{
	"$schema": "https://playground.wordpress.net/blueprint-schema.json",
	"landingPage": "/wp-admin/edit.php",
	"preferredVersions": {
		"php": "8.3",
		"wp": "7.0"
	},
	"login": true,
	"steps": [
		{
			"step": "runPHP",
			"code": "<?php\nrequire_once '/wordpress/wp-load.php';\n\nfor ( $index = 1; $index <= 100; $index++ ) {\n\t$result = wp_insert_post(\n\t\tarray(\n\t\t\t'post_title'   => 'Benchmark post ' . $index,\n\t\t\t'post_content' => '<!-- wp:paragraph --><p>Blueprint import benchmark content.</p><!-- /wp:paragraph -->',\n\t\t\t'post_status'  => 'publish',\n\t\t\t'post_type'    => 'post',\n\t\t),\n\t\ttrue\n\t);\n\tif ( is_wp_error( $result ) ) {\n\t\tthrow new RuntimeException( $result->get_error_message() );\n\t}\n}"
		}
	]
}
```

<!--
For larger programs, keep the code in a small plugin or split the setup across
focused steps instead of maintaining a very long JSON string. Use WordPress
APIs rather than writing directly to database tables so hooks, caches, and data
validation still run.
-->

Per programmi più grandi, conserva il codice in un piccolo plugin oppure dividi
la configurazione in passaggi mirati invece di mantenere una stringa JSON molto
lunga. Usa le API di WordPress anziché scrivere direttamente nelle tabelle del
database, in modo che hook, cache e convalida dei dati continuino a funzionare.

<!-- ### Pros -->

### Vantaggi

<!--
- Provides complete control over the generated data and its relationships.
- Requires no content file and no network access.
- Can configure options, post meta, users, taxonomies, and plugin-specific data
  in the same operation.
- Works well for small test fixtures whose source of truth should remain code.
- Can be made idempotent by looking up existing records before creating them.
-->

- Offre il controllo completo sui dati generati e sulle loro relazioni.
- Non richiede file di contenuti né accesso alla rete.
- Può configurare opzioni, metadati degli articoli, utenti, tassonomie e dati
  specifici dei plugin nella stessa operazione.
- Funziona bene per piccoli dati di test la cui fonte attendibile deve rimanere
  il codice.
- Può diventare idempotente cercando i record esistenti prima di crearli.

<!-- ### Cons -->

### Svantaggi

<!--
- Custom PHP is more verbose than exporting existing editorial content.
- The script must handle errors, reruns, dependencies, and partial failures.
- Code can become coupled to a plugin's APIs or database model.
- Creating many records one at a time still runs WordPress hooks and database
  writes for every record, so performance degrades as the dataset grows.
- A Blueprint is trusted input. Only run PHP from a source you trust.
-->

- Il PHP personalizzato è più verboso dell'esportazione di contenuti editoriali
  esistenti.
- Lo script deve gestire errori, nuove esecuzioni, dipendenze ed errori parziali.
- Il codice può diventare dipendente dalle API o dal modello di database di un
  plugin.
- La creazione di molti record uno alla volta esegue comunque gli hook di
  WordPress e le scritture sul database per ogni record, quindi le prestazioni
  peggiorano con la crescita del set di dati.
- Un Blueprint è un input attendibile. Esegui PHP solo da una fonte di cui ti
  fidi.

<!-- ## Restore a Playground ZIP with `importWordPressFiles` -->

## Ripristinare un file ZIP di Playground con `importWordPressFiles`

<!--
The [`importWordPressFiles` step](/blueprints/steps) is a
site restore, not a content-only import. It unpacks top-level WordPress files
from a ZIP and replaces the corresponding paths in the new instance. A ZIP
created with Playground's **Download as zip** option includes `wp-content`, its
SQLite database, uploads, and a manifest used to adjust Playground scope URLs.

Place the downloaded file next to `blueprint.json` and reference it as a bundled
resource:
-->

Il [passaggio `importWordPressFiles`](/blueprints/steps) ripristina un sito, non
importa soltanto i contenuti. Estrae da un file ZIP i file WordPress di primo
livello e sostituisce i percorsi corrispondenti nella nuova istanza. Un file ZIP
creato con l'opzione **Download as zip** di Playground include `wp-content`, il
relativo database SQLite, i file caricati e un manifesto usato per adattare gli
URL di ambito di Playground.

Posiziona il file scaricato accanto a `blueprint.json` e indicalo come risorsa
`bundled`:

```json
{
	"$schema": "https://playground.wordpress.net/blueprint-schema.json",
	"landingPage": "/",
	"preferredVersions": {
		"php": "8.3",
		"wp": "7.0"
	},
	"login": true,
	"steps": [
		{
			"step": "importWordPressFiles",
			"wordPressFilesZip": {
				"resource": "bundled",
				"path": "/site.zip"
			}
		}
	]
}
```

<!--
The ZIP may contain `wp-content` only, a complete WordPress directory, or a
WordPress directory nested inside a wrapper folder. Use `pathInZip` when the
archive contains several sites or when automatic root detection is not enough.

Keep the source and destination WordPress, PHP, theme, and plugin versions
compatible. The step upgrades the imported database and adjusts Playground
scope URLs, but it is not a general migration tool for arbitrary production
server configurations.
-->

Il file ZIP può contenere solo `wp-content`, una directory WordPress completa o
una directory WordPress annidata in una cartella contenitore. Usa `pathInZip`
quando l'archivio contiene più siti o quando il rilevamento automatico della
radice non è sufficiente.

Mantieni compatibili le versioni di WordPress, PHP, temi e plugin di origine e
destinazione. Il passaggio aggiorna il database importato e adatta gli URL di
ambito di Playground, ma non è uno strumento di migrazione generale per
configurazioni arbitrarie di server di produzione.

<!-- ### Pros -->

### Vantaggi

<!--
- Restores the database, uploads, plugins, themes, and settings together.
- Preserves plugin-specific tables and options that WXR cannot represent.
- Avoids recreating every post through WordPress APIs, which can be efficient
  for a prepared, repeatable demo.
- Works offline when the snapshot is bundled with the Blueprint.
- Produces the closest copy of the source Playground instance.
-->

- Ripristina insieme database, file caricati, plugin, temi e impostazioni.
- Conserva tabelle e opzioni specifiche dei plugin che WXR non può rappresentare.
- Evita di ricreare ogni articolo tramite le API di WordPress, risultando
  efficiente per una demo preparata e ripetibile.
- Funziona offline quando lo snapshot è incluso nel bundle del Blueprint.
- Produce la copia più fedele dell'istanza Playground di origine.

<!-- ### Cons -->

### Svantaggi

<!--
- Replaces any top-level paths present in the ZIP, so it can overwrite existing
  site state rather than merge content into it.
- Is larger, opaque, and harder to review or resolve in version-control merges.
- Couples the snapshot to its WordPress, PHP, theme, plugin, and database
  versions more tightly than WXR.
- Is unsuitable for importing selected posts into an existing site.
- Must only be restored from a trusted source; it can contain executable PHP
  and an entire database.
-->

- Sostituisce tutti i percorsi di primo livello presenti nel file ZIP, quindi
  può sovrascrivere lo stato esistente del sito anziché unirvi i contenuti.
- È più grande, opaco e difficile da esaminare o risolvere nei merge del
  controllo di versione.
- Lega lo snapshot alle versioni di WordPress, PHP, temi, plugin e database più
  strettamente rispetto a WXR.
- Non è adatto a importare articoli selezionati in un sito esistente.
- Deve essere ripristinato solo da una fonte attendibile; può contenere PHP
  eseguibile e un intero database.

<!-- ### Test results for the different methods -->

### Risultati dei test per i diversi metodi

<!--
The following test results were measured on July 13, 2026, on an Apple M4 Pro with
24 GB of memory. It used Node.js 22.16, WordPress 7.0, PHP 8.3, 100 posts,
and five fresh-site rounds per method:
-->

I seguenti risultati dei test sono stati misurati il 13 luglio 2026 su un Apple
M4 Pro con 24 GB di memoria. Sono stati usati Node.js 22.16, WordPress 7.0, PHP
8.3, 100 articoli e cinque iterazioni con un sito nuovo per ogni metodo:

<!--
| Method                       |     Input size | Median | Minimum | Maximum | Relative to fastest |
| ---------------------------- | -------------: | -----: | ------: | ------: | ------------------: |
| XML / `importWxr`            |      106.0 KiB | 2.21 s |  2.16 s |  2.25 s |               6.90x |
| PHP / `runPHP`               | Generated code | 2.78 s |  2.76 s |  2.80 s |               8.68x |
| ZIP / `importWordPressFiles` |       50.5 KiB | 320 ms |  318 ms |  322 ms |               1.00x |
-->

| Metodo                       | Dimensione input | Mediana | Minimo | Massimo | Rispetto al più veloce |
| ---------------------------- | ---------------: | ------: | -----: | ------: | ---------------------: |
| XML / `importWxr`            |        106.0 KiB |  2.21 s | 2.16 s |  2.25 s |                  6.90x |
| PHP / `runPHP`               |  Codice generato |  2.78 s | 2.76 s |  2.80 s |                  8.68x |
| ZIP / `importWordPressFiles` |         50.5 KiB |  320 ms | 318 ms |  322 ms |                  1.00x |

<!--
Treat these values as a reference from one machine, not a universal ranking.
The dataset shape matters: attachments favor a self-contained ZIP, complex
WordPress hooks can slow `runPHP`, and WXR's portability may be more important
than raw speed.
-->

Considera questi valori come un riferimento ottenuto su un solo computer, non
come una classifica universale. La struttura del set di dati è importante: gli
allegati favoriscono un file ZIP autonomo, hook complessi di WordPress possono
rallentare `runPHP` e la portabilità di WXR può essere più importante della
velocità pura.

<!-- ## Other content sources -->

## Altre fonti di contenuti

<!--
Blueprints also support [`importThemeStarterContent`](/blueprints/steps)
for a theme's registered starter content and the
[`wp-cli` step](/blueprints/steps) for commands such as
`wp post generate`. They are useful when the theme or WP-CLI command is already
the canonical source of the demo data, but they are outside this content import
benchmark.
-->

I Blueprint supportano anche
[`importThemeStarterContent`](/blueprints/steps) per i contenuti iniziali
registrati da un tema e il [passaggio `wp-cli`](/blueprints/steps) per comandi
come `wp post generate`. Sono utili quando il tema o il comando WP-CLI è già la
fonte canonica dei dati della demo, ma non rientrano in questo benchmark
dell'importazione dei contenuti.
