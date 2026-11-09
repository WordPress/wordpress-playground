import type * as Client from './client.js' with { 'resolution-mode': 'import' };

export type * from './client.js' with { 'resolution-mode': 'import' };

export declare const startMcpBridge: typeof Client.startMcpBridge;
export declare const registerWebMCPTools: typeof Client.registerWebMCPTools;
export declare const unregisterWebMCPTools: typeof Client.unregisterWebMCPTools;
export declare const getModelContext: typeof Client.getModelContext;
export declare const startWebMCPSiteToolProxy: typeof Client.startWebMCPSiteToolProxy;
