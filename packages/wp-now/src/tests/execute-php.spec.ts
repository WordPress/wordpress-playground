import fs from 'fs-extra';
import path from 'path';
import { executePHP } from '../execute-php';
import getWpNowConfig from '../config';
import { runCli } from '../run-cli';

const exampleDir = path.join(__dirname, 'execute-php');

test('php file execution in index mode', async () => {
	const resultFilePath = path.join(exampleDir, 'hello-world-result.txt');
	// reset result file
	fs.writeFileSync(resultFilePath, '');
	const options = await getWpNowConfig({
		path: exampleDir,
	});
	await executePHP(
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
	await executePHP(['php', path.join(exampleDir, 'php-version.php')], {
		...options,
		phpVersion: '7.4',
	});
	let output = fs.readFileSync(resultFilePath, 'utf8');
	expect(output.substring(0, 16)).toBe('PHP Version: 7.4');

	await executePHP(['php', path.join(exampleDir, 'php-version.php')], {
		...options,
		phpVersion: '8.0',
	});
	output = fs.readFileSync(resultFilePath, 'utf8');
	expect(output.substring(0, 16)).toBe('PHP Version: 8.0');

	await executePHP(['php', path.join(exampleDir, 'php-version.php')], {
		...options,
		phpVersion: '8.2',
	});
	output = fs.readFileSync(resultFilePath, 'utf8');
	expect(output.substring(0, 16)).toBe('PHP Version: 8.2');

	fs.writeFileSync(resultFilePath, 'PHP Version: X.Y');
});

test('php throws an error if the first element is not the string "php"', async () => {
	const options = await getWpNowConfig({
		path: exampleDir,
	});
	try {
		await executePHP(
			['word-different-to-php', path.join(exampleDir, 'php-version.php')],
			{
				...options,
				phpVersion: '7.4',
			}
		);
	} catch (error) {
		expect(error.message).toBe(
			'The first argument to executePHP must be the string "php".'
		);
	}
});

describe('validate php arguments passed through yargs', () => {
	let output = '';
	let consoleLogMock;
	let processExitMock;
	const argv = process.argv;
	beforeEach(() => {
		consoleLogMock = vi
			.spyOn(console, 'log')
			.mockImplementation((newLine: string) => {
				output += `${newLine}\n`;
			});
		processExitMock = vi
			.spyOn(process, 'exit')
			.mockImplementation(() => null);
	});

	afterEach(() => {
		output = '';
		process.argv = argv;
		consoleLogMock.mockRestore();
		processExitMock.mockRestore();
	});

	test('php should receive the correct yargs arguments', async () => {
		process.argv = ['node', 'wp-now', 'php', '--', '--version'];
		await runCli();
		expect(output).toMatch(/PHP 8\.0(.*)\(cli\)/i);
		expect(processExitMock).toHaveBeenCalledWith(0);
	});

	test('wp-now should change the php version', async () => {
		process.argv = [
			'node',
			'wp-now',
			'php',
			'--php=7.4',
			'--',
			'--version',
		];
		await runCli();
		expect(output).toMatch(/PHP 7\.4(.*)\(cli\)/i);
		expect(processExitMock).toHaveBeenCalledWith(0);
	});

	test('php should execute a file', async () => {
		const filePath = path.join(exampleDir, 'print-php-version.php');
		process.argv = ['node', 'wp-now', 'php', filePath];
		await runCli();
		expect(output).toMatch(/8\.0/i);
		expect(processExitMock).toHaveBeenCalledWith(0);
	});

	test('php should execute a file and change php version', async () => {
		const filePath = path.join(exampleDir, 'print-php-version.php');
		process.argv = ['node', 'wp-now', 'php', '--php=7.4', '--', filePath];
		await runCli();
		expect(output).toMatch(/7\.4/i);
		expect(processExitMock).toHaveBeenCalledWith(0);
	});
});
