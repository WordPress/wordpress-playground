import * as Comlink from 'comlink';

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
