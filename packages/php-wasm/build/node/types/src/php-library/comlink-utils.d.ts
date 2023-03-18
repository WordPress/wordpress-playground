export declare function consumeAPI<APIType>(remote: Worker | Window): any;
type PublicAPI<Methods, PipedAPI> = Methods & PipedAPI & {
    isReady: () => Promise<void>;
};
export declare function exposeAPI<Methods, PipedAPI>(apiMethods?: Methods, pipedApi?: PipedAPI): [
    () => void,
    PublicAPI<Methods, PipedAPI>
];
export {};
