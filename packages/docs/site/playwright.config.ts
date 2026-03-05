import { defineConfig } from '@playwright/test';
import fs from 'fs';
import path from 'path';

const port = process.env.DOCS_E2E_PORT ?? '4173';
const host = process.env.DOCS_E2E_HOST ?? '127.0.0.1';
const baseUrl = process.env.DOCS_E2E_BASE_URL ?? `http://${host}:${port}`;
const rawBasePath = process.env.DOCS_E2E_BASE_PATH ?? '/wordpress-playground';
const normalizedBasePath =
	rawBasePath === '/' ? '/' : `/${rawBasePath.replace(/^\/|\/$/g, '')}`;
const healthPath =
	process.env.DOCS_E2E_HEALTH_PATH ?? `${normalizedBasePath}/index.html`;
const repoRoot =
	process.env.DOCS_E2E_REPO_ROOT ?? path.resolve(__dirname, '../../..');
const buildDir =
	process.env.DOCS_E2E_BUILD_DIR ?? path.join(repoRoot, 'dist/docs/build');

const mountDir =
	normalizedBasePath === '/'
		? null
		: path.join(buildDir, normalizedBasePath.replace(/^\//, ''));

if (mountDir && fs.existsSync(buildDir) && !fs.existsSync(mountDir)) {
	try {
		fs.symlinkSync(buildDir, mountDir, 'junction');
	} catch (error) {
		// eslint-disable-next-line no-console
		console.warn(
			`docs-site e2e: failed to create symlink for base path ${normalizedBasePath}`,
			error
		);
	}
}

export default defineConfig({
	testDir: './tests',
	timeout: 60_000,
	expect: {
		timeout: 10_000,
	},
	use: {
		baseURL: baseUrl,
		trace: 'retain-on-failure',
		screenshot: 'only-on-failure',
		video: 'retain-on-failure',
	},
	webServer: {
		command: `npx http-server "${buildDir}" -p ${port} -a ${host} -c-1`,
		url: `${baseUrl}${healthPath}`,
		reuseExistingServer: !process.env.CI,
		timeout: 120_000,
	},
	projects: [
		{
			name: 'chromium',
			use: { browserName: 'chromium' },
		},
	],
});
