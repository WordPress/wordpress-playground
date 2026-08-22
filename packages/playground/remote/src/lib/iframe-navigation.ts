const DEFAULT_IFRAME_NAVIGATION_TIMEOUT_MS = 10000;

export function waitForIframeLoad(
	iframe: HTMLIFrameElement,
	timeoutMs = DEFAULT_IFRAME_NAVIGATION_TIMEOUT_MS
): Promise<void> {
	return new Promise((resolve, reject) => {
		const onLoad = () => {
			clearTimeout(timeout);
			resolve();
		};
		const timeout = setTimeout(() => {
			iframe.removeEventListener('load', onLoad);
			iframe.src = 'about:blank';
			reject(
				new Error(
					`Playground iframe navigation did not finish within ${timeoutMs}ms.`
				)
			);
		}, timeoutMs);
		iframe.addEventListener('load', onLoad, { once: true });
	});
}
