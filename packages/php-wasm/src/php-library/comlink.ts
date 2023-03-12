import * as Comlink from 'comlink';

export function exposeComlinkAPI(apiMethods: any=null) {
    setupTransferHandlers();
    
    let setReady;
    const ready = new Promise((resolve) => {
        setReady = resolve;
    });

    const datasource: any = {
        root: {
            isReady: () => ready,
        },
        baseApi: {},
        methods: apiMethods
    };
    const exposedApi = new Proxy(datasource, {
        get: (target, prop) => {
            if (prop === 'isReady') {
                return () => ready;
            }
            if (prop in target.methods) {
                return target.methods[prop];
            }
            return target.baseApi![prop];
        }
    });

    Comlink.expose(
        exposedApi,
        typeof window !== 'undefined' ? Comlink.windowEndpoint(self.parent) : undefined
    );
    return {
        exposedApi,
        setReady,
        pipe: (baseApi: any) => {
            datasource.baseApi = baseApi;
        }
    }
}

export function setupTransferHandlers() {
    Comlink.transferHandlers.set('EVENT', {
        canHandle: ((obj) => obj instanceof CustomEvent) as any,
        serialize: (ev: CustomEvent) => {
            return [
                {
                    detail: ev.detail,
                },
                [],
            ];
        },
        deserialize: (obj) => obj,
    });
}
