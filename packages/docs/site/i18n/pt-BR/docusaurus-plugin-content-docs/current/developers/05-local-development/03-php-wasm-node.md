---
title: php-wasm/node
slug: /developers/local-development/php-wasm-node
description: WordPress Playground traz PHP com WebAssembly para Node.js para execução do lado do servidor, processamento de dados e testes sem instalação nativa.
---

<!-- title: php-wasm/node -->

<!-- description: WordPress Playground brings WebAssembly-powered PHP to Node.js for server-side execution, data processing, and testing without a native install. -->

<!-- # Using WordPress Playground in Node.js -->

# Usando WordPress Playground no Node.js

<!-- As a WebAssembly project, you can also use WordPress Playground in Node.js. -->

Como um projeto WebAssembly, você também pode usar o WordPress Playground no Node.js.

<!-- If you need direct control over the underlying WebAssembly PHP runtime, take a
look at the [@php-wasm/node package](https://npmjs.org/@php-wasm/node). It
provides the Node.js loader and runtime integrations used by WordPress
Playground tools. The compiled binaries are published in version-specific
packages such as `@php-wasm/node-8-4`. -->

Se precisar de controle direto sobre o runtime PHP WebAssembly subjacente, veja
o [pacote @php-wasm/node](https://npmjs.org/@php-wasm/node). Ele fornece o
carregador e as integrações de runtime do Node.js usadas pelas ferramentas do
WordPress Playground. Os binários compilados são publicados em pacotes
específicos por versão, como `@php-wasm/node-8-4`.

<!-- See [PHP.wasm packages](/developers/architecture/php-wasm-packages) to learn
how `@php-wasm/universal`, the Node.js and web adapters, and the version-specific
packages fit together. That page also explains the lower-level, single-version
setup with a smaller dependency footprint. -->

Veja [Pacotes PHP.wasm](/developers/architecture/php-wasm-packages) para
entender como `@php-wasm/universal`, os adaptadores Node.js e web e os pacotes
específicos por versão se relacionam. Essa página também explica a configuração
de baixo nível com uma única versão e um conjunto menor de dependências.

<!-- Consult the [complete list](/api/node) of Classes, Functions, Interfaces, and Type Aliases. -->

Consulte a [lista completa](/api/node) de Classes, Funções, Interfaces e Aliases de Tipo.

<!-- ## WebAssembly PHP for Node.js -->

## WebAssembly PHP para Node.js

<!-- Together, `@php-wasm/node` and a version-specific package provide the compiled
PHP runtime and JavaScript API optimized for Node.js. PHP starts with an
in-memory filesystem; use the Node.js filesystem helpers to mount host paths.
The runtime can access the network if you plug in a custom WebSocket-to-TCP
proxy. -->

Juntos, `@php-wasm/node` e um pacote específico por versão fornecem o runtime
PHP compilado e a API JavaScript otimizada para Node.js. O PHP inicia com um
sistema de arquivos em memória; use os auxiliares de sistema de arquivos do
Node.js para montar caminhos do host. O runtime pode acessar a rede se você
conectar um proxy personalizado de WebSocket para TCP.

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

<!-- ### Load one PHP version directly -->

### Carregue uma versão do PHP diretamente

<!-- If installation size matters and you only need the shared, low-level PHP API,
you can omit `@php-wasm/node` and install one Node.js build instead: -->

Se o tamanho da instalação for importante e você precisar apenas da API PHP
compartilhada de baixo nível, poderá omitir `@php-wasm/node` e instalar uma
única build para Node.js:

<!--
```bash
npm install @php-wasm/universal @php-wasm/node-8-4
```
-->

```bash
npm install @php-wasm/universal @php-wasm/node-8-4
```

<!-- This approach bypasses Node.js-specific setup such as networking, file locking,
and extension loading. See
[Load one PHP version directly](/developers/architecture/php-wasm-packages#load-one-php-version-directly)
for the complete example and tradeoffs. -->

Essa abordagem ignora configurações específicas do Node.js, como rede, bloqueio
de arquivos e carregamento de extensões. Veja
[Carregue uma versão do PHP diretamente](/developers/architecture/php-wasm-packages#carregue-uma-versão-do-php-diretamente)
para conferir o exemplo completo e as vantagens e desvantagens.

<!-- ### Loading PHP extensions -->

### Carregando extensões do PHP

<!-- Use the `extensions` loader option to enable optional extensions before PHP
starts: -->

Use a opção `extensions` do carregador para ativar extensões opcionais antes de
iniciar o PHP:

<!--
```javascript
import { PHP } from '@php-wasm/universal';
import { loadNodeRuntime } from '@php-wasm/node';

const php = new PHP(
	await loadNodeRuntime('8.4', {
		extensions: ['intl', 'redis', 'memcached', { name: 'xdebug', options: { ideKey: 'PLAYGROUND' } }],
	})
);
```
-->

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

O mesmo array pode carregar artefatos `.so` externos para JSPI por meio de um
manifesto:

<!--
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
-->

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

<!-- External extensions require JSPI. Asyncify support is limited to the bundled
extensions shipped with the PHP.wasm packages. -->

Extensões externas exigem JSPI. O suporte do Asyncify se limita às extensões
incluídas nos pacotes PHP.wasm.

<!-- See [Loading PHP extensions](/developers/apis/javascript-api/php-extensions)
for manifest format, browser usage, sidecar files, and compatibility notes. -->

Consulte [Carregando extensões do PHP](/developers/apis/javascript-api/php-extensions)
para saber mais sobre o formato do manifesto, o uso no navegador, os arquivos
sidecar e as observações de compatibilidade.

<!-- ## Use cases -->

## Casos de uso

<!-- Run PHP inside Node.js without a native PHP install. Allow developer to produce the following solutions: -->
<!-- - CI/CD jobs and developer tooling. -->
<!-- - Support education and WordPress workflows: Power interactive tutorials, sandboxes, and coding challenges. -->
<!-- - Generate content and prototype server behavior. -->
<!-- - Render HTML using PHP templates, and quickly stand up mock API endpoints to simulate requests. -->

Execute PHP dentro do Node.js sem instalação nativa de PHP. Permite ao desenvolvedor produzir as seguintes soluções:

- Tarefas de CI/CD e ferramentas de desenvolvimento.
- Suporte à educação e fluxos de trabalho WordPress: potencialize tutoriais interativos, sandboxes e desafios de código.
- Gerar conteúdo e prototipar comportamento de servidor.
- Renderizar HTML usando templates PHP e levantar rapidamente endpoints de API simulados para simular requisições.

<!-- ## Practical demos -->

## Demos práticas

<!-- We will list some examples using the PHP-WASM package. -->

Listaremos alguns exemplos usando o pacote PHP-WASM.

<!-- ### Demo 1: File system operations -->

### Demo 1: Operações no sistema de arquivos

<!-- Execute PHP scripts that interact with the file system: -->

Execute scripts PHP que interagem com o sistema de arquivos:

```javascript
import { PHP } from '@php-wasm/universal';
import { loadNodeRuntime } from '@php-wasm/node';

const php = new PHP(await loadNodeRuntime('8.3'));

// Criar estrutura de diretórios
php.mkdir('/app/data');

// Escrever arquivo de configuração
await php.writeFile(
	'/app/config.json',
	JSON.stringify({
		app: 'MyApp',
		version: '1.0.0',
		debug: true,
	})
);

// Criar e executar script PHP que lê a configuração
await php.writeFile(
	'/app/index.php',
	`<?php
$config = json_decode(file_get_contents('/app/config.json'), true);
echo "Application: " . $config['app'] . "\\n";
echo "Version: " . $config['version'] . "\\n";
echo "Debug Mode: " . ($config['debug'] ? 'ON' : 'OFF') . "\\n";

// Listar todos os arquivos
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

### Demo 2: Operações de banco de dados SQLite

<!-- Use PHP's SQLite extension for data storage: -->

Use a extensão SQLite do PHP para armazenamento de dados:

```javascript
import { PHP } from '@php-wasm/universal';
import { loadNodeRuntime } from '@php-wasm/node';

const php = new PHP(await loadNodeRuntime('8.3'));

// Criar diretório para o banco de dados
php.mkdir('/data');

// Criar banco de dados, inserir dados e consultar
const result = await php.runStream({
	code: `<?php
// Criar/conectar ao banco de dados SQLite
$db = new SQLite3('/data/app.db');

// Criar tabela
$db->exec('CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
)');

// Inserir dados de exemplo
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

// Consultar dados
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

// Arquivo do banco de dados persiste no sistema de arquivos virtual
const dbExists = await php.fileExists('/data/app.db');
console.log('\nDatabase persisted:', dbExists);
```

<!-- ### Demo 3: Processing uploaded files (ZIP archives) -->

### Demo 3: Processamento de arquivos enviados (arquivos ZIP)

<!-- Process ZIP files using PHP's Libzip extension: -->

Processe arquivos ZIP usando a extensão Libzip do PHP:

```javascript
import { PHP } from '@php-wasm/universal';
import { loadNodeRuntime } from '@php-wasm/node';

const php = new PHP(await loadNodeRuntime('8.3'));

// Criar arquivos de exemplo
php.mkdir('/uploads');
await php.writeFile('/uploads/readme.txt', 'This is a sample text file');
await php.writeFile('/uploads/data.json', JSON.stringify({ name: 'Test', version: '1.0' }));

// Criar, processar e extrair arquivo ZIP
const result = await php.runStream({
	code: `<?php
// Criar arquivo ZIP
$zip = new ZipArchive();
$zip->open('/uploads/archive.zip', ZipArchive::CREATE);
$zip->addFromString('readme.txt', file_get_contents('/uploads/readme.txt'));
$zip->addFromString('data.json', file_get_contents('/uploads/data.json'));
$zip->addFromString('info.txt', 'Created with PHP WASM');
$zip->close();

echo "ZIP archive created successfully\\n\\n";

// Ler e exibir conteúdo do arquivo
$zip->open('/uploads/archive.zip');
echo "Archive Contents:\\n";
echo str_repeat('=', 50) . "\\n";

for ($i = 0; $i < $zip->numFiles; $i++) {
    $stat = $zip->statIndex($i);
    $size = round($stat['size'] / 1024, 2);
    echo sprintf("%-40s %10s KB\\n", $stat['name'], $size);
}

// Extrair arquivos
$zip->extractTo('/uploads/extracted/');
$zip->close();

echo "\\nExtracted successfully to /uploads/extracted/\\n";

// Listar arquivos extraídos
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

### Demo 4: Padrão de requisição/resposta HTTP

<!-- Simulate web server behavior with request handlers: -->

Simule comportamento de servidor web com manipuladores de requisição:

```javascript
import { PHP } from '@php-wasm/universal';
import { loadNodeRuntime } from '@php-wasm/node';

const php = new PHP(await loadNodeRuntime('8.3'));

// Configurar um endpoint de API simples
await php.mkdir('/www/api');
await php.writeFile(
	'/www/api/users.php',
	`<?php
header('Content-Type: application/json');

// Analisar requisição
$method = $_SERVER['REQUEST_METHOD'];
$input = json_decode(file_get_contents('php://input'), true);

// Roteamento simples
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

// Fazer requisição GET
const getResponse = await php.runStream({
	scriptPath: '/www/api/users.php',
	env: {
		REQUEST_METHOD: 'GET',
		SERVER_NAME: 'localhost',
		SERVER_PORT: '80',
	},
});
console.log('GET Response:', await getResponse.stdoutText);

// Fazer requisição POST
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

### Demo 5: Motor de renderização de templates

<!-- Use PHP as a templating engine for dynamic content: -->

Use PHP como um motor de templates para conteúdo dinâmico:

```javascript
import { PHP } from '@php-wasm/universal';
import { loadNodeRuntime } from '@php-wasm/node';

const php = new PHP(await loadNodeRuntime('8.3'));

// Criar diretório de templates
php.mkdir('/templates');

// Criar template
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

// Renderizar template com dados
const templateData = {
	name: 'Priya Sharma',
	email: 'priya@example.com',
	appName: 'MyAwesomeApp',
	timestamp: Math.floor(Date.now() / 1000),
	features: ['Dashboard Access', 'API Integration', 'Premium Support', 'Custom Branding'],
};

// Passar dados para o template via variáveis de ambiente ou arquivos
await php.writeFile('/template-data.json', JSON.stringify(templateData));

const result = await php.runStream({
	code: `<?php
    $data = json_decode(file_get_contents('/template-data.json'), true);
    extract($data);
    include '/templates/email.php';
  ?>`,
});

console.log(await result.stdoutText);
// Agora você tem HTML renderizado que pode ser enviado por email ou salvo
```

<!-- ### Demo 6: Real-time code execution and streaming -->

### Demo 6: Execução de código em tempo real e streaming

<!-- Process PHP output as it's generated: -->

Processe a saída do PHP conforme ela é gerada:

```javascript
import { PHP } from '@php-wasm/universal';
import { loadNodeRuntime } from '@php-wasm/node';

const php = new PHP(await loadNodeRuntime('8.3'));

await php.writeFile(
	'/stream-demo.php',
	`<?php
// Simular processo de longa duração
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

// Executar script PHP
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

## Padrões de integração

<!-- ### Pattern 1: Express.js middleware -->

### Padrão 1: Middleware Express.js

<!-- Integrate PHP processing into an Express.js application: -->

Integre processamento PHP em uma aplicação Express.js:

```TypeScript
import express from 'express';
import { PHP } from '@php-wasm/universal';
import { loadNodeRuntime } from '@php-wasm/node';

const app = express();
const php = new PHP(await loadNodeRuntime('8.3'));

// Middleware de execução PHP
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

### Padrão 2: Testes automatizados

<!-- Create automated tests for PHP code: -->

Crie testes automatizados para código PHP:

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

### Padrão 3: Integração com ferramentas de build

<!-- Use in build scripts with other Node.js tools: -->

Use em scripts de build com outras ferramentas Node.js:

```javascript
import { PHP } from '@php-wasm/universal';
import { loadNodeRuntime } from '@php-wasm/node';
import fs from 'fs/promises';

async function generateDocumentation() {
	const php = new PHP(await loadNodeRuntime('8.3'));

	// Criar diretório de saída
	php.mkdir('/output');

	// Gerar documentação
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

	// Extrair documentação gerada de volta para o sistema de arquivos Node.js
	await fs.mkdir('./docs', { recursive: true });
	const summaryContent = await php.readFileAsText('/output/summary.md');
	await fs.writeFile('./docs/summary.md', summaryContent);

	console.log('Documentation saved to ./docs/summary.md');
}

generateDocumentation().catch(console.error);
```

<!-- ## Advanced features -->

## Recursos avançados

<!-- ### Working with environment variables -->

### Trabalhando com variáveis de ambiente

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

### Tratamento de erros

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

## Considerações de desempenho

<!-- -   **Reuse PHP instances**: Creating a new PHP instance is expensive. Reuse the same instance when possible. -->
<!-- -   **Batch operations**: Group multiple file operations together rather than running separate scripts. -->
<!-- -   **Memory management**: Large files may impact performance. Consider streaming for big datasets. -->
<!-- -   **Caching**: Cache compiled PHP scripts and frequently accessed data. -->

- **Reutilize instâncias PHP**: Criar uma nova instância PHP é custoso. Reutilize a mesma instância quando possível.
- **Operações em lote**: Agrupe múltiplas operações de arquivo juntas em vez de executar scripts separados.
- **Gerenciamento de memória**: Arquivos grandes podem impactar o desempenho. Considere streaming para grandes conjuntos de dados.
- **Cache**: Faça cache de scripts PHP compilados e dados acessados frequentemente.
