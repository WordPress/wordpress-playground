declare module '*?url' {
	const url: string;
	export default url;
}

declare module '*?raw' {
	const text: string;
	export default text;
}

declare module '*?worker&url' {
	const url: string;
	export default url;
}

declare module '@kandelo/*' {
	export const BrowserKernel: any;
	export type BrowserKernel = any;
	export const HttpBridgeHost: any;
	export type HttpBridgeHost = any;
	export const KandeloImageFs: any;
	export type KandeloImageFs = any;
	export interface HttpRequest {
		method: string;
		url: string;
		headers: Record<string, string>;
		body: Uint8Array | null;
	}
	export interface HttpResponse {
		status: number;
		headers: Record<string, string>;
		body: Uint8Array;
	}
	export const writeVfsFile: any;
	export const writeVfsBinary: any;
	export const ensureDir: any;
	export const ensureDirRecursive: any;
	export const symlink: any;
}
