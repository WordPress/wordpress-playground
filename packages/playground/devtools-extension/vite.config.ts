import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';
import {
	copyFileSync,
	mkdirSync,
	existsSync,
	readdirSync,
	statSync,
	rmSync,
	readFileSync,
	writeFileSync,
} from 'fs';

// eslint-disable-next-line @nx/enforce-module-boundaries
import { viteTsConfigPaths } from '../../vite-extensions/vite-ts-config-paths';

// Copy directory recursively
function copyDirSync(src: string, dest: string) {
	if (!existsSync(dest)) {
		mkdirSync(dest, { recursive: true });
	}
	const entries = readdirSync(src);
	for (const entry of entries) {
		const srcPath = resolve(src, entry);
		const destPath = resolve(dest, entry);
		if (statSync(srcPath).isDirectory()) {
			copyDirSync(srcPath, destPath);
		} else {
			copyFileSync(srcPath, destPath);
		}
	}
}

// Fix relative paths in HTML after moving from src/subdir to subdir
function fixHtmlPaths(htmlPath: string) {
	let content = readFileSync(htmlPath, 'utf-8');
	// Replace ../../ with ../ since we moved up one directory level
	content = content.replace(/"\.\.\/(\.\.\/)?/g, '"../');
	writeFileSync(htmlPath, content);
}

// Plugin to copy public files and fix output structure
function postBuildPlugin() {
	return {
		name: 'post-build-plugin',
		closeBundle() {
			const distDir = resolve(
				__dirname,
				'../../../dist/packages/playground/devtools-extension'
			);
			const publicDir = resolve(__dirname, 'public');

			// Copy public files to dist
			if (existsSync(publicDir)) {
				copyDirSync(publicDir, distDir);
			}

			// Move HTML files from dist/src/ to dist/
			const srcDir = resolve(distDir, 'src');
			if (existsSync(srcDir)) {
				// Move devtools/index.html
				const srcDevtools = resolve(srcDir, 'devtools/index.html');
				const destDevtools = resolve(distDir, 'devtools/index.html');
				if (existsSync(srcDevtools)) {
					mkdirSync(resolve(distDir, 'devtools'), {
						recursive: true,
					});
					copyFileSync(srcDevtools, destDevtools);
					fixHtmlPaths(destDevtools);
				}

				// Move panel/index.html
				const srcPanel = resolve(srcDir, 'panel/index.html');
				const destPanel = resolve(distDir, 'panel/index.html');
				if (existsSync(srcPanel)) {
					mkdirSync(resolve(distDir, 'panel'), { recursive: true });
					copyFileSync(srcPanel, destPanel);
					fixHtmlPaths(destPanel);
				}

				// Remove src directory
				rmSync(srcDir, { recursive: true, force: true });
			}
		},
	};
}

export default defineConfig({
	root: __dirname,
	plugins: [
		react(),
		viteTsConfigPaths({
			root: '../../../',
		}),
		postBuildPlugin(),
	],
	base: './',
	build: {
		outDir: '../../../dist/packages/playground/devtools-extension',
		emptyDirBeforeWrite: true,
		rollupOptions: {
			input: {
				'panel/index': resolve(__dirname, 'src/panel/index.html'),
				'devtools/index': resolve(__dirname, 'src/devtools/index.html'),
				background: resolve(__dirname, 'src/background.ts'),
				'content-script': resolve(__dirname, 'src/content-script.ts'),
			},
			output: {
				entryFileNames: '[name].js',
				chunkFileNames: 'chunks/[name]-[hash].js',
				assetFileNames: 'assets/[name]-[hash][extname]',
			},
		},
		sourcemap: 'inline',
	},
	css: {
		modules: {
			localsConvention: 'camelCaseOnly',
		},
	},
});
