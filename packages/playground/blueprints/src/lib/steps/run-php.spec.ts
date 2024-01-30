import { NodePHP } from '@php-wasm/node';
import { runPHP } from './run-php';

const phpVersion = '8.0';
describe('Blueprint step runPHP', () => {
	let php: NodePHP;

	beforeEach(async () => {
		php = await NodePHP.load(phpVersion, {
			requestHandler: {
				documentRoot: '/wordpress',
			},
		});
	});

	it('should run PHP code', async () => {
		const result = await runPHP(php, { code: '<?php echo "Hello World";' });
		expect(result.text).toBe('Hello World');
	});

	it('should throw on PHP error', async () => {
		expect(runPHP(php, { code: '<?php $%^;' })).rejects.toThrow();
	});
});
