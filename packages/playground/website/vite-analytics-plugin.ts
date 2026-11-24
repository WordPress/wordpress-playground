import type { Plugin } from 'vite';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const GA4_ID_PATTERN = /^G-[A-Z0-9]+$/;

// These HTML files are not part of Vite's rollup inputs, so
// transformIndexHtml cannot reach them. They are handled
// separately in the writeBundle hook (build only).
const EXTRA_HTML_FILES = ['wordpress.html', 'gutenberg.html'];

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

function getValidGaId(): string | null {
	const gaId = process.env.VITE_GOOGLE_ANALYTICS_ID;
	if (!gaId) {
		return null;
	}
	if (!GA4_ID_PATTERN.test(gaId)) {
		// eslint-disable-next-line no-console
		console.error(
			`Invalid VITE_GOOGLE_ANALYTICS_ID: "${gaId}".` +
				' Expected format: G-XXXXXXXXXX.'
		);
		return null;
	}
	return gaId;
}

export function analyticsInjectionPlugin(): Plugin {
	return {
		name: 'analytics-injection',
		// Handles index.html in both dev and build modes.
		transformIndexHtml(html) {
			const gaId = getValidGaId();
			if (!gaId) {
				return html;
			}
			return html.replace('</head>', gtagSnippet(gaId) + '\n</head>');
		},
		// Handles extra HTML files that are not Vite entry
		// points (build only).
		writeBundle({ dir: outputDir }) {
			const gaId = getValidGaId();
			if (!gaId || !outputDir) {
				return;
			}

			const snippet = gtagSnippet(gaId);

			for (const file of EXTRA_HTML_FILES) {
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
