import { PHP } from '@php-wasm/universal';
import { runPHP } from './run-php';
import { loadNodeRuntime } from '@php-wasm/node';

const phpVersion = '8.0';
describe('Blueprint step runPHP', () => {
	let php: PHP;

	beforeEach(async () => {
		php = new PHP(await loadNodeRuntime(phpVersion));
	});

	it('should run PHP code', async () => {
		const result = await runPHP(php, { code: '<?php echo "Hello World";' });
		expect(result.text).toBe('Hello World');
	});

	it('should throw on PHP error', async () => {
		expect(runPHP(php, { code: '<?php $%^;' })).rejects.toThrow();
	});
});
