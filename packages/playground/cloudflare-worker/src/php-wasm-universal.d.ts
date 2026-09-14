declare module '@php-wasm/universal/php' {
	export class PHP {
		constructor(runtimeId: number);
		run(request: { code: string }): Promise<{ text: string }>;
	}
}

declare module '@php-wasm/universal/load-php-runtime' {
	export function loadPHPRuntime(
		loader: {
			dependencyFilename: string;
			dependenciesTotalSize: number;
			phpWasmAsyncMode: 'asyncify';
			init: unknown;
		},
		options: { instantiateWasm: unknown }
	): Promise<number>;
}
