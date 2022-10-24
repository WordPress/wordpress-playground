
/**
 * @returns 
 */
export function getCurrentEnvironment() {
    /* eslint-disable no-undef */
    if (typeof window !== 'undefined') {
        return getIframeEnvironment();
    } else if(typeof SharedWorkerGlobalScope !== 'undefined' &&
        self instanceof SharedWorkerGlobalScope) {
        return getSharedWorkerEnvironment();
    } else if(typeof WorkerGlobalScope !== 'undefined' &&
        self instanceof WorkerGlobalScope) {
        return getWebWorkerEnvironment();
    } else {
        throw new Error(`Unsupported environment`);
    }
    /* eslint-enable no-undef */
}

export const getIframeEnvironment = () => ({
    name: 'iframe',
    addMessageListener(handler) {
        window.addEventListener(
            'message',
            (event) =>
                handler(event, (response) =>
                    event.source.postMessage(response, '*')
                ),
            false
        );
        const postMessageToParent = (message) => window.parent.postMessage(message, '*');
        return postMessageToParent;
    }
});

export const getWebWorkerEnvironment = () => ({
    name: 'webWorker',
    addMessageListener(handler) {
        onmessage = (event) => {
            handler(event, postMessage);
        };
        const postMessageToParent = postMessage;
        return postMessageToParent;
    }
});

export const getSharedWorkerEnvironment = () => ({
    name: 'sharedWorker',
    addMessageListener(handler) {
        let postMessageToParent;
        self.onconnect = (e) => {
            const port = e.ports[0];

            port.addEventListener('message', (event) => {
                handler(event, (r) => port.postMessage(r));
            });

            postMessageToParent = port.postMessage;

            port.start(); // Required when using addEventListener. Otherwise called implicitly by onmessage setter.
        };
        // @TODO: Support more than one port
        return (message) => postMessageToParent(message);
    }
})

