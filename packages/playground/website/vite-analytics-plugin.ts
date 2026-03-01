import type { Plugin } from 'vite';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const GA4_ID_PATTERN = /^G-[A-Z0-9]+$/;

const HTML_FILES = ['index.html', 'wordpress.html', 'gutenberg.html'];

function gtagSnippet(id: string): string {
	return [
		`<script async src="https://www.googletagmanager.com/gtag/js?id=${id}"></script>`,
		'<script>',
		'window.dataLayer = window.dataLayer || [];',
		'function gtag(){dataLayer.push(arguments);}',
		"gtag('js', new Date());",
		`gtag('config', '${id}');`,
		'</script>',
	].join('\n');
}

export function analyticsInjectionPlugin(): Plugin {
	return {
		name: 'analytics-injection',
		apply: 'build',
		writeBundle({ dir: outputDir }) {
			const gaId = process.env.VITE_GOOGLE_ANALYTICS_ID;
			if (!gaId) {
				return;
			}

			if (!GA4_ID_PATTERN.test(gaId)) {
				// eslint-disable-next-line no-console
				console.error(
					`Invalid VITE_GOOGLE_ANALYTICS_ID: "${gaId}".` +
						' Expected format: G-XXXXXXXXXX.'
				);
				return;
			}

			if (!outputDir) {
				return;
			}

			const snippet = gtagSnippet(gaId);

			for (const file of HTML_FILES) {
				const filePath = join(outputDir, file);
				if (!existsSync(filePath)) {
					continue;
				}
				try {
					const html = readFileSync(filePath, 'utf-8');
					const injected = html.replace(
						'</head>',
						snippet + '\n</head>'
					);
					writeFileSync(filePath, injected, 'utf-8');
				} catch (e) {
					// eslint-disable-next-line no-console
					console.error(
						`Failed to inject analytics into ${file}:`,
						e
					);
				}
			}
		},
	} as Plugin;
}
