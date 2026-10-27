import type { Plugin } from 'vite';

/**
 * Safari can keep a failed modulepreload in its memory cache across reloads.
 * Keep normal imports and CSS loading, but avoid both of Vite's JS preload paths
 * in Safari. Other browsers retain their preloads.
 * https://bugs.webkit.org/show_bug.cgi?id=270357
 */
export function safariModulePreloadWorkaround(): Plugin {
	return {
		name: 'safari-module-preload-workaround',
		apply: 'build',
		enforce: 'pre',
		transformIndexHtml: {
			order: 'post',
			handler(html) {
				const links: string[] = [];
				html = html.replace(
					/<link\b[^>]*\brel=["']modulepreload["'][^>]*>/g,
					(link) => {
						links.push(link);
						return '';
					}
				);
				if (!links.length) return html;

				// Safari must never parse these links. Removing them after the
				// document loads would be too late to stop the preload requests.
				const markup = JSON.stringify(links.join('')).replaceAll(
					'<',
					'\\u003c'
				);
				return {
					html,
					tags: [
						{
							tag: 'script',
							injectTo: 'head',
							children: `if (!(${isSafari.toString()})()) {
								const links = document.createElement('template');
								links.innerHTML = ${markup};
								document.head.append(links.content);
							}`,
						},
					],
				};
			},
		},
		transform(code, id) {
			if (id !== '\0vite/preload-helper.js') return;

			// Vite shares this helper between optional JS preloads and required
			// CSS. Filter only JS, or lazy features would lose their stylesheets.
			const signature =
				'function preload(baseModule, deps, importerUrl) {';
			if (!code.includes(signature)) {
				this.error(
					'Vite preload helper changed; update the Safari workaround.'
				);
			}
			return {
				code: code.replace(
					signature,
					`${signature}
					if ((${isSafari.toString()})()) {
						deps = deps?.filter(dep => dep.endsWith('.css'));
					}`
				),
				map: null,
			};
		},
	};
}

// Keep this self-contained: the build embeds it in HTML and the preload helper.
function isSafari() {
	return (
		navigator.vendor === 'Apple Computer, Inc.' &&
		/Version\/[\d.]+.*Safari\//.test(navigator.userAgent)
	);
}
