---
title: php-wasm/node
slug: /developers/local-development/php-wasm-node
description: WordPress Playground apporte PHP propulsé par WebAssembly à Node.js pour l'exécution côté serveur, le traitement de données et les tests sans installation native.
---

<!-- # Using WordPress Playground in Node.js -->

# Utiliser WordPress Playground dans Node.js

<!-- As a WebAssembly project, you can also use WordPress Playground in Node.js. -->

En tant que projet WebAssembly, vous pouvez aussi utiliser WordPress Playground dans Node.js.

<!-- If you need low-level control over the underlying WebAssembly PHP build, take a look at the [@php-wasm/node package](https://npmjs.org/@php-wasm/node) which ships the PHP WebAssembly runtime. This package is at the core of all WordPress Playground tools for Node.js. -->

Si vous avez besoin d'un contrôle bas niveau sur la build WebAssembly de PHP, consultez le [paquet @php-wasm/node](https://npmjs.org/@php-wasm/node) qui fournit l'environnement d'exécution PHP WebAssembly. Ce paquet est au cœur de tous les outils WordPress Playground pour Node.js.

<!-- Consult the [complete list](/api/node) of Classes, Functions, Interfaces, and Type Aliases. -->

Consultez la [liste complète](/api/node) des classes, fonctions, interfaces et alias de types.

<!-- ## WebAssembly PHP for Node.js -->

## PHP WebAssembly pour Node.js

<!-- This package ships WebAssembly PHP binaries and the JavaScript API optimized for Node.js. It uses the host file system directly and can access the network if you plug in a custom WS proxy. -->

Ce paquet fournit les exécutables PHP WebAssembly et l'API JavaScript optimisée pour Node.js. Il utilise directement le système de fichiers hôte et peut accéder au réseau si vous branchez un proxy WS personnalisé.

<!-- ### Basic usage -->

### Utilisation de base

```javascript
import { PHP } from '@php-wasm/universal';
import { loadNodeRuntime } from '@php-wasm/node';

const php = new PHP(await loadNodeRuntime('8.3'));
const output = await php.runStream({
	code: '<?php phpinfo(); ?>',
});
console.log(await output.stdoutText);
```

<!-- ## Use cases -->

## Cas d'usage

<!-- Run PHP inside Node.js without a native PHP install. Allow developer to produce the following solutions: -->
<!-- - CI/CD jobs and developer tooling. -->
<!-- - Support education and WordPress workflows: Power interactive tutorials, sandboxes, and coding challenges. -->
<!-- - Generate content and prototype server behavior. -->
<!-- - Render HTML using PHP templates, and quickly stand up mock API endpoints to simulate requests. -->

Exécutez PHP dans Node.js sans installation native de PHP. Cela permet au développeur de produire les solutions suivantes :

-   Tâches CI/CD et outils de développement.
-   Support pour l'éducation et les workflows WordPress : didacticiels interactifs, sandboxes et défis de code.
-   Génération de contenu et prototypage du comportement serveur.
-   Rendu HTML via des templates PHP et création rapide d'endpoints d'API simulés pour simuler des requêtes.

<!-- ## Practical demos -->

## Démonstrations pratiques

<!-- We will list some examples using the PHP-WASM package. -->

Nous listerons quelques exemples utilisant le paquet PHP-WASM.

<!-- ### Demo 1: File system operations -->

### Démo 1 : Opérations sur le système de fichiers

<!-- Execute PHP scripts that interact with the file system: -->

Exécutez des scripts PHP qui interagissent avec le système de fichiers :

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

### Démo 2 : Opérations SQLite

<!-- Use PHP's SQLite extension for data storage: -->

Utilisez l'extension SQLite de PHP pour le stockage des données :

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

### Démo 3 : Traitement de fichiers téléchargés (archives ZIP)

<!-- Process ZIP files using PHP's Libzip extension: -->

Traitez des fichiers ZIP avec l'extension Libzip de PHP :

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

### Démo 4 : Modèle requête/réponse HTTP

<!-- Simulate web server behavior with request handlers: -->

Simulez le comportement d'un serveur web avec des gestionnaires de requêtes :

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

### Démo 5 : Moteur de rendu de templates

<!-- Use PHP as a templating engine for dynamic content: -->

Utilisez PHP comme moteur de templates pour du contenu dynamique :

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

### Démo 6 : Exécution en temps réel et streaming

<!-- Process PHP output as it's generated: -->

Traitez la sortie PHP au fur et à mesure :

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

## Modèles d'intégration

<!-- ### Pattern 1: Express.js middleware -->

### Modèle 1 : Middleware Express.js

<!-- Integrate PHP processing into an Express.js application: -->

Intégrez l'exécution PHP dans une application Express.js :

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

### Modèle 2 : Tests automatisés

<!-- Create automated tests for PHP code: -->

Créez des tests automatisés pour du code PHP :

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

### Modèle 3 : Intégration aux outils de build

<!-- Use in build scripts with other Node.js tools: -->

Utilisez-le dans des scripts de build avec d'autres outils Node.js :

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

## Fonctionnalités avancées

<!-- ### Working with environment variables -->

### Travailler avec des variables d'environnement

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

### Gestion des erreurs

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

## Considérations de performance

<!-- -   **Reuse PHP instances**: Creating a new PHP instance is expensive. Reuse the same instance when possible. -->
<!-- -   **Batch operations**: Group multiple file operations together rather than running separate scripts. -->
<!-- -   **Memory management**: Large files may impact performance. Consider streaming for big datasets. -->
<!-- -   **Caching**: Cache compiled PHP scripts and frequently accessed data. -->

-   **Réutiliser les instances PHP** : créer une nouvelle instance PHP est coûteux. Réutilisez la même instance lorsque c'est possible.
-   **Regrouper les opérations** : groupez plusieurs opérations de fichiers plutôt que d'exécuter des scripts séparés.
-   **Gestion de la mémoire** : les fichiers volumineux peuvent impacter les performances. Envisagez le streaming pour de grands jeux de données.
-   **Mise en cache** : mettez en cache les scripts PHP compilés et les données souvent consultées.
