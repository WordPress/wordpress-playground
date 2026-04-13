import { PHP } from '@php-wasm/universal';
import { loadNodeRuntime } from '@php-wasm/node';

const php = new PHP(await loadNodeRuntime('8.4', { withXdebug: true }));

const response = await php.runStream({ scriptPath: `src/test.php` });

response.stdout.pipeTo(
	new WritableStream({
		write(chunk) {
			process.stdout.write(chunk);
		},
	})
);
