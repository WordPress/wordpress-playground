import { SpawnedWorkerThread, postMessageExpectReply, awaitReply } from '@wordpress/php-wasm';

class PlaygroundClient extends SpawnedWorkerThread {

    constructor(iframe: HTMLIFrameElement) {
        super({
            async sendMessage(message, timeout) {
                const requestId = postMessageExpectReply(
                    iframe.contentWindow!,
                    message,
                    '*'
                );
                return await awaitReply(window, requestId, timeout);
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

    async rpc<T>(method: string, args?: Record<string, any> = {}): Promise<T> {
		return await this.messageChannel.sendMessage({
            method,
            args: Object.values(args),
			type: 'rpc',
		});
    }
    
}

async function main() {
    console.log("A");
    const iframe = document.getElementById('wp') as HTMLIFrameElement;
    iframe.src = "/wordpress.html?rpc=1";
    await new Promise((resolve) => setTimeout(resolve, 1000));
    const client = new PlaygroundClient(iframe);
    console.log("B", client);
    await client.writeFile("/test.php", "echo 'Hello World!';");
    console.log("C");
    console.log(await client.listFiles("/"));
    console.log(await client.readFile("/test.php"));
    console.log("D");
}
main();
