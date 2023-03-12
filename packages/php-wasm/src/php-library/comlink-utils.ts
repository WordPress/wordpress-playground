import * as Comlink from 'comlink';

export function consumeAPI(endpoint: any=null) {
    setupTransferHandlers();

    if (!(endpoint instanceof Worker)) {
        endpoint = Comlink.windowEndpoint(endpoint);
    }

    return Comlink.wrap<any>(endpoint);
}

export function exposeAPI(apiMethods: any=null) {
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
        methods: proxyClone(apiMethods)
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

function setupTransferHandlers() {
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
    Comlink.transferHandlers.set("FUNCTION", {
        canHandle: obj => typeof obj === "function",
        serialize(obj) {
          console.debug("[Comlink][Performance] Proxying a function")
          const { port1, port2 } = new MessageChannel();
          Comlink.expose(obj, port1);
          return [port2, [port2]];
        },
        deserialize(port) {
          port.start();
          return Comlink.wrap(port);
        }
      });
}

function proxyClone(object: any) {
	return new Proxy(object, {
		get(target, prop) {
			switch(typeof target[prop]) {
				case 'function':
					return (...args) => target[prop](...args);
				case 'object':
					if (target[prop] === null) {
						return target[prop];
					}
					return proxyClone(target[prop]);
				case 'undefined':
				case 'number':
				case 'string':
					return target[prop];
				default:
					return Comlink.proxy(target[prop]);
			}
		},
	});
}
