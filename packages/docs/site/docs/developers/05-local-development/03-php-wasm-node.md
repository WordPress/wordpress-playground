---
title: php-wasm/node
slug: /developers/local-development/php-wasm-node
description: WordPress Playground brings WebAssembly-powered PHP to Node.js for server-side execution, data processing, and testing without a native install.
---

# Using WordPress Playground in Node.js

WordPress Playground is built on WebAssembly, so you can also use it in Node.js.

If you need direct control over the underlying WebAssembly PHP runtime, take a
look at the [@php-wasm/node package](https://www.npmjs.com/package/@php-wasm/node). It
provides the Node.js loader and runtime integrations used by WordPress
Playground tools. The compiled binaries are published in version-specific
packages such as `@php-wasm/node-8-4`.

See [PHP.wasm packages](/developers/architecture/php-wasm-packages) to learn
how `@php-wasm/universal`, the Node.js and web adapters, and the version-specific
packages fit together. That page also explains the lower-level, single-version
setup with a smaller dependency footprint.

Consult the [complete list](/api/node) of Classes, Functions, Interfaces, and Type Aliases.

## WebAssembly PHP for Node.js

Together, `@php-wasm/node` and a version-specific package provide the compiled
PHP runtime and JavaScript API optimized for Node.js. PHP starts with an
in-memory filesystem; use the Node.js filesystem helpers to mount host paths.
`loadNodeRuntime()` also enables outbound networking through a built-in
WebSocket-to-TCP proxy.

### Basic usage

```javascript
import { PHP } from '@php-wasm/universal';
import { loadNodeRuntime } from '@php-wasm/node';

const php = new PHP(await loadNodeRuntime('8.3', { emscriptenOptions: { processId: 1 } }));
const output = await php.runStream({
	code: '<?php phpinfo(); ?>',
});
console.log(await output.stdoutText);
php.exit();
```

Pass a `processId` in `emscriptenOptions`. PHP.wasm uses it for file locking, so
give each PHP instance in the same Node.js process a different ID. Call
`php.exit()` when you are done, so the Node.js process can exit.

### Load one PHP version directly

If installation size matters and you only need the shared, low-level PHP API,
you can omit `@php-wasm/node` and install one Node.js build instead:

```bash
npm install @php-wasm/universal @php-wasm/node-8-4
```

This approach bypasses Node.js-specific setup such as networking, file locking,
and extension loading. See
[Load one PHP version directly](/developers/architecture/php-wasm-packages#load-one-php-version-directly)
for the complete example and tradeoffs.

### Loading PHP extensions

Use the `extensions` loader option to enable optional extensions before PHP
starts:

```javascript
import { PHP } from '@php-wasm/universal';
import { loadNodeRuntime } from '@php-wasm/node';

const php = new PHP(
	await loadNodeRuntime('8.4', {
		emscriptenOptions: { processId: 1 },
		extensions: ['intl', 'redis', 'memcached', { name: 'xdebug', options: { ideKey: 'PLAYGROUND' } }],
	})
);
// Run your PHP code, then shut PHP down
php.exit();
```

The same array can load external JSPI `.so` artifacts from a manifest:

```javascript
const php = new PHP(
	await loadNodeRuntime('8.4', {
		emscriptenOptions: { processId: 1 },
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
// Run your PHP code, then shut PHP down
php.exit();
```

External extensions require JSPI. Asyncify support is limited to the bundled
extensions shipped with the PHP.wasm packages.

See [Loading PHP extensions](/developers/apis/javascript-api/php-extensions)
for manifest format, browser usage, sidecar files, and compatibility notes.

## Use cases

Run PHP inside Node.js without a native PHP install. Developers can use it for:

- CI/CD jobs and developer tooling.
- Support education and WordPress workflows: Power interactive tutorials, sandboxes, and coding challenges.
- Generate content and prototype server behavior.
- Render HTML using PHP templates, and quickly stand up mock API endpoints to simulate requests.

## Practical demos

The following examples use PHP.wasm in Node.js.

### Demo 1: File system operations

Execute PHP scripts that interact with the file system:

```javascript
import { PHP } from '@php-wasm/universal';
import { loadNodeRuntime } from '@php-wasm/node';

const php = new PHP(await loadNodeRuntime('8.3', { emscriptenOptions: { processId: 1 } }));

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
php.exit();
```

### Demo 2: SQLite database operations

Use PHP's SQLite extension for data storage:

```javascript
import { PHP } from '@php-wasm/universal';
import { loadNodeRuntime } from '@php-wasm/node';

const php = new PHP(await loadNodeRuntime('8.3', { emscriptenOptions: { processId: 1 } }));

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

// The database file stays in the in-memory file system for the life of this PHP instance
const dbExists = await php.fileExists('/data/app.db');
console.log('\nDatabase file exists:', dbExists);
php.exit();
```

### Demo 3: Processing uploaded files (ZIP archives)

Process ZIP files using PHP's Zip extension (`ZipArchive`):

```javascript
import { PHP } from '@php-wasm/universal';
import { loadNodeRuntime } from '@php-wasm/node';

const php = new PHP(await loadNodeRuntime('8.3', { emscriptenOptions: { processId: 1 } }));

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
php.exit();
```

### Demo 4: HTTP request/response pattern

Simulate web server behavior with request handlers:

```javascript
import { PHP } from '@php-wasm/universal';
import { loadNodeRuntime } from '@php-wasm/node';

const php = new PHP(await loadNodeRuntime('8.3', { emscriptenOptions: { processId: 1 } }));

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
	method: 'GET',
});
console.log('GET Response:', await getResponse.stdoutText);

// Make POST request
const postResponse = await php.runStream({
	scriptPath: '/www/api/users.php',
	method: 'POST',
	headers: { 'Content-Type': 'application/json' },
	body: new TextEncoder().encode(JSON.stringify({ name: 'Alice Wonder' })),
});
console.log('\nPOST Response:', await postResponse.stdoutText);

// Let the request finish before shutting PHP down
await postResponse.finished;
php.exit();
```

### Demo 5: Template rendering engine

Use PHP as a templating engine for dynamic content:

```javascript
import { PHP } from '@php-wasm/universal';
import { loadNodeRuntime } from '@php-wasm/node';

const php = new PHP(await loadNodeRuntime('8.3', { emscriptenOptions: { processId: 1 } }));

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
php.exit();
```

### Demo 6: Real-time code execution and streaming

Process PHP output as it's generated:

```javascript
import { PHP } from '@php-wasm/universal';
import { loadNodeRuntime } from '@php-wasm/node';

const php = new PHP(await loadNodeRuntime('8.3', { emscriptenOptions: { processId: 1 } }));

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

// stdout is a stream of bytes, so decode it to text
await streamedResponse.stdout.pipeThrough(new TextDecoderStream()).pipeTo(
	new WritableStream({
		write(chunk) {
			process.stdout.write(chunk);
		},
	})
);
php.exit();
```

## Integration patterns

### Pattern 1: Express.js middleware

Integrate PHP processing into an Express.js application:

```TypeScript
import express from 'express';
import path from 'node:path';
import { PHP, type HTTPMethod } from '@php-wasm/universal';
import { loadNodeRuntime } from '@php-wasm/node';

const app = express();
const php = new PHP(await loadNodeRuntime('8.3', { emscriptenOptions: { processId: 1 } }));

// Add a PHP script to serve
php.mkdir('/www');
php.writeFile('/www/index.php', '<?php echo "Hello, " . htmlspecialchars($_GET["name"] ?? "guest", ENT_QUOTES, "UTF-8");');

// PHP execution middleware
app.use('/php', async (req, res, next) => {
	try {
		// Use only the file name, so the query cannot point outside /www
		const phpScript = path.posix.basename(String(req.query.script || 'index.php'));
		const result = await php.runStream({
			scriptPath: `/www/${phpScript}`,
			method: req.method as HTTPMethod,
			relativeUri: req.url,
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

### Pattern 2: Automated testing

Create automated tests for PHP code:

```TypeScript
import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { PHP } from '@php-wasm/universal';
import { loadNodeRuntime } from '@php-wasm/node';

describe('PHP Functions', () => {
	let php: PHP;

	beforeAll(async () => {
		php = new PHP(await loadNodeRuntime('8.3', { emscriptenOptions: { processId: 1 } }));
	});

	afterAll(() => {
		php.exit();
	});

	it('should calculate sum correctly', async () => {
		const result = await php.runStream({
			code: `<?php
        function sum($a, $b) {
          return $a + $b;
        }
        echo sum(5, 3);
      ?>`,
		});

		expect(await result.stdoutText).toBe('8');
		expect(await result.exitCode).toBe(0);
	});

	it('should handle JSON operations', async () => {
		const input = { name: 'Test', value: 42 };
		const result = await php.runStream({
			code: `<?php
        $input = json_decode('${JSON.stringify(input)}', true);
        $output = [
          'received' => $input,
          'doubled' => $input['value'] * 2
        ];
        echo json_encode($output);
      ?>`,
		});

		const output = JSON.parse(await result.stdoutText);
		expect(output.doubled).toBe(84);
		expect(await result.exitCode).toBe(0);
	});
});
```

### Pattern 3: Build tool integration

Use in build scripts with other Node.js tools:

```javascript
import { PHP } from '@php-wasm/universal';
import { loadNodeRuntime } from '@php-wasm/node';
import fs from 'fs/promises';

async function generateDocumentation() {
	const php = new PHP(await loadNodeRuntime('8.3', { emscriptenOptions: { processId: 1 } }));

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
	php.exit();
}

generateDocumentation().catch(console.error);
```

## Advanced features

### Working with environment variables

```javascript
import { PHP } from '@php-wasm/universal';
import { loadNodeRuntime } from '@php-wasm/node';

const php = new PHP(await loadNodeRuntime('8.3', { emscriptenOptions: { processId: 1 } }));

const result = await php.runStream({
	code: '<?php echo getenv("CUSTOM_VAR"); ?>',
	env: {
		CUSTOM_VAR: 'Hello from Node.js!',
	},
});

console.log(await result.stdoutText);
php.exit();
```

### Error handling

```javascript
import { PHP } from '@php-wasm/universal';
import { loadNodeRuntime } from '@php-wasm/node';

const php = new PHP(await loadNodeRuntime('8.3', { emscriptenOptions: { processId: 1 } }));

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
} catch (error) {
	console.error('JavaScript Error:', error.message);
}

php.exit();
```

## Performance considerations

- **Reuse PHP instances**: Creating a new PHP instance is expensive. Reuse the same instance when possible.
- **Batch operations**: Group multiple file operations together rather than running separate scripts.
- **Memory management**: Large files may impact performance. Consider streaming for big datasets.
- **Caching**: Cache compiled PHP scripts and frequently accessed data.
