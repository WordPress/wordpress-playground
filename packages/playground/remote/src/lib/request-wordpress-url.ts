/**
 * Ask the WordPress document for its live location, including changes from pushState().
 * Such changes do not update iframe.src and may have happened since the last URL report.
 *
 * Send a new reply port only to the expected WordPress origin. Each call has its own
 * port, so a late reply to an earlier request cannot satisfy this one. Return undefined
 * if no reply arrives within 500ms or the request fails. The caller can then try reading
 * location directly or use iframe.src. A timeout does not prove the page has no reporter.
 */
export async function requestWordPressUrl(
	frame: HTMLIFrameElement,
	wordPressOrigin: string
): Promise<string | undefined> {
	if (!frame.contentWindow) return undefined;
	const channel = new MessageChannel();
	let timeout: ReturnType<typeof setTimeout> | undefined;
	try {
		return await new Promise<string | undefined>((resolve) => {
			// Do not hang on plain HTML with no reporter, or a page that cannot reply in time.
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
		// Navigation polling calls this repeatedly. Close the channel even on timeout.
		clearTimeout(timeout);
		channel.port1.close();
		channel.port2.close();
	}
}
