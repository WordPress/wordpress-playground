/**
 * Replaces `import dependencyFilename from ` with `const dependencyFilename = __dirName + `
 * in all files matching glob `php_*.js` in directory specified by argv[0].
 *
 * We need this to:
 *
 * * Produce a CommonJS and ESM-compliant module using Vite
 * * Make the uncompiled source compatible with Bun
 */
const fs = require('fs');
const glob = require('glob');

const directory = process.argv[2];

const files = glob.globSync(`${directory}/php_*.js`);
files.forEach((file) => {
	fs.readFile(file, 'utf8', (err, data) => {
		if (err) {
			console.error(err);
			return;
		}

		const updatedData = data.replace(
			'import dependencyFilename from ',
			'const dependencyFilename = __dirname + '
		);

		fs.writeFile(file, updatedData, 'utf8', (err) => {
			if (err) {
				console.error(err);
				return;
			}

			console.log(`Updated file: ${file}`);
		});
	});
});
