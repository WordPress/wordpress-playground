import { PHP } from '@php-wasm/universal';
import { loadNodeRuntime } from '@php-wasm/node';
import fs from 'fs';

const php = new PHP(
	await loadNodeRuntime('8.4', {
		withXdebug: true,
		emscriptenOptions: { processId: process.pid },
	})
);

php.mkdir('src');

php.writeFile('src/test.php', fs.readFileSync('./src/test.php'));

const response = await php.runStream({ scriptPath: `src/test.php` });

await response.stdout
	.pipeTo(
		new WritableStream({
			write(chunk) {
				process.stdout.write(chunk);
			},
		})
	)
	.catch((error) => {
		process.stderr.write(error);
		process.exit(1);
	});
