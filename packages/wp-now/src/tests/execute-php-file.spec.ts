import fs from 'fs-extra';
import path from 'path';
import { executePHPFile } from '../execute-php-file';
import getWpNowConfig from '../config';

const exampleDir = path.join(__dirname, 'execute-php-file');

test('php file execution in index mode', async () => {
	const resultFilePath = path.join(exampleDir, 'hello-world-result.txt');
	// reset result file
	fs.writeFileSync(resultFilePath, '');
	const options = await getWpNowConfig({
		path: exampleDir,
	});
	await executePHPFile(
		['php', path.join(exampleDir, 'hello-world.php')],
		options
	);
	const output = fs.readFileSync(resultFilePath, 'utf8');
	expect(output).toBe('Hello World!');
});

test('php file execution for each PHP Version', async () => {
	const resultFilePath = path.join(exampleDir, 'php-version-result.txt');
	const options = await getWpNowConfig({
		path: exampleDir,
	});
	await executePHPFile(['php', path.join(exampleDir, 'php-version.php')], {
		...options,
		phpVersion: '7.4',
	});
	let output = fs.readFileSync(resultFilePath, 'utf8');
	expect(output.substring(0, 16)).toBe('PHP Version: 7.4');

	await executePHPFile(['php', path.join(exampleDir, 'php-version.php')], {
		...options,
		phpVersion: '8.0',
	});
	output = fs.readFileSync(resultFilePath, 'utf8');
	expect(output.substring(0, 16)).toBe('PHP Version: 8.0');

	await executePHPFile(['php', path.join(exampleDir, 'php-version.php')], {
		...options,
		phpVersion: '8.2',
	});
	output = fs.readFileSync(resultFilePath, 'utf8');
	expect(output.substring(0, 16)).toBe('PHP Version: 8.2');

	fs.writeFileSync(resultFilePath, 'PHP Version: X.Y');
});
