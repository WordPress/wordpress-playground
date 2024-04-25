/**
 * @see https://github.com/WordPress/wordpress-playground/pull/1307 for context on this file.
 * tl;dr Typedoc is incompatible with TypeScript 5.4.5, but it works with a little patch.
 */
const fs = require('fs');
const filePath = '../../../node_modules/typedoc/dist/lib/converter/types.js';

fs.readFile(filePath, 'utf8', (err, data) => {
	if (err) {
		console.error(err);
		return;
	}

	const updatedData = data.replaceAll(
		'namedDeclarations[i].',
		'namedDeclarations[i]?.'
	);
	if (updatedData !== data) {
		fs.writeFile(filePath, updatedData, 'utf8', (err) => {
			if (err) {
				console.error(err);
				return;
			}
			console.log('Typedoc patched successfully.');
		});
	}
});
