
/**
 * @param {Object} options Required options: locateFile
 * @returns 
 */
export function getCurrentEnvironment(options) {
    /* eslint-disable no-undef */
    if (typeof window !== 'undefined') {
        return getIframeEnvironment(options);
    } else if(typeof SharedWorkerGlobalScope !== 'undefined' &&
        self instanceof SharedWorkerGlobalScope) {
        return getSharedWorkerEnvironment(options);
    } else if(typeof WorkerGlobalScope !== 'undefined' &&
        self instanceof WorkerGlobalScope) {
        return getWebWorkerEnvironment(options);
    } else {
        throw new Error(`Unsupported environment`);
    }
    /* eslint-enable no-undef */
}

export const getIframeEnvironment = ({ locateFile }) => ({
    name: 'iframe',
    getPHPLoaderScript() {
        return '/php-web.js';
    }
    async importScripts (...urls) {
        return Promise.all(
            urls
                .map(locateFile)
                .map((url) => {
                    const script = document.createElement('script');
                    script.src = url;
                    script.async = false;
                    document.body.appendChild(script);
                    return new Promise((resolve) => {
                        script.onload = resolve;
                    });
                });
        );
    }   
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

export const getWebWorkerEnvironment = ({ locateFile }) => ({
    name: 'webWorker',
    getPHPLoaderScript() {
        return '/php-webworker.js';
    }
    importScripts: (...urls) => importScripts(...urls.map(locateFile)),
    addMessageListener(handler) {
        onmessage = (event) => {
            handler(event, postMessage);
        };
        const postMessageToParent = postMessage;
        return postMessageToParent;
    }
});

export const getSharedWorkerEnvironment = ({ locateFile }) => ({
    name: 'sharedWorker',
    getPHPLoaderScript() {
        return '/php-webworker.js';
    }
    importScripts: (...urls) => importScripts(...urls.map(locateFile)),
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

