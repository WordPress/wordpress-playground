import fs from 'fs-extra';
import path from 'path';
import { executePHPFile } from '../execute-php-file';
import { SupportedPHPVersions } from '@php-wasm/universal';

const exampleDir = path.join(__dirname, 'execute-php-file');

test('php file execution in index mode', async () => {
  const resultFilePath = path.join(exampleDir, 'hello-world-result.txt')
  // reset result file
  fs.writeFileSync(resultFilePath, '');

  const result = await executePHPFile(path.join(exampleDir, 'hello-world.php'));
  expect(result.name).toBe('ExitStatus');
  expect(result.status).toBe(0);
  const output = fs.readFileSync(resultFilePath, 'utf8');
  expect(output).toBe('Hello World!');
});

test('php file execution for each PHP Version', async () => {
	const resultFilePath = path.join(exampleDir, 'php-version-result.txt');

	for (const phpVersion of SupportedPHPVersions) {
		// reset result file
		fs.writeFileSync(resultFilePath, '');
		const result = await executePHPFile(
			path.join(exampleDir, 'php-version.php'),
			{ phpVersion }
		);
		expect(result.name).toBe('ExitStatus');
		expect(result.status).toBe(0);
		const output = fs.readFileSync(resultFilePath, 'utf8');
		expect(output.substring(0, 16)).toBe(`PHP Version: ${phpVersion}`);
	}
	fs.writeFileSync(resultFilePath, 'PHP Version: X.Y');
});