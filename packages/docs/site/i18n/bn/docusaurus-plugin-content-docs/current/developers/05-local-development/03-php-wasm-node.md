---
title: php-wasm/node
slug: /developers/local-development/php-wasm-node
description: নেটিভ ইনস্টলেশন ছাড়াই সার্ভার-সাইড এক্সিকিউশন, ডেটা প্রসেসিং এবং টেস্টিংয়ের জন্য ওয়ার্ডপ্রেস প্লেগ্রাউন্ড Node.js-এ নিয়ে এসেছে WebAssembly-চালিত PHP।
---

<!--
# Using WordPress Playground in Node.js
-->

# Node.js-এ ওয়ার্ডপ্রেস প্লেগ্রাউন্ড ব্যবহার

<!--
As a WebAssembly project, you can also use WordPress Playground in Node.js.
-->

একটি WebAssembly প্রজেক্ট হিসেবে আপনি Node.js-এও ওয়ার্ডপ্রেস প্লেগ্রাউন্ড ব্যবহার করতে পারেন।

<!--
If you need direct control over the underlying WebAssembly PHP runtime, take a
look at the [@php-wasm/node package](https://npmjs.org/@php-wasm/node). It
provides the Node.js loader and runtime integrations used by WordPress
Playground tools. The compiled binaries are published in version-specific
packages such as `@php-wasm/node-8-4`.
-->

আন্ডারলায়িং WebAssembly PHP রানটাইমের ওপর যদি আপনার সরাসরি নিয়ন্ত্রণের প্রয়োজন হয়, তবে [@php-wasm/node প্যাকেজটি](https://npmjs.org/@php-wasm/node) দেখতে পারেন। এটি ওয়ার্ডপ্রেস প্লেগ্রাউন্ডের বিভিন্ন টুলে ব্যবহৃত Node.js লোডার এবং রানটাইম ইন্টিগ্রেশন সরবরাহ করে। কম্পাইল করা বাইনারিগুলো `@php-wasm/node-8-4`-এর মতো নির্দিষ্ট ভার্সনের প্যাকেজে প্রকাশিত হয়।

<!--
See [PHP.wasm packages](/developers/architecture/php-wasm-packages) to learn
how `@php-wasm/universal`, the Node.js and web adapters, and the version-specific
packages fit together. That page also explains the lower-level, single-version
setup with a smaller dependency footprint.
-->

`@php-wasm/universal`, Node.js ও ওয়েব অ্যাডাপ্টার এবং নির্দিষ্ট ভার্সনের প্যাকেজগুলো কীভাবে একসাথে কাজ করে তা জানতে [PHP.wasm packages](/developers/architecture/php-wasm-packages) দেখুন। ওই পেজে আরও কম ডিপেন্ডেন্সি ফুটপ্রিন্টসহ লোয়ার-লেভেল, একক-ভার্সন সেটআপ সম্পর্কেও আলোচনা করা হয়েছে।

<!--
Consult the [complete list](/api/node) of Classes, Functions, Interfaces, and Type Aliases.
-->

Classes, Functions, Interfaces এবং Type Aliases-এর [সম্পূর্ণ তালিকা](/api/node) দেখুন।

<!--
## WebAssembly PHP for Node.js
-->

## Node.js-এর জন্য WebAssembly PHP

<!--
Together, `@php-wasm/node` and a version-specific package provide the compiled
PHP runtime and JavaScript API optimized for Node.js. PHP starts with an
in-memory filesystem; use the Node.js filesystem helpers to mount host paths.
The runtime can access the network if you plug in a custom WebSocket-to-TCP
proxy.
-->

একসাথে `@php-wasm/node` এবং একটি ভার্সন-নির্দিষ্ট প্যাকেজ Node.js-এর জন্য অপ্টিমাইজ করা কম্পাইল্ড PHP রানটাইম ও JavaScript API প্রদান করে। PHP একটি ইন-মেমরি ফাইলসিস্টেম নিয়ে শুরু হয়; হোস্ট পাথ মাউন্ট করতে Node.js ফাইলসিস্টেম হেল্পার ব্যবহার করুন। আপনি যদি একটি কাস্টম WebSocket-to-TCP প্রক্সি যুক্ত করেন তবে রানটাইম নেটওয়ার্কও অ্যাক্সেস করতে পারে।

<!--
### Basic usage
-->

### বেসিক ব্যবহার

```javascript
import { PHP } from '@php-wasm/universal';
import { loadNodeRuntime } from '@php-wasm/node';

const php = new PHP(await loadNodeRuntime('8.3'));
const output = await php.runStream({
	code: '<?php phpinfo(); ?>',
});
console.log(await output.stdoutText);
```

<!--
### Load one PHP version directly
-->

### সরাসরি একটি নির্দিষ্ট PHP ভার্সন লোড করা

<!--
If installation size matters and you only need the shared, low-level PHP API,
you can omit `@php-wasm/node` and install one Node.js build instead:
-->

যদি ইনস্টলেশনের আকার গুরুত্বপূর্ণ হয় এবং আপনার শুধুমাত্র শেয়ার্ড, লো-লেভেল PHP API প্রয়োজন হয়, তবে আপনি `@php-wasm/node` বাদ দিয়ে শুধুমাত্র একটি Node.js বিল্ড ইনস্টল করতে পারেন:

```bash
npm install @php-wasm/universal @php-wasm/node-8-4
```

<!--
This approach bypasses Node.js-specific setup such as networking, file locking,
and extension loading. See
[Load one PHP version directly](/developers/architecture/php-wasm-packages#load-one-php-version-directly)
for the complete example and tradeoffs.
-->

এই পদ্ধতি নেটওয়ার্কিং, ফাইল লকিং এবং এক্সটেনশন লোডিংয়ের মতো Node.js-নির্দিষ্ট সেটআপ এড়িয়ে চলে। সম্পূর্ণ উদাহরণ এবং ট্রেডঅফ দেখতে [Load one PHP version directly](/developers/architecture/php-wasm-packages#load-one-php-version-directly) দেখুন।

<!--
### Loading PHP extensions
-->

### PHP এক্সটেনশন লোড করা

<!--
Use the `extensions` loader option to enable optional extensions before PHP
starts:
-->

PHP শুরু হওয়ার আগে অপশনাল এক্সটেনশন সক্রিয় করতে `extensions` লোডার অপশন ব্যবহার করুন:

```javascript
import { PHP } from '@php-wasm/universal';
import { loadNodeRuntime } from '@php-wasm/node';

const php = new PHP(
	await loadNodeRuntime('8.4', {
		extensions: ['intl', 'redis', 'memcached', { name: 'xdebug', options: { ideKey: 'PLAYGROUND' } }],
	})
);
```

<!--
The same array can load external JSPI `.so` artifacts from a manifest:
-->

একই অ্যারে ম্যানিফেস্ট থেকে এক্সটার্নাল JSPI `.so` আর্টিফ্যাক্ট লোড করতে পারে:

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

এক্সটার্নাল এক্সটেনশনের জন্য JSPI প্রয়োজন। Asyncify সাপোর্ট শুধুমাত্র PHP.wasm প্যাকেজের সাথে আসা বান্ডেলড এক্সটেনশনগুলোর মধ্যেই সীমাবদ্ধ।

<!--
See [Loading PHP extensions](/developers/apis/javascript-api/php-extensions)
for manifest format, browser usage, sidecar files, and compatibility notes.
-->

ম্যানিফেস্ট ফরম্যাট, ব্রাউজারের ব্যবহার, সাইডকার ফাইল এবং সামঞ্জস্যের নোটগুলোর জন্য [Loading PHP extensions](/developers/apis/javascript-api/php-extensions) দেখুন।

<!--
## Use cases
-->

## ব্যবহারের ক্ষেত্র (Use cases)

<!--
Run PHP inside Node.js without a native PHP install. Allow developer to produce the following solutions:
-->

নেটিভ PHP ইনস্টল ছাড়াই Node.js-এর ভেতর PHP রান করুন। এটি ডেভেলপারদের নিচের সমাধানগুলো তৈরি করতে সক্ষম করে:

<!--
- CI/CD jobs and developer tooling.
- Support education and WordPress workflows: Power interactive tutorials, sandboxes, and coding challenges.
- Generate content and prototype server behavior.
- Render HTML using PHP templates, and quickly stand up mock API endpoints to simulate requests.
-->

- সিআই/সিডি (CI/CD) জব এবং ডেভেলপার টুলিং।
- শিক্ষামূলক ও ওয়ার্ডপ্রেস ওয়ার্কফ্লোতে সহায়তা: ইন্টারেক্টিভ টিউটোরিয়াল, স্যান্ডবক্স এবং কোডিং চ্যালেঞ্জ পরিচালনা করা।
- কনটেন্ট তৈরি এবং সার্ভার আচরণের প্রোটোটাইপ প্রস্তুত করা।
- PHP টেমপ্লেট ব্যবহার করে HTML রেন্ডার করা এবং রিকোয়েস্ট সিমুলেট করতে দ্রুত মক API এন্ডপয়েন্ট তৈরি করা।

<!--
## Practical demos
-->

## ব্যবহারিক ডেমো (Practical demos)

<!--
We will list some examples using the PHP-WASM package.
-->

আমরা PHP-WASM প্যাকেজ ব্যবহার করে কিছু উদাহরণ তুলে ধরব।

<!--
### Demo 1: File system operations
-->

### ডেমো ১: ফাইল সিস্টেম অপারেশন (Demo 1: File system operations)

<!--
Execute PHP scripts that interact with the file system:
-->

ফাইল সিস্টেমের সাথে ইন্টার‍্যাক্ট করে এমন PHP স্ক্রিপ্ট চালান:

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

<!--
### Demo 2: SQLite database operations
-->

### ডেমো ২: SQLite ডেটাবেস অপারেশন (Demo 2: SQLite database operations)

<!--
Use PHP's SQLite extension for data storage:
-->

ডেটা সংরক্ষণের জন্য PHP-এর SQLite এক্সটেনশন ব্যবহার করুন:

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

<!--
### Demo 3: Processing uploaded files (ZIP archives)
-->

### ডেমো ৩: আপলোড করা ফাইল প্রসেসিং (ZIP আর্কাইভ)

<!--
Process ZIP files using PHP's Libzip extension:
-->

PHP-এর Libzip এক্সটেনশন ব্যবহার করে ZIP ফাইল প্রসেস করুন:

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

<!--
### Demo 4: HTTP request/response pattern
-->

### ডেমো ৪: HTTP রিকোয়েস্ট/রেসপন্স প্যাটার্ন

<!--
Simulate web server behavior with request handlers:
-->

রিকোয়েস্ট হ্যান্ডলারের সাহায্যে ওয়েব সার্ভারের আচরণ সিমুলেট করুন:

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

<!--
### Demo 5: Template rendering engine
-->

### ডেমো ৫: টেমপ্লেট রেন্ডারিং ইঞ্জিন

<!--
Use PHP as a templating engine for dynamic content:
-->

ডাইনামিক কনটেন্টের জন্য টেমপ্লেটিং ইঞ্জিন হিসেবে PHP ব্যবহার করুন:

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

<!--
### Demo 6: Real-time code execution and streaming
-->

### ডেমো ৬: রিয়েল-টাইম কোড এক্সিকিউশন ও স্ট্রিমিং

<!--
Process PHP output as it's generated:
-->

PHP আউটপুট তৈরি হওয়ার সাথে সাথেই তা প্রসেস করুন:

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

<!--
## Integration patterns
-->

## ইন্টিগ্রেশন প্যাটার্ন (Integration patterns)

<!--
### Pattern 1: Express.js middleware
-->

### প্যাটার্ন ১: Express.js মিডলওয়্যার

<!--
Integrate PHP processing into an Express.js application:
-->

একটি Express.js অ্যাপ্লিকেশনে PHP প্রসেসিং যুক্ত করুন:

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

<!--
### Pattern 2: Automated testing
-->

### প্যাটার্ন ২: অটোমেটেড টেস্টিং

<!--
Create automated tests for PHP code:
-->

PHP কোডের জন্য অটোমেটেড টেস্ট তৈরি করুন:

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

<!--
### Pattern 3: Build tool integration
-->

### প্যাটার্ন ৩: বিল্ড টুল ইন্টিগ্রেশন

<!--
Use in build scripts with other Node.js tools:
-->

অন্যান্য Node.js টুলের সাথে বিল্ড স্ক্রিপ্টে ব্যবহার করুন:

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

<!--
## Advanced features
-->

## উন্নত বৈশিষ্ট্যসমূহ (Advanced features)

<!--
### Working with environment variables
-->

### এনভায়রনমেন্ট ভ্যারিয়েবল নিয়ে কাজ করা

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

<!--
### Error handling
-->

### এরর হ্যান্ডলিং (Error handling)

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

<!--
## Performance considerations
-->

## কার্যক্ষমতা বিবেচ্য বিষয়সমূহ (Performance considerations)

<!--
- **Reuse PHP instances**: Creating a new PHP instance is expensive. Reuse the same instance when possible.
- **Batch operations**: Group multiple file operations together rather than running separate scripts.
- **Memory management**: Large files may impact performance. Consider streaming for big datasets.
- **Caching**: Cache compiled PHP scripts and frequently accessed data.
-->

- **PHP ইনস্ট্যান্স পুনর্ব্যবহার করুন**: নতুন PHP ইনস্ট্যান্স তৈরি করা ব্যয়বহুল। সম্ভব হলে একই ইনস্ট্যান্স পুনরায় ব্যবহার করুন।
- **ব্যাচ অপারেশন**: আলাদা আলাদা স্ক্রিপ্ট চালানোর চেয়ে একাধিক ফাইল অপারেশনকে একসাথে গ্রুপ করুন।
- **মেমরি ব্যবস্থাপনা**: বড় ফাইল পারফরম্যান্সে প্রভাব ফেলতে পারে। বড় ডেটাসেটের জন্য স্ট্রিমিং বিবেচনা করুন।
- **ক্যাশিং**: কম্পাইল করা PHP স্ক্রিপ্ট এবং ঘন ঘন ব্যবহৃত ডেটা ক্যাশ করে রাখুন।
