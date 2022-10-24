
export const webEnvironment = {
    name: 'WEB', // Matches the Env argument in php.js
    setMessageListener(handler) {
        window.addEventListener(
            'message',
            (event) =>
                handler(event, (response) =>
                    event.source.postMessage(response, '*')
                ),
            false
        );
    },
    postMessageToParent(message) {
        window.parent.postMessage(message, '*');
    }
}

export const webWorkerEnvironment = {
    name: 'WORKER', // Matches the Env argument in php.js
    setMessageListener(handler) {
        onmessage = (event) => {
            handler(event, postMessage);
        };
    },
    postMessageToParent(message) {
        postMessage(message);
    }
}

/**
 * @returns 
 */
const currentEnvironment = (function () {
    /* eslint-disable no-undef */
    if (typeof window !== 'undefined') {
        return webEnvironment;
    } else if (typeof WorkerGlobalScope !== 'undefined' &&
        self instanceof WorkerGlobalScope) {
        return webWorkerEnvironment;
    } else {
        throw new Error(`Unsupported environment`);
    }
    /* eslint-enable no-undef */
})();

export default currentEnvironment;
