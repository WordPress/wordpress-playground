/** Ask the live document, including History API changes made since its last report. */
export async function requestWordPressUrl(
	frame: HTMLIFrameElement,
	wordPressOrigin: string
): Promise<string | undefined> {
	if (!frame.contentWindow) return undefined;
	const channel = new MessageChannel();
	let timeout: ReturnType<typeof setTimeout> | undefined;
	try {
		return await new Promise<string | undefined>((resolve) => {
			// Plain HTML pages do not run the reporter. Keep their DOM/src fallback usable.
			timeout = setTimeout(() => resolve(undefined), 500);
			channel.port1.onmessage = (event) => {
				resolve(
					typeof event.data === 'string' ? event.data : undefined
				);
			};
			frame.contentWindow!.postMessage(
				{ type: 'playground-request-url' },
				wordPressOrigin,
				[channel.port2]
			);
		});
	} catch {
		// A detached or restricted frame may reject the request before replying.
		return undefined;
	} finally {
		clearTimeout(timeout);
		channel.port1.close();
		channel.port2.close();
	}
}
