import { SpawnedWorkerThread, postMessageExpectReply, awaitReply } from '@wordpress/php-wasm';

export default class PlaygroundClient extends SpawnedWorkerThread {

	constructor(iframe: HTMLIFrameElement) {
        super({
            async sendMessage(message, timeout) {
                const requestId = postMessageExpectReply(
                    iframe.contentWindow!,
                    message,
                    '*'
                );
                const response = await awaitReply(window, requestId, timeout);
                return response;
            },
            setMessageListener(listener) {
                window.addEventListener(
                    'message',
                    (e) => {
                        if (e.source === iframe.contentWindow) {
                            listener(e);
                        }
                    },
                    false
                );
            },
        });
	}

}
