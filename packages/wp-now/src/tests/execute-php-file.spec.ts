import fs from 'fs-extra';
import path from 'path';
import { executePHPFile } from '../execute-php-file';

const exampleDir = path.join(__dirname, 'execute-php-file');

test('php file execution in index mode', async () => {
	const resultFilePath = path.join(exampleDir, 'hello-world-result.txt');
	// reset result file
	fs.writeFileSync(resultFilePath, '');

	const result = await executePHPFile(
		path.join(exampleDir, 'hello-world.php')
	);
	expect(result.name).toBe('ExitStatus');
	expect(result.status).toBe(0);
	const output = fs.readFileSync(resultFilePath, 'utf8');
	expect(output).toBe('Hello World!');
});

test('php file execution for each PHP Version', async () => {
	const resultFilePath = path.join(exampleDir, 'php-version-result.txt');

	let result = await executePHPFile(
		path.join(exampleDir, 'php-version.php'),
		{ phpVersion: '7.4' }
	);
	expect(result.name).toBe('ExitStatus');
	expect(result.status).toBe(0);
	let output = fs.readFileSync(resultFilePath, 'utf8');
	expect(output.substring(0, 16)).toBe('PHP Version: 7.4');

	result = await executePHPFile(path.join(exampleDir, 'php-version.php'), {
		phpVersion: '8.0',
	});
	expect(result.name).toBe('ExitStatus');
	expect(result.status).toBe(0);
	output = fs.readFileSync(resultFilePath, 'utf8');
	expect(output.substring(0, 16)).toBe('PHP Version: 8.0');

	result = await executePHPFile(path.join(exampleDir, 'php-version.php'), {
		phpVersion: '8.2',
	});
	expect(result.name).toBe('ExitStatus');
	expect(result.status).toBe(0);
	output = fs.readFileSync(resultFilePath, 'utf8');
	expect(output.substring(0, 16)).toBe('PHP Version: 8.2');

	fs.writeFileSync(resultFilePath, 'PHP Version: X.Y');
});
