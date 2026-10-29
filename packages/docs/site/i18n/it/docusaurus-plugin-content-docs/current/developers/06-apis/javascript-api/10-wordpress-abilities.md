---
slug: /developers/apis/javascript-api/wordpress-abilities
---

# Abilità di WordPress

Apri **Dev Tools → Abilities** sul sito di Playground per cercare le abilità PHP registrate, esaminarne gli schemi ed eseguirle con dati di input JSON. Le abilità sono raggruppate per namespace, che di solito identifica il plugin. L’elenco include anche le abilità non esposte tramite l’API REST di WordPress.

Accedi prima a WordPress. Le chiamate usano l’utente corrente e mantengono la convalida dei dati di input e i controlli dei permessi di WordPress. L’[API delle abilità](https://developer.wordpress.org/apis/abilities-api/) deve essere disponibile nell’installazione in esecuzione; WordPress 6.9 e le versioni successive la includono.

## Usare il client del browser

Il `PlaygroundClient` del browser offre le stesse operazioni:

```ts
const { available, user, abilities } = await client.listAbilities();
const result = await client.executeAbility('my-plugin/lookup', { id: 123 });
```

`listAbilities()` restituisce la disponibilità dell’API, l’utente corrente e le descrizioni delle abilità. `executeAbility()` accetta qualsiasi valore JSON; ometti il secondo argomento per un’abilità che non richiede dati di input.

Un’esecuzione riuscita restituisce `{ success: true, data: ... }`. Un errore dell’abilità restituisce `{ success: false, errors: [{ code, message, data }] }`. Gli errori di trasporto e autenticazione rifiutano la promessa. L’esecuzione non viene mai ripetuta automaticamente: un errore di connessione o navigazione può verificarsi dopo che l’abilità ha già modificato il sito.

## Esporre le abilità agli agenti

Gli interruttori **Agents** espongono singole abilità o un intero namespace tramite WebMCP nei browser compatibili e tramite un [server MCP di Playground](/guides/ai-assistants-mcp) connesso. L’esecuzione manuale resta disponibile anche senza queste connessioni.

Tutti gli interruttori sono inizialmente disattivati. Le selezioni vengono conservate per ciascun sito fino al ricaricamento della pagina di Playground. Chiudere il pannello mantiene disponibili gli strumenti selezionati; passando a un altro sito vengono esposte solo le selezioni del sito attivo. Questi interruttori sono indipendenti dagli strumenti WebMCP registrati direttamente dai plugin.

Gli strumenti sono denominati `wp_ability_<namespace>.<slug>`, sostituendo con un punto il separatore del namespace di WordPress. Una chiamata WebMCP passa i dati dell’abilità nella proprietà `input`, ad esempio `{ "input": { "id": 123 } }`. Le chiamate MCP richiedono anche `siteId`.

Quando più siti espongono lo stesso nome di abilità con descrizioni, schemi o indicazioni di sicurezza differenti, MCP presenta un input generico senza indicazioni di sicurezza condivise. Esamina l’abilità sul sito di destinazione prima di chiamarla; WordPress continua a convalidare i dati e i permessi.

## Aggiornare dopo le modifiche

Usa **Refresh** dopo aver modificato il codice di un plugin. Il pannello si aggiorna anche dopo le navigazioni e i ricaricamenti di WordPress. Le integrazioni client possono osservare le navigazioni dei documenti, inclusi i ricaricamenti dello stesso URL, con `client.onNavigation(callback, { includeReloads: true })`. Per impostazione predefinita vengono segnalati solo i cambiamenti di URL.
