/**
 * Runs bundler tests to verify that @php-wasm/* and @wp-playground/* packages
 * can be bundled with Vite for both browser and Node.js targets.
 *
 * This test:
 * 1. Builds each entry point with Vite
 * 2. Loads the bundled output (Node bundles via import, web bundles via Playwright)
 * 3. Verifies it doesn't error out
 */
import { spawn } from 'child_process';
import { readdir, writeFile, mkdir } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import { chromium } from 'playwright';

const __dirname = dirname(fileURLToPath(import.meta.url));

interface TestResult {
	name: string;
	success: boolean;
	error?: string;
}

function green(text: string): string {
	return `\x1b[32m${text}\x1b[0m`;
}

function red(text: string): string {
	return `\x1b[31m${text}\x1b[0m`;
}

async function runCommand(
	command: string,
	args: string[],
	cwd: string
): Promise<{ code: number; stdout: string; stderr: string }> {
	return new Promise((resolve) => {
		const proc = spawn(command, args, {
			cwd,
			stdio: ['ignore', 'pipe', 'pipe'],
			shell: true,
		});

		let stdout = '';
		let stderr = '';

		proc.stdout.on('data', (data) => {
			stdout += data.toString();
		});

		proc.stderr.on('data', (data) => {
			stderr += data.toString();
		});

		proc.on('close', (code) => {
			resolve({ code: code ?? 1, stdout, stderr });
		});
	});
}

async function buildBundle(configFile: string): Promise<boolean> {
	console.log(`  Building with ${configFile}...`);
	const result = await runCommand(
		'npx',
		['vite', 'build', '--config', configFile],
		__dirname
	);

	if (result.code !== 0) {
		console.error(`  Build failed:`);
		console.error(result.stderr || result.stdout);
		return false;
	}

	console.log(`  Build successful`);
	return true;
}

async function loadNodeBundle(bundlePath: string): Promise<boolean> {
	console.log(`  Loading bundle: ${bundlePath}...`);
	try {
		const module = await import(bundlePath);
		if (typeof module.smokeTest === 'function') {
			await module.smokeTest();
		}
		console.log(`  Bundle loaded successfully`);
		return true;
	} catch (error) {
		console.error(`  Failed to load bundle:`, error);
		return false;
	}
}

async function loadWebBundleInBrowser(
	distDir: string,
	jsFile: string
): Promise<{ success: boolean; error?: string }> {
	console.log(`  Loading web bundle in browser: ${jsFile}...`);

	// Create a simple HTML file that loads the bundle
	const htmlContent = `<!DOCTYPE html>
<html>
<head>
	<meta charset="utf-8">
	<title>Bundle Test</title>
</head>
<body>
	<script type="module">
		window.testErrors = [];
		window.testLogs = [];
		window.smokeTestPassed = false;

		window.onerror = (msg, url, line, col, error) => {
			window.testErrors.push({ msg, url, line, col, error: error?.toString() });
		};

		const originalConsoleLog = console.log;
		console.log = (...args) => {
			window.testLogs.push(args.join(' '));
			originalConsoleLog.apply(console, args);
		};

		const originalConsoleError = console.error;
		console.error = (...args) => {
			window.testErrors.push({ msg: args.join(' ') });
			originalConsoleError.apply(console, args);
		};
	</script>
	<script type="module" src="./${jsFile}"></script>
	<script type="module">
		// Check if smoke test passed by looking for the log message
		setTimeout(() => {
			window.smokeTestPassed = window.testLogs.some(log =>
				log.includes('Smoke test passed')
			);
			window.testComplete = true;
		}, 1000);
	</script>
</body>
</html>`;

	const htmlPath = join(distDir, 'test.html');
	await writeFile(htmlPath, htmlContent);

	let browser;
	try {
		browser = await chromium.launch({
			headless: true,
			args: [
				'--no-sandbox',
				'--disable-setuid-sandbox',
				'--allow-file-access-from-files',
				'--disable-web-security',
			],
		});
		const page = await browser.newPage();

		// Collect page errors
		const pageErrors: string[] = [];
		page.on('pageerror', (error) => {
			pageErrors.push(error.toString());
		});
		page.on('console', (msg) => {
			if (msg.type() === 'error') {
				pageErrors.push(msg.text());
			}
		});

		// Navigate to the test page
		await page.goto(pathToFileURL(htmlPath).href, {
			waitUntil: 'networkidle',
		});

		// Wait for test to complete
		await page.waitForFunction('window.testComplete === true', {
			timeout: 10000,
		});

		// Check results
		const results = await page.evaluate(() => ({
			errors: (window as any).testErrors,
			logs: (window as any).testLogs,
			smokeTestPassed: (window as any).smokeTestPassed,
		}));

		if (pageErrors.length > 0) {
			return {
				success: false,
				error: `Page errors: ${pageErrors.join(', ')}`,
			};
		}

		if (results.errors && results.errors.length > 0) {
			return {
				success: false,
				error: `JS errors: ${JSON.stringify(results.errors)}`,
			};
		}

		if (!results.smokeTestPassed) {
			return {
				success: false,
				error: `Smoke test did not pass. Logs: ${results.logs?.join(', ') || 'none'}`,
			};
		}

		console.log(`  Web bundle loaded successfully in browser`);
		return { success: true };
	} catch (error) {
		return {
			success: false,
			error: `Playwright error: ${error}`,
		};
	} finally {
		if (browser) {
			await browser.close();
		}
	}
}

async function runTest(
	name: string,
	configFile: string,
	outputDir: string,
	target: 'node' | 'web'
): Promise<TestResult> {
	console.log(`\n=== ${name} ===`);

	// Build the bundle
	const buildSuccess = await buildBundle(configFile);
	if (!buildSuccess) {
		return { name, success: false, error: 'Build failed' };
	}

	// For Node.js bundles, try to load them
	if (target === 'node') {
		const distDir = join(__dirname, outputDir);
		try {
			const files = await readdir(distDir);
			const jsFile = files.find((f) => f.endsWith('.js'));
			if (!jsFile) {
				return {
					name,
					success: false,
					error: 'No JS file found in output',
				};
			}

			const bundlePath = join(distDir, jsFile);
			const loadSuccess = await loadNodeBundle(
				pathToFileURL(bundlePath).href
			);
			if (!loadSuccess) {
				return { name, success: false, error: 'Failed to load bundle' };
			}
		} catch (error) {
			return {
				name,
				success: false,
				error: `Failed to read output directory: ${error}`,
			};
		}
	}

	// For web bundles, load them in a browser using Playwright
	if (target === 'web') {
		const distDir = join(__dirname, outputDir);
		try {
			const files = await readdir(distDir);
			// Look for .js or .mjs files (Vite may use either depending on package type)
			const jsFile = files.find(
				(f) => f.endsWith('.js') || f.endsWith('.mjs')
			);
			if (!jsFile) {
				return {
					name,
					success: false,
					error: `No JS file found in output. Files: ${files.join(', ')}`,
				};
			}

			const browserResult = await loadWebBundleInBrowser(distDir, jsFile);
			if (!browserResult.success) {
				return { name, success: false, error: browserResult.error };
			}
		} catch (error) {
			return {
				name,
				success: false,
				error: `Failed to test web bundle: ${error}`,
			};
		}
	}

	return { name, success: true };
}

async function main(): Promise<void> {
	console.log('=== Bundler Tests (ESM) ===');
	console.log('Testing that @php-wasm/* packages can be bundled with Vite\n');

	await mkdir(join(__dirname, 'dist'), { recursive: true });

	const results: TestResult[] = [];

	// Test 1: Web bundle with static imports
	results.push(
		await runTest(
			'Web Bundle (static imports)',
			'vite.config.web.ts',
			'dist/web',
			'web'
		)
	);

	// Test 2: Node bundle with static imports
	results.push(
		await runTest(
			'Node Bundle (static imports)',
			'vite.config.node-static.ts',
			'dist/node-static',
			'node'
		)
	);

	// Test 3: Node bundle with dynamic imports
	results.push(
		await runTest(
			'Node Bundle (dynamic imports)',
			'vite.config.node-dynamic.ts',
			'dist/node-dynamic',
			'node'
		)
	);

	// Print summary
	console.log('\n=== Results ===');
	let allPassed = true;
	for (const result of results) {
		if (result.success) {
			console.log(green(`✓ ${result.name}`));
		} else {
			console.log(red(`✗ ${result.name}: ${result.error}`));
			allPassed = false;
		}
	}

	if (allPassed) {
		console.log(green('\nAll bundler tests passed!'));
	} else {
		console.log(red('\nSome bundler tests failed!'));
		process.exit(1);
	}
}

main();
