---
title: php-wasm/node
slug: /developers/local-development/php-wasm-node
description: WordPress Playground trae PHP con WebAssembly a Node.js para ejecución del lado del servidor, procesamiento de datos y pruebas sin instalación nativa.
---

<!-- # Using WordPress Playground in Node.js -->

# Usando WordPress Playground en Node.js

<!-- As a WebAssembly project, you can also use WordPress Playground in Node.js. -->

Como un proyecto WebAssembly, también puedes usar WordPress Playground en Node.js.

<!-- If you need low-level control over the underlying WebAssembly PHP build, take a look at the [@php-wasm/node package](https://npmjs.org/@php-wasm/node) which ships the PHP WebAssembly runtime. This package is at the core of all WordPress Playground tools for Node.js. -->

Si necesitas control de bajo nivel sobre la compilación WebAssembly de PHP subyacente, echa un vistazo al [paquete @php-wasm/node](https://npmjs.org/@php-wasm/node) que incluye el runtime WebAssembly de PHP. Este paquete está en el núcleo de todas las herramientas de WordPress Playground para Node.js.

<!-- Consult the [complete list](/api/node) of Classes, Functions, Interfaces, and Type Aliases. -->

Consulta la [lista completa](/api/node) de Clases, Funciones, Interfaces y Alias de Tipos.

<!-- ## WebAssembly PHP for Node.js -->

## WebAssembly PHP para Node.js

<!-- This package ships WebAssembly PHP binaries and the JavaScript API optimized for Node.js. It uses the host file system directly and can access the network if you plug in a custom WS proxy. -->

Este paquete incluye binarios WebAssembly de PHP y la API JavaScript optimizada para Node.js. Utiliza el sistema de archivos del host directamente y puede acceder a la red si conectas un proxy WS personalizado.

<!-- ### Basic usage -->

### Uso básico

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

## Casos de uso

<!-- Run PHP inside Node.js without a native PHP install. Allow developer to produce the following solutions: -->
<!-- - CI/CD jobs and developer tooling. -->
<!-- - Support education and WordPress workflows: Power interactive tutorials, sandboxes, and coding challenges. -->
<!-- - Generate content and prototype server behavior. -->
<!-- - Render HTML using PHP templates, and quickly stand up mock API endpoints to simulate requests. -->

Ejecuta PHP dentro de Node.js sin instalación nativa de PHP. Permite al desarrollador producir las siguientes soluciones:

-   Tareas de CI/CD y herramientas de desarrollo.
-   Soporte a educación y flujos de trabajo de WordPress: potencia tutoriales interactivos, sandboxes y retos de código.
-   Generar contenido y prototipar comportamiento de servidor.
-   Renderizar HTML usando plantillas PHP y levantar rápidamente endpoints de API simulados para simular peticiones.

<!-- ## Practical demos -->

## Demos prácticas

<!-- We will list some examples using the PHP-WASM package. -->

Enumeraremos algunos ejemplos usando el paquete PHP-WASM.

<!-- ### Demo 1: File system operations -->

### Demo 1: Operaciones en el sistema de archivos

<!-- Execute PHP scripts that interact with the file system: -->

Ejecuta scripts PHP que interactúan con el sistema de archivos:

```javascript
import { PHP } from '@php-wasm/universal';
import { loadNodeRuntime } from '@php-wasm/node';

const php = new PHP(await loadNodeRuntime('8.3'));

// Crear estructura de directorios
php.mkdir('/app/data');

// Escribir archivo de configuración
await php.writeFile(
	'/app/config.json',
	JSON.stringify({
		app: 'MyApp',
		version: '1.0.0',
		debug: true,
	})
);

// Crear y ejecutar script PHP que lee la configuración
await php.writeFile(
	'/app/index.php',
	`<?php
$config = json_decode(file_get_contents('/app/config.json'), true);
echo "Application: " . $config['app'] . "\\n";
echo "Version: " . $config['version'] . "\\n";
echo "Debug Mode: " . ($config['debug'] ? 'ON' : 'OFF') . "\\n";

// Listar todos los archivos
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

### Demo 2: Operaciones de base de datos SQLite

<!-- Use PHP's SQLite extension for data storage: -->

Usa la extensión SQLite de PHP para almacenamiento de datos:

```javascript
import { PHP } from '@php-wasm/universal';
import { loadNodeRuntime } from '@php-wasm/node';

const php = new PHP(await loadNodeRuntime('8.3'));

// Crear directorio para la base de datos
php.mkdir('/data');

// Crear base de datos, insertar datos y consultar
const result = await php.runStream({
	code: `<?php
// Crear/conectar a la base de datos SQLite
$db = new SQLite3('/data/app.db');

// Crear tabla
$db->exec('CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
)');

// Insertar datos de ejemplo
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

// Consultar datos
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

// El archivo de base de datos persiste en el sistema de archivos virtual
const dbExists = await php.fileExists('/data/app.db');
console.log('\nDatabase persisted:', dbExists);
```

<!-- ### Demo 3: Processing uploaded files (ZIP archives) -->

### Demo 3: Procesamiento de archivos subidos (archivos ZIP)

<!-- Process ZIP files using PHP's Libzip extension: -->

Procesa archivos ZIP usando la extensión Libzip de PHP:

```javascript
import { PHP } from '@php-wasm/universal';
import { loadNodeRuntime } from '@php-wasm/node';

const php = new PHP(await loadNodeRuntime('8.3'));

// Crear archivos de ejemplo
php.mkdir('/uploads');
await php.writeFile('/uploads/readme.txt', 'This is a sample text file');
await php.writeFile('/uploads/data.json', JSON.stringify({ name: 'Test', version: '1.0' }));

// Crear, procesar y extraer archivo ZIP
const result = await php.runStream({
	code: `<?php
// Crear archivo ZIP
$zip = new ZipArchive();
$zip->open('/uploads/archive.zip', ZipArchive::CREATE);
$zip->addFromString('readme.txt', file_get_contents('/uploads/readme.txt'));
$zip->addFromString('data.json', file_get_contents('/uploads/data.json'));
$zip->addFromString('info.txt', 'Created with PHP WASM');
$zip->close();

echo "ZIP archive created successfully\\n\\n";

// Leer y mostrar contenido del archivo
$zip->open('/uploads/archive.zip');
echo "Archive Contents:\\n";
echo str_repeat('=', 50) . "\\n";

for ($i = 0; $i < $zip->numFiles; $i++) {
    $stat = $zip->statIndex($i);
    $size = round($stat['size'] / 1024, 2);
    echo sprintf("%-40s %10s KB\\n", $stat['name'], $size);
}

// Extraer archivos
$zip->extractTo('/uploads/extracted/');
$zip->close();

echo "\\nExtracted successfully to /uploads/extracted/\\n";

// Listar archivos extraídos
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

### Demo 4: Patrón de petición/respuesta HTTP

<!-- Simulate web server behavior with request handlers: -->

Simula comportamiento de servidor web con manejadores de peticiones:

```javascript
import { PHP } from '@php-wasm/universal';
import { loadNodeRuntime } from '@php-wasm/node';

const php = new PHP(await loadNodeRuntime('8.3'));

// Configurar un endpoint de API simple
await php.mkdir('/www/api');
await php.writeFile(
	'/www/api/users.php',
	`<?php
header('Content-Type: application/json');

// Analizar petición
$method = $_SERVER['REQUEST_METHOD'];
$input = json_decode(file_get_contents('php://input'), true);

// Enrutamiento simple
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

// Hacer petición GET
const getResponse = await php.runStream({
	scriptPath: '/www/api/users.php',
	env: {
		REQUEST_METHOD: 'GET',
		SERVER_NAME: 'localhost',
		SERVER_PORT: '80',
	},
});
console.log('GET Response:', await getResponse.stdoutText);

// Hacer petición POST
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

### Demo 5: Motor de renderización de plantillas

<!-- Use PHP as a templating engine for dynamic content: -->

Usa PHP como motor de plantillas para contenido dinámico:

```javascript
import { PHP } from '@php-wasm/universal';
import { loadNodeRuntime } from '@php-wasm/node';

const php = new PHP(await loadNodeRuntime('8.3'));

// Crear directorio de plantillas
php.mkdir('/templates');

// Crear plantilla
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

// Renderizar plantilla con datos
const templateData = {
	name: 'Priya Sharma',
	email: 'priya@example.com',
	appName: 'MyAwesomeApp',
	timestamp: Math.floor(Date.now() / 1000),
	features: ['Dashboard Access', 'API Integration', 'Premium Support', 'Custom Branding'],
};

// Pasar datos a la plantilla vía variables de entorno o archivos
await php.writeFile('/template-data.json', JSON.stringify(templateData));

const result = await php.runStream({
	code: `<?php
    $data = json_decode(file_get_contents('/template-data.json'), true);
    extract($data);
    include '/templates/email.php';
  ?>`,
});

console.log(await result.stdoutText);
// Ahora tienes HTML renderizado que puede enviarse por email o guardarse
```

<!-- ### Demo 6: Real-time code execution and streaming -->

### Demo 6: Ejecución de código en tiempo real y streaming

<!-- Process PHP output as it's generated: -->

Procesa la salida de PHP conforme se genera:

```javascript
import { PHP } from '@php-wasm/universal';
import { loadNodeRuntime } from '@php-wasm/node';

const php = new PHP(await loadNodeRuntime('8.3'));

await php.writeFile(
	'/stream-demo.php',
	`<?php
// Simular proceso de larga duración
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

// Ejecutar script PHP
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

## Patrones de integración

<!-- ### Pattern 1: Express.js middleware -->

### Patrón 1: Middleware Express.js

<!-- Integrate PHP processing into an Express.js application: -->

Integra procesamiento PHP en una aplicación Express.js:

```TypeScript
import express from 'express';
import { PHP } from '@php-wasm/universal';
import { loadNodeRuntime } from '@php-wasm/node';

const app = express();
const php = new PHP(await loadNodeRuntime('8.3'));

// Middleware de ejecución PHP
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

### Patrón 2: Pruebas automatizadas

<!-- Create automated tests for PHP code: -->

Crea pruebas automatizadas para código PHP:

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

### Patrón 3: Integración con herramientas de construcción

<!-- Use in build scripts with other Node.js tools: -->

Usa en scripts de construcción con otras herramientas Node.js:

```javascript
import { PHP } from '@php-wasm/universal';
import { loadNodeRuntime } from '@php-wasm/node';
import fs from 'fs/promises';

async function generateDocumentation() {
	const php = new PHP(await loadNodeRuntime('8.3'));

	// Crear directorio de salida
	php.mkdir('/output');

	// Generar documentación
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

	// Extraer documentación generada de vuelta al sistema de archivos Node.js
	await fs.mkdir('./docs', { recursive: true });
	const summaryContent = await php.readFileAsText('/output/summary.md');
	await fs.writeFile('./docs/summary.md', summaryContent);

	console.log('Documentation saved to ./docs/summary.md');
}

generateDocumentation().catch(console.error);
```

<!-- ## Advanced features -->

## Características avanzadas

<!-- ### Working with environment variables -->

### Trabajando con variables de entorno

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

### Manejo de errores

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

## Consideraciones de rendimiento

<!-- -   **Reuse PHP instances**: Creating a new PHP instance is expensive. Reuse the same instance when possible. -->
<!-- -   **Batch operations**: Group multiple file operations together rather than running separate scripts. -->
<!-- -   **Memory management**: Large files may impact performance. Consider streaming for big datasets. -->
<!-- -   **Caching**: Cache compiled PHP scripts and frequently accessed data. -->

-   **Reutiliza instancias PHP**: Crear una nueva instancia PHP es costoso. Reutiliza la misma instancia cuando sea posible.
-   **Operaciones por lotes**: Agrupa múltiples operaciones de archivos juntas en lugar de ejecutar scripts separados.
-   **Gestión de memoria**: Los archivos grandes pueden impactar el rendimiento. Considera streaming para grandes conjuntos de datos.
-   **Caché**: Almacena en caché scripts PHP compilados y datos accedidos frecuentemente.
