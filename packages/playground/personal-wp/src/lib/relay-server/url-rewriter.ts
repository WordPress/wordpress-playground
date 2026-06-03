/**
 * Rewrites URLs in HTML and CSS responses so they go through the relay
 * tunnel instead of escaping back to the host's origin.
 *
 * The previous implementation walked the response body with regular
 * expressions. That was fragile against perfectly legal HTML constructs
 * (greater-than signs in attribute values, unquoted attributes, comments
 * containing fake tags, URLs inside <script> bodies, …) and could either
 * miss attributes or rewrite text that wasn't a URL at all. We use a real
 * HTML parser via the browser-native DOMParser instead. The host runs in
 * a browser tab so DOMParser is always available; the unit tests run
 * under jsdom (see url-rewriter.spec.ts) so the parser is the same shape
 * in both environments.
 *
 * CSS is rewritten with a small targeted regex. CSS's url() syntax is
 * unambiguous within a CSS context (no nested element structure to get
 * lost in), and dragging in a full CSS parser just to handle url() would
 * be overkill. The regex still goes through the same isRewritableUrl()
 * gate so it never touches data:, javascript:, mailto:, protocol-relative,
 * already-relayed, or third-party URLs.
 */

/**
 * Build a rewriter bound to one session. Returned object exposes both an
 * HTML and a CSS rewrite — they share the URL-classification logic so
 * "should we touch this URL?" answers the same question regardless of
 * whether we found it inside an `href` attribute or a `url()` value.
 */
export function createRelayUrlRewriter(
	sessionId: string,
	originalHost: string
) {
	const relayPrefix = `/relay/${sessionId}/request`;

	const getRelayPath = (path: string): string => {
		const scopedMatch = path.match(/^\/scope:[^/]+(\/.*)?$/);
		if (scopedMatch) {
			return scopedMatch[1] || '/';
		}
		return path;
	};

	/**
	 * Decide whether a URL string should be redirected through the relay.
	 *
	 * Rewritable:
	 *   - Absolute paths (start with `/`) that aren't already relayed.
	 *   - Full http(s) URLs whose host matches the original host the
	 *     guest sees through the relay (so e.g. WordPress emitting
	 *     `https://playground.example/wp-content/...` lands back inside
	 *     the tunnel).
	 *
	 * Left alone:
	 *   - Already-relayed paths (`/relay/{sid}/request/...`) so we never
	 *     double-prefix.
	 *   - Anchor-only fragments (`#section`).
	 *   - Protocol-relative (`//cdn.example.com/...`).
	 *   - Other schemes: data:, javascript:, mailto:, tel:, blob:, …
	 *   - http(s) URLs pointing at any host other than originalHost.
	 *   - Relative paths (`foo/bar.html`) — the browser resolves them
	 *     against the current document URL, which is already inside the
	 *     relay tunnel, so they end up in the right place automatically.
	 */
	const isRewritableUrl = (raw: string): boolean => {
		if (!raw) {
			return false;
		}
		const trimmed = raw.trim();
		if (!trimmed) {
			return false;
		}
		if (trimmed.startsWith('//')) {
			return false;
		}
		if (trimmed.startsWith('#')) {
			return false;
		}
		// Absolute path on the same origin.
		if (trimmed.startsWith('/')) {
			if (trimmed.startsWith('/relay/')) {
				return false;
			}
			return true;
		}
		// Anything with a scheme: only http(s) to the original host counts.
		if (/^[a-z][a-z0-9+.-]*:/i.test(trimmed)) {
			try {
				const u = new URL(trimmed);
				if (u.protocol !== 'http:' && u.protocol !== 'https:') {
					return false;
				}
				if (!originalHost) {
					return false;
				}
				return u.host === originalHost;
			} catch {
				return false;
			}
		}
		// Plain relative path — leave it for the browser to resolve.
		return false;
	};

	const rewriteUrl = (raw: string): string => {
		const trimmed = raw.trim();
		// Full URL: extract the path portion and reattach.
		if (/^[a-z][a-z0-9+.-]*:/i.test(trimmed)) {
			try {
				const u = new URL(trimmed);
				return `${relayPrefix}${getRelayPath(u.pathname)}${u.search}${u.hash}`;
			} catch {
				return raw;
			}
		}
		// Absolute path.
		return `${relayPrefix}${getRelayPath(trimmed)}`;
	};

	/**
	 * srcset is a comma-separated list where each entry is a URL plus an
	 * optional descriptor (`1x`, `2x`, `480w`, …). We have to split, rewrite
	 * the URL portion in place, and rejoin without disturbing whitespace
	 * the source author intentionally chose.
	 */
	const rewriteSrcset = (srcset: string): string =>
		srcset
			.split(',')
			.map((part) => {
				const leadingMatch = part.match(/^(\s*)(\S+)(\s.*)?$/);
				if (!leadingMatch) {
					return part;
				}
				const [, leading, url, descriptor = ''] = leadingMatch;
				if (isRewritableUrl(url)) {
					return `${leading}${rewriteUrl(url)}${descriptor}`;
				}
				return part;
			})
			.join(',');

	const rewriteCssText = (css: string): string =>
		css.replace(
			/url\(\s*(['"]?)([^'")\s]+)\1\s*\)/gi,
			(match, quote: string, url: string) => {
				if (isRewritableUrl(url)) {
					return `url(${quote}${rewriteUrl(url)}${quote})`;
				}
				return match;
			}
		);

	const isRewritableScriptUrl = (raw: string): boolean => {
		if (!isRewritableUrl(raw)) {
			return false;
		}
		let path = raw.trim();
		let isScopedPath = path.startsWith('/scope:');
		if (/^[a-z][a-z0-9+.-]*:/i.test(path)) {
			try {
				path = new URL(path).pathname;
				isScopedPath = path.startsWith('/scope:');
			} catch {
				return false;
			}
		}
		path = getRelayPath(path);
		return (
			isScopedPath ||
			path === '/wp-admin/admin-ajax.php' ||
			path.startsWith('/wp-json/') ||
			path.startsWith('/index.php?rest_route=')
		);
	};

	const rewriteScriptText = (script: string): string =>
		script.replace(
			/(["'])(https?:\/\/[^"']+|\/[^"']+)\1/g,
			(match, quote: string, url: string) => {
				if (isRewritableScriptUrl(url)) {
					return `${quote}${rewriteUrl(url)}${quote}`;
				}
				return match;
			}
		);

	const getRuntimeUrlRewriteScript = (): HTMLScriptElement => {
		const script = document.createElement('script');
		script.textContent = `
(() => {
	const relayPrefix = ${JSON.stringify(relayPrefix)};
	const rewriteUrl = (input) => {
		try {
			const url = new URL(String(input), window.location.href);
			if (
				url.origin === window.location.origin &&
				url.pathname.startsWith('/scope:')
			) {
				url.pathname =
					relayPrefix + (url.pathname.match(/^\\/scope:[^/]+(\\/.*)?$/)?.[1] || '/');
				return url.href;
			}
		} catch {}
		return input;
	};
	const rewriteAndNavigate = (url) => {
		const rewritten = rewriteUrl(url);
		if (rewritten !== url) {
			window.location.href = rewritten;
			return true;
		}
		return false;
	};

	const originalFetch = window.fetch;
	window.fetch = (input, init) => {
		if (input instanceof Request) {
			const rewritten = rewriteUrl(input.url);
			if (rewritten !== input.url) {
				return originalFetch(new Request(rewritten, input), init);
			}
			return originalFetch(input, init);
		}
		return originalFetch(rewriteUrl(input), init);
	};

	const originalXHROpen = XMLHttpRequest.prototype.open;
	XMLHttpRequest.prototype.open = function(method, url, ...rest) {
		return originalXHROpen.call(this, method, rewriteUrl(url), ...rest);
	};

	const originalSendBeacon = navigator.sendBeacon?.bind(navigator);
	if (originalSendBeacon) {
		navigator.sendBeacon = (url, data) => originalSendBeacon(rewriteUrl(url), data);
	}

	const originalWindowOpen = window.open?.bind(window);
	if (originalWindowOpen) {
		window.open = (url, target, features) =>
			originalWindowOpen(url === undefined ? url : rewriteUrl(url), target, features);
	}

	document.addEventListener('click', (event) => {
		const target = event.target;
		const link = target instanceof Element ? target.closest('a[href]') : null;
		if (!link) {
			return;
		}
		const href = link.getAttribute('href');
		if (!href) {
			return;
		}
		const rewritten = rewriteUrl(href);
		if (rewritten === href) {
			return;
		}
		event.preventDefault();
		window.location.href = rewritten;
	}, true);

	document.addEventListener('submit', (event) => {
		const form = event.target;
		if (!(form instanceof HTMLFormElement)) {
			return;
		}
		const action = form.getAttribute('action') || window.location.href;
		const rewritten = rewriteUrl(action);
		if (rewritten === action) {
			return;
		}
		form.setAttribute('action', rewritten);
	}, true);

	try {
		const originalAssign = Location.prototype.assign;
		Location.prototype.assign = function(url) {
			if (!rewriteAndNavigate(String(url))) {
				return originalAssign.call(this, url);
			}
		};
		const originalReplace = Location.prototype.replace;
		Location.prototype.replace = function(url) {
			const rewritten = rewriteUrl(String(url));
			return originalReplace.call(this, rewritten);
		};
	} catch {}
})();
`;
		return script;
	};

	/**
	 * The full set of HTML attributes that carry URLs we care about.
	 * Includes the modern ones (`formaction`, `imagesrcset`) and the
	 * old SGML/HTML4 carry-overs (`background`, `longdesc`, `cite`,
	 * `usemap`, `manifest`) so themes that still emit them work.
	 *
	 * Notably absent: `srcset`/`imagesrcset` and `style` are handled
	 * separately because they have their own internal grammars.
	 */
	const URL_ATTRS = [
		'href',
		'src',
		'action',
		'formaction',
		'data',
		'poster',
		'background',
		'cite',
		'longdesc',
		'usemap',
		'manifest',
	];

	const rewriteHtml = (html: string): string => {
		const doc = new DOMParser().parseFromString(html, 'text/html');
		const shouldInjectRuntimeRewriter = html.includes('/scope:');

		// Start the walker at <html> rather than at the Document node so
		// the very first currentNode is already an Element (the Document
		// node has no getAttribute()).
		const walker = doc.createTreeWalker(
			doc.documentElement,
			NodeFilter.SHOW_ELEMENT
		);
		let node: Element | null = walker.currentNode as Element;
		while (node) {
			// We treat attribute names case-insensitively because HTML is
			// case-insensitive but the underlying DOM stores whatever case
			// the parser saw.
			for (const attr of URL_ATTRS) {
				const val = node.getAttribute(attr);
				if (val !== null && isRewritableUrl(val)) {
					node.setAttribute(attr, rewriteUrl(val));
				}
			}
			for (const attr of ['srcset', 'imagesrcset']) {
				const val = node.getAttribute(attr);
				if (val !== null) {
					node.setAttribute(attr, rewriteSrcset(val));
				}
			}
			const style = node.getAttribute('style');
			if (style !== null) {
				node.setAttribute('style', rewriteCssText(style));
			}
			node = walker.nextNode() as Element | null;
		}

		// <style> element bodies are full CSS — rewrite the same way as
		// standalone CSS responses.
		doc.querySelectorAll('style').forEach((el) => {
			if (el.textContent) {
				el.textContent = rewriteCssText(el.textContent);
			}
		});
		// WordPress exposes important HTTP endpoints such as admin-ajax
		// in inline settings scripts. Rewrite only those known URL shapes,
		// leaving arbitrary JavaScript strings untouched.
		doc.querySelectorAll('script').forEach((el) => {
			if (el.textContent) {
				el.textContent = rewriteScriptText(el.textContent);
			}
		});
		if (shouldInjectRuntimeRewriter) {
			(doc.head || doc.documentElement).prepend(
				getRuntimeUrlRewriteScript()
			);
		}

		// DOMParser strips the doctype from outerHTML serialization;
		// reattach it so the guest browser parses the response in the
		// same mode the host emitted.
		const doctype = doc.doctype
			? `<!DOCTYPE ${doc.doctype.name}` +
				(doc.doctype.publicId
					? ` PUBLIC "${doc.doctype.publicId}"`
					: '') +
				(doc.doctype.systemId && !doc.doctype.publicId
					? ` SYSTEM "${doc.doctype.systemId}"`
					: doc.doctype.systemId
						? ` "${doc.doctype.systemId}"`
						: '') +
				'>'
			: '';
		return doctype + doc.documentElement.outerHTML;
	};

	const rewriteCss = (css: string): string => rewriteCssText(css);

	return { rewriteHtml, rewriteCss };
}
