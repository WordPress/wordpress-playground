const { SupportedPHPVersions } = require('@php-wasm/universal');
const path = require('path');
const fs = require('fs');

SupportedPHPVersions.forEach((phpVersion: string) => {
	describe(`PHP ${phpVersion}`, () => {
		it('Should not include PHP.wasm Node in PHP.wasm FS Journal package', async () => {
			const resolvedBasePath = require.resolve(`@php-wasm/fs-journal`);
			const filePath = path.join(resolvedBasePath, '..', 'package.json');
			const content = await fs.readFileSync(filePath);
			expect(content.includes('@php-wasm/node')).toBeFalsy();
		});
	});
});
