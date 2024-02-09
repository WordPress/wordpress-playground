import { NodePHP } from '@php-wasm/node';
import { withPlaygroundLibrary } from './index';

const phpVersion = '8.0';

describe('withPlaygroundLibrary()', () => {
	let php: NodePHP;
	beforeEach(async () => {
		php = await NodePHP.load(phpVersion as any, {});
		php.mkdir('/php');
		php.setPhpIniEntry('disable_functions', '');
	});
	it('Should provide the variables', async () => {
		const result = await withPlaygroundLibrary(
			php as any,
			`<?php echo json_encode($variable1); `,
			{
				variable1: {
					key: 'value',
				},
			}
		);
		expect(result.json).toEqual({
			key: 'value',
		});
	});
});
