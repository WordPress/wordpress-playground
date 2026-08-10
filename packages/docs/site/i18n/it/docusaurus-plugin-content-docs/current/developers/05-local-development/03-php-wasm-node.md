---
title: php-wasm/node
slug: /developers/local-development/php-wasm-node
description: WordPress Playground porta PHP basato su WebAssembly in Node.js per l'esecuzione lato server, l'elaborazione di dati e i test senza installazione nativa.
---

<!-- title: php-wasm/node -->
<!-- description: WordPress Playground brings WebAssembly-powered PHP to Node.js for server-side execution, data processing, and testing without a native install. -->

<!-- # Using WordPress Playground in Node.js -->

# Usare WordPress Playground in Node.js

<!-- As a WebAssembly project, you can also use WordPress Playground in Node.js. -->

Essendo un progetto WebAssembly, puoi usare WordPress Playground anche in
Node.js.

<!--
If you need direct control over the underlying WebAssembly PHP runtime, take a
look at the [@php-wasm/node package](https://npmjs.org/@php-wasm/node). It
provides the Node.js loader and runtime integrations used by WordPress
Playground tools. The compiled binaries are published in version-specific
packages such as `@php-wasm/node-8-4`.
-->

Se hai bisogno di un controllo diretto sul runtime PHP WebAssembly
sottostante, dai un'occhiata al
[pacchetto @php-wasm/node](https://npmjs.org/@php-wasm/node). Fornisce il
caricatore per Node.js e le integrazioni del runtime usate dagli strumenti di
WordPress Playground. I binari compilati sono pubblicati in pacchetti
specifici per ogni versione, come `@php-wasm/node-8-4`.

<!--
See [PHP.wasm packages](/developers/architecture/php-wasm-packages) to learn
how `@php-wasm/universal`, the Node.js and web adapters, and the version-specific
packages fit together. That page also explains the lower-level, single-version
setup with a smaller dependency footprint.
-->

Consulta [Pacchetti PHP.wasm](/developers/architecture/php-wasm-packages) per
capire come si integrano `@php-wasm/universal`, gli adattatori per Node.js e
per il web, e i pacchetti specifici per ogni versione. Quella pagina spiega
anche la configurazione di basso livello per una sola versione, con
un'impronta di dipendenze più ridotta.

<!-- Consult the [complete list](/api/node) of Classes, Functions, Interfaces, and Type Aliases. -->

Consulta l'[elenco completo](/api/node) di classi, funzioni, interfacce e
alias di tipo.

<!-- ## WebAssembly PHP for Node.js -->

## PHP WebAssembly per Node.js

<!--
Together, `@php-wasm/node` and a version-specific package provide the compiled
PHP runtime and JavaScript API optimized for Node.js. PHP starts with an
in-memory filesystem; use the Node.js filesystem helpers to mount host paths.
The runtime can access the network if you plug in a custom WebSocket-to-TCP
proxy.
-->

Insieme, `@php-wasm/node` e un pacchetto specifico per una versione forniscono
il runtime PHP compilato e l'API JavaScript ottimizzati per Node.js. PHP si
avvia con un filesystem in memoria; usa le utilità per il filesystem di
Node.js per montare percorsi dell'host. Il runtime può accedere alla rete se
colleghi un proxy personalizzato da WebSocket a TCP.

<!-- ### Basic usage -->

### Uso di base

```javascript
import { PHP } from '@php-wasm/universal';
import { loadNodeRuntime } from '@php-wasm/node';

const php = new PHP(await loadNodeRuntime('8.3'));
const output = await php.runStream({
	code: '<?php phpinfo(); ?>',
});
console.log(await output.stdoutText);
```

<!-- ### Load one PHP version directly -->

### Caricare direttamente una versione di PHP

<!--
If installation size matters and you only need the shared, low-level PHP API,
you can omit `@php-wasm/node` and install one Node.js build instead:
-->

Se la dimensione dell'installazione è importante e ti serve solo l'API PHP
condivisa di basso livello, puoi omettere `@php-wasm/node` e installare invece
una sola build per Node.js:

```bash
npm install @php-wasm/universal @php-wasm/node-8-4
```

<!--
This approach bypasses Node.js-specific setup such as networking, file locking,
and extension loading. See
[Load one PHP version directly](/developers/architecture/php-wasm-packages#load-one-php-version-directly)
for the complete example and tradeoffs.
-->

Questo approccio salta la configurazione specifica di Node.js, come la rete,
il blocco dei file e il caricamento delle estensioni. Consulta
[Caricare direttamente una versione di PHP](/developers/architecture/php-wasm-packages#caricare-direttamente-una-versione-di-php)
per l'esempio completo e i compromessi.

<!-- ### Loading PHP extensions -->

### Caricamento delle estensioni PHP

<!--
Use the `extensions` loader option to enable optional extensions before PHP
starts:
-->

Usa l'opzione `extensions` del caricatore per abilitare estensioni opzionali
prima dell'avvio di PHP:

```javascript
import { PHP } from '@php-wasm/universal';
import { loadNodeRuntime } from '@php-wasm/node';

const php = new PHP(
	await loadNodeRuntime('8.4', {
		extensions: ['intl', 'redis', 'memcached', { name: 'xdebug', options: { ideKey: 'PLAYGROUND' } }],
	})
);
```

<!-- The same array can load external JSPI `.so` artifacts from a manifest: -->

Lo stesso array può caricare artefatti `.so` JSPI esterni da un manifest:

```javascript
const php = new PHP(
	await loadNodeRuntime('8.4', {
		extensions: [
			{
				source: {
					format: 'manifest',
					manifestUrl: './dist/wp_mysql_parser/manifest.json',
				},
			},
		],
	})
);
```

<!--
External extensions require JSPI. Asyncify support is limited to the bundled
extensions shipped with the PHP.wasm packages.
-->

Le estensioni esterne richiedono JSPI. Il supporto per Asyncify è limitato
alle estensioni integrate fornite con i pacchetti PHP.wasm.

<!--
See [Loading PHP extensions](/developers/apis/javascript-api/php-extensions)
for manifest format, browser usage, sidecar files, and compatibility notes.
-->

Consulta [Caricamento delle estensioni PHP](/developers/apis/javascript-api/php-extensions)
per il formato del manifest, l'uso nel browser, i file accessori e le note di
compatibilità.

<!-- ## Use cases -->

## Casi d'uso

<!-- Run PHP inside Node.js without a native PHP install. Allow developer to produce the following solutions: -->
<!-- - CI/CD jobs and developer tooling. -->
<!-- - Support education and WordPress workflows: Power interactive tutorials, sandboxes, and coding challenges. -->
<!-- - Generate content and prototype server behavior. -->
<!-- - Render HTML using PHP templates, and quickly stand up mock API endpoints to simulate requests. -->

Esegui PHP dentro Node.js senza un'installazione nativa di PHP. Questo
permette allo sviluppatore di realizzare le seguenti soluzioni:

- Job di CI/CD e strumenti per sviluppatori.
- Supporto alla formazione e ai flussi di lavoro WordPress: tutorial
  interattivi, sandbox e sfide di programmazione.
- Generazione di contenuti e prototipazione del comportamento del server.
- Rendering di HTML tramite template PHP e creazione rapida di endpoint API
  fittizi per simulare richieste.

<!-- ## Practical demos -->

## Demo pratiche

<!-- We will list some examples using the PHP-WASM package. -->

Elenchiamo alcuni esempi che usano il pacchetto PHP-WASM.

<!-- ### Demo 1: File system operations -->

### Demo 1: operazioni sul filesystem

<!-- Execute PHP scripts that interact with the file system: -->

Esegui script PHP che interagiscono con il filesystem:

```javascript
import { PHP } from '@php-wasm/universal';
import { loadNodeRuntime } from '@php-wasm/node';

const php = new PHP(await loadNodeRuntime('8.3'));

// Create directory structure
php.mkdir('/app/data');

// Write configuration file
await php.writeFile(
	'/app/config.json',
	JSON.stringify({
		app: 'MyApp',
		version: '1.0.0',
		debug: true,
	})
);

// Create and run PHP script that reads the config
await php.writeFile(
	'/app/index.php',
	`<?php
$config = json_decode(file_get_contents('/app/config.json'), true);
echo "Application: " . $config['app'] . "\\n";
echo "Version: " . $config['version'] . "\\n";
echo "Debug Mode: " . ($config['debug'] ? 'ON' : 'OFF') . "\\n";

// List all files
echo "\\nFiles in /app:\\n";
foreach (scandir('/app') as $file) {
    if ($file !== '.' && $file !== '..') {
        echo "  - $file\\n";
    }
}
?>`
);

const result = await php.runStream({ scriptPath: '/app/index.php' });
console.log(await result.stdoutText);
```

<!-- ### Demo 2: SQLite database operations -->

### Demo 2: operazioni su database SQLite

<!-- Use PHP's SQLite extension for data storage: -->

Usa l'estensione SQLite di PHP per l'archiviazione dei dati:

```javascript
import { PHP } from '@php-wasm/universal';
import { loadNodeRuntime } from '@php-wasm/node';

const php = new PHP(await loadNodeRuntime('8.3'));

// Create directory for database
php.mkdir('/data');

// Create database, insert data, and query
const result = await php.runStream({
	code: `<?php
// Create/connect to SQLite database
$db = new SQLite3('/data/app.db');

// Create table
$db->exec('CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
)');

// Insert sample data
$stmt = $db->prepare('INSERT INTO users (name, email) VALUES (?, ?)');
$users = [
    ['Alice Johnson', 'alice@example.com'],
    ['Bob Smith', 'bob@example.com'],
    ['Charlie Davis', 'charlie@example.com']
];

foreach ($users as $user) {
    $stmt->bindValue(1, $user[0]);
    $stmt->bindValue(2, $user[1]);
    $stmt->execute();
}

// Query data
echo "All Users:\\n";
echo str_repeat('-', 50) . "\\n";
$results = $db->query('SELECT * FROM users ORDER BY name');
while ($row = $results->fetchArray(SQLITE3_ASSOC)) {
    echo "ID: {$row['id']} | {$row['name']} ({$row['email']})\\n";
}

$db->close();
?>`,
});

console.log(await result.stdoutText);

// Database file persists in the virtual file system
const dbExists = await php.fileExists('/data/app.db');
console.log('\nDatabase persisted:', dbExists);
```

<!-- ### Demo 3: Processing uploaded files (ZIP archives) -->

### Demo 3: elaborazione di file caricati (archivi ZIP)

<!-- Process ZIP files using PHP's Libzip extension: -->

Elabora file ZIP usando l'estensione Libzip di PHP:

```javascript
import { PHP } from '@php-wasm/universal';
import { loadNodeRuntime } from '@php-wasm/node';

const php = new PHP(await loadNodeRuntime('8.3'));

// Create sample files
php.mkdir('/uploads');
await php.writeFile('/uploads/readme.txt', 'This is a sample text file');
await php.writeFile('/uploads/data.json', JSON.stringify({ name: 'Test', version: '1.0' }));

// Create, process, and extract ZIP archive
const result = await php.runStream({
	code: `<?php
// Create ZIP archive
$zip = new ZipArchive();
$zip->open('/uploads/archive.zip', ZipArchive::CREATE);
$zip->addFromString('readme.txt', file_get_contents('/uploads/readme.txt'));
$zip->addFromString('data.json', file_get_contents('/uploads/data.json'));
$zip->addFromString('info.txt', 'Created with PHP WASM');
$zip->close();

echo "ZIP archive created successfully\\n\\n";

// Read and display archive contents
$zip->open('/uploads/archive.zip');
echo "Archive Contents:\\n";
echo str_repeat('=', 50) . "\\n";

for ($i = 0; $i < $zip->numFiles; $i++) {
    $stat = $zip->statIndex($i);
    $size = round($stat['size'] / 1024, 2);
    echo sprintf("%-40s %10s KB\\n", $stat['name'], $size);
}

// Extract files
$zip->extractTo('/uploads/extracted/');
$zip->close();

echo "\\nExtracted successfully to /uploads/extracted/\\n";

// List extracted files
echo "\\nExtracted Files:\\n";
$files = new RecursiveIteratorIterator(
    new RecursiveDirectoryIterator('/uploads/extracted/')
);
foreach ($files as $file) {
    if ($file->isFile()) {
        echo "  " . $file->getPathname() . "\\n";
    }
}
?>`,
});

console.log(await result.stdoutText);
```

<!-- ### Demo 4: HTTP request/response pattern -->

### Demo 4: schema richiesta/risposta HTTP

<!-- Simulate web server behavior with request handlers: -->

Simula il comportamento di un server web con gestori di richieste:

```javascript
import { PHP } from '@php-wasm/universal';
import { loadNodeRuntime } from '@php-wasm/node';

const php = new PHP(await loadNodeRuntime('8.3'));

// Set up a simple API endpoint
await php.mkdir('/www/api');
await php.writeFile(
	'/www/api/users.php',
	`<?php
header('Content-Type: application/json');

// Parse request
$method = $_SERVER['REQUEST_METHOD'];
$input = json_decode(file_get_contents('php://input'), true);

// Simple routing
switch ($method) {
    case 'GET':
        echo json_encode([
            'users' => [
                ['id' => 1, 'name' => 'John Doe'],
                ['id' => 2, 'name' => 'Jane Smith']
            ]
        ]);
        break;
        
    case 'POST':
        $name = $input['name'] ?? 'Unknown';
        echo json_encode([
            'success' => true,
            'user' => [
                'id' => 3,
                'name' => $name
            ],
            'message' => "User $name created"
        ]);
        break;
        
    default:
        http_response_code(405);
        echo json_encode(['error' => 'Method not allowed']);
}
?>`
);

// Make GET request
const getResponse = await php.runStream({
	scriptPath: '/www/api/users.php',
	env: {
		REQUEST_METHOD: 'GET',
		SERVER_NAME: 'localhost',
		SERVER_PORT: '80',
	},
});
console.log('GET Response:', await getResponse.stdoutText);

// Make POST request
const postResponse = await php.runStream({
	scriptPath: '/www/api/users.php',
	env: {
		REQUEST_METHOD: 'POST',
		SERVER_NAME: 'localhost',
		SERVER_PORT: '80',
	},
	body: JSON.stringify({ name: 'Alice Wonder' }),
});
console.log('\\nPOST Response:', await postResponse.stdoutText);
```

<!-- ### Demo 5: Template rendering engine -->

### Demo 5: motore di rendering di template

<!-- Use PHP as a templating engine for dynamic content: -->

Usa PHP come motore di template per contenuti dinamici:

```javascript
import { PHP } from '@php-wasm/universal';
import { loadNodeRuntime } from '@php-wasm/node';

const php = new PHP(await loadNodeRuntime('8.3'));

// Create templates directory
php.mkdir('/templates');

// Create template
await php.writeFile(
	'/templates/email.php',
	`<!DOCTYPE html>
<html>
<head>
    <style>
        body { font-family: Arial, sans-serif; }
        .header { background: #4CAF50; color: white; padding: 20px; }
        .content { padding: 20px; }
        .footer { background: #f1f1f1; padding: 10px; text-align: center; }
    </style>
</head>
<body>
    <div class="header">
        <h1>Welcome, <?= htmlspecialchars($name) ?>!</h1>
    </div>
    <div class="content">
        <p>Thank you for registering with <?= $appName ?>.</p>
        <p>Your account details:</p>
        <ul>
            <li><strong>Email:</strong> <?= htmlspecialchars($email) ?></li>
            <li><strong>Member Since:</strong> <?= date('F j, Y', $timestamp) ?></li>
        </ul>
        <p>You now have access to the following features:</p>
        <ul>
            <?php foreach ($features as $feature): ?>
                <li><?= htmlspecialchars($feature) ?></li>
            <?php endforeach; ?>
        </ul>
    </div>
    <div class="footer">
        <p>&copy; <?= date('Y') ?> <?= $appName ?>. All rights reserved.</p>
    </div>
</body>
</html>`
);

// Render template with data
const templateData = {
	name: 'Priya Sharma',
	email: 'priya@example.com',
	appName: 'MyAwesomeApp',
	timestamp: Math.floor(Date.now() / 1000),
	features: ['Dashboard Access', 'API Integration', 'Premium Support', 'Custom Branding'],
};

// Pass data to template via environment variables or files
await php.writeFile('/template-data.json', JSON.stringify(templateData));

const result = await php.runStream({
	code: `<?php
    $data = json_decode(file_get_contents('/template-data.json'), true);
    extract($data);
    include '/templates/email.php';
  ?>`,
});

console.log(await result.stdoutText);
// Now you have rendered HTML that can be sent via email or saved
```

<!-- ### Demo 6: Real-time code execution and streaming -->

### Demo 6: esecuzione di codice in tempo reale e streaming

<!-- Process PHP output as it's generated: -->

Elabora l'output di PHP man mano che viene generato:

```javascript
import { PHP } from '@php-wasm/universal';
import { loadNodeRuntime } from '@php-wasm/node';

const php = new PHP(await loadNodeRuntime('8.3'));

await php.writeFile(
	'/stream-demo.php',
	`<?php
// Simulate long-running process
echo "Starting process...\\n";
flush();

for ($i = 1; $i <= 10; $i++) {
    echo "Processing item $i/10...\\n";
    flush();
    usleep(100000); // Sleep 100ms
}

echo "Process complete!\\n";
?>`
);

// Run PHP script
const streamedResponse = await php.runStream({
	scriptPath: '/stream-demo.php',
});

streamedResponse.stdout.pipeTo(
	new WritableStream({
		write(chunk) {
			console.log(chunk);
		},
	})
);
```

<!-- ## Integration patterns -->

## Modelli di integrazione

<!-- ### Pattern 1: Express.js middleware -->

### Modello 1: middleware Express.js

<!-- Integrate PHP processing into an Express.js application: -->

Integra l'elaborazione PHP in un'applicazione Express.js:

```TypeScript
import express from 'express';
import { PHP } from '@php-wasm/universal';
import { loadNodeRuntime } from '@php-wasm/node';

const app = express();
const php = new PHP(await loadNodeRuntime('8.3'));

// PHP execution middleware
app.use('/php', async (req, res, next) => {
	try {
		const phpScript = req.query.script || 'index.php';
		const result = await php.runStream({
			scriptPath: `/www/${phpScript}`,
			env: {
				REQUEST_METHOD: req.method,
				QUERY_STRING: new URLSearchParams(
					req.query as Record<string, string>
				).toString(),
				REQUEST_URI: req.url,
			},
		});

		res.send(await result.stdoutText);
	} catch (error) {
		next(error);
	}
});

app.listen(3000, () => {
	console.log('Server with PHP support running on port 3000');
});
```

<!-- ### Pattern 2: Automated testing -->

### Modello 2: test automatizzati

<!-- Create automated tests for PHP code: -->

Crea test automatizzati per il codice PHP:

```TypeScript
import { describe, it, expect, beforeAll } from '@jest/globals';
import { PHP } from '@php-wasm/universal';
import { loadNodeRuntime } from '@php-wasm/node';

describe('PHP Functions', () => {
	let php: PHP;

	beforeAll(async () => {
		php = new PHP(await loadNodeRuntime('8.3'));
	});

	it('should calculate sum correctly', async () => {
		const result = await php.run({
			code: `<?php
        function sum($a, $b) {
          return $a + $b;
        }
        echo sum(5, 3);
      ?>`,
		});

		expect(result.text).toBe('8');
	});

	it('should handle JSON operations', async () => {
		const input = { name: 'Test', value: 42 };
		const result = await php.run({
			code: `<?php
        $input = json_decode('${JSON.stringify(input)}', true);
        $output = [
          'received' => $input,
          'doubled' => $input['value'] * 2
        ];
        echo json_encode($output);
      ?>`,
		});

		const output = JSON.parse(result.text);
		expect(output.doubled).toBe(84);
	});
});
```

<!-- ### Pattern 3: Build tool integration -->

### Modello 3: integrazione negli strumenti di build

<!-- Use in build scripts with other Node.js tools: -->

Usalo negli script di build insieme ad altri strumenti Node.js:

```javascript
import { PHP } from '@php-wasm/universal';
import { loadNodeRuntime } from '@php-wasm/node';
import fs from 'fs/promises';

async function generateDocumentation() {
	const php = new PHP(await loadNodeRuntime('8.3'));

	// Create output directory
	php.mkdir('/output');

	// Generate documentation
	const result = await php.runStream({
		code: `<?php
echo "Generating documentation...\\n";

$summary = "# Generated Documentation\\n\\n";
$summary .= "Generated at: " . date('Y-m-d H:i:s') . "\\n\\n";

file_put_contents('/output/summary.md', $summary);
echo "Documentation generated successfully!\\n";
?>`,
	});

	console.log(await result.stdoutText);

	// Extract generated docs back to Node.js file system
	await fs.mkdir('./docs', { recursive: true });
	const summaryContent = await php.readFileAsText('/output/summary.md');
	await fs.writeFile('./docs/summary.md', summaryContent);

	console.log('Documentation saved to ./docs/summary.md');
}

generateDocumentation().catch(console.error);
```

<!-- ## Advanced features -->

## Funzionalità avanzate

<!-- ### Working with environment variables -->

### Lavorare con le variabili d'ambiente

```javascript
import { PHP } from '@php-wasm/universal';
import { loadNodeRuntime } from '@php-wasm/node';

const php = new PHP(await loadNodeRuntime('8.3'));

const result = await php.runStream({
	code: '<?php echo getenv("CUSTOM_VAR"); ?>',
	env: {
		CUSTOM_VAR: 'Hello from Node.js!',
	},
});

console.log(await result.stdoutText);
```

<!-- ### Error handling -->

### Gestione degli errori

```javascript
import { PHP } from '@php-wasm/universal';
import { loadNodeRuntime } from '@php-wasm/node';

const php = new PHP(await loadNodeRuntime('8.3'));

try {
	const result = await php.runStream({
		code: '<?php trigger_error("Test error", E_USER_ERROR); ?>',
	});

	const stdout = await result.stdoutText;
	const stderr = await result.stderrText;

	console.log('stdout:', stdout);
	console.log('stderr:', stderr);

	if (stderr) {
		console.error('PHP produced errors:', stderr);
	}
} catch (error: any) {
	console.error('JavaScript Error:', error.message);
}
```

<!-- ## Performance considerations -->

## Considerazioni sulle prestazioni

<!--
- **Reuse PHP instances**: Creating a new PHP instance is expensive. Reuse the same instance when possible.
- **Batch operations**: Group multiple file operations together rather than running separate scripts.
- **Memory management**: Large files may impact performance. Consider streaming for big datasets.
- **Caching**: Cache compiled PHP scripts and frequently accessed data.
-->

- **Riutilizza le istanze PHP**: creare una nuova istanza PHP è costoso.
  Riutilizza la stessa istanza quando possibile.
- **Raggruppa le operazioni**: raggruppa più operazioni sui file invece di
  eseguire script separati.
- **Gestione della memoria**: i file di grandi dimensioni possono influire
  sulle prestazioni. Valuta lo streaming per grandi insiemi di dati.
- **Caching**: metti in cache gli script PHP compilati e i dati consultati di
  frequente.
