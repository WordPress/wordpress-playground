import { useState } from 'react';
import css from './style.module.css';
import { PlaygroundLogo } from '../overlay';

/**
 * Detects if the page is loaded inside an iOS WebView (WKWebView) rather
 * than Safari proper. In a WebView, Safari omits the `Version/` token from
 * the user-agent string; real Safari and every other iOS browser include it.
 *
 * We also exclude Chrome (CriOS) and Firefox (FxiOS) which have their own
 * known-working user-agent patterns.
 */
export function isSafariMobileWebview(): boolean {
	const ua = navigator.userAgent;

	// iPad on iOS 13+ reports as "MacIntel" with touch support.
	const isIOS =
		/iPad|iPhone|iPod/.test(ua) ||
		(navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

	if (!isIOS) {
		return false;
	}

	// Safari proper always includes "Version/"; other dedicated browsers have
	// their own markers. If none of those are present we're in a WebView.
	const isSafariBrowser = /Version\//.test(ua);
	const isChromeiOS = /CriOS\//.test(ua);
	const isFirefoxiOS = /FxiOS\//.test(ua);

	return !isSafariBrowser && !isChromeiOS && !isFirefoxiOS;
}

function openInSafari() {
	// The x-safari-https:// scheme hands the URL off to Safari on iOS.
	window.location.href = `x-safari-https://${window.location.host}${window.location.pathname}${window.location.search}${window.location.hash}`;
}

export function SafariWebviewNotice() {
	const [copied, setCopied] = useState(false);

	if (!isSafariMobileWebview()) {
		return null;
	}

	const currentUrl = window.location.href;

	async function copyUrl() {
		await navigator.clipboard.writeText(currentUrl);
		setCopied(true);
		setTimeout(() => setCopied(false), 2000);
	}

	return (
		<div className={css.overlay} role="dialog" aria-modal="true">
			<div className={css.content}>
				<PlaygroundLogo />

				<h1 className={css.title}>Open in your browser</h1>
				<p className={css.description}>
					WordPress Playground requires features that are not
					available in in-app browsers. Please open this page in
					Safari or your preferred browser to continue.
				</p>

				<div className={css.actions}>
					<button
						className={css.primaryButton}
						onClick={openInSafari}
						type="button"
					>
						Open in Safari
					</button>
					<button
						className={css.secondaryButton}
						onClick={copyUrl}
						type="button"
					>
						{copied ? 'Copied!' : 'Copy URL'}
					</button>
				</div>

				<p className={css.hint}>
					Copy the URL and paste it in Safari or any other browser.
				</p>
			</div>
		</div>
	);
}
