export const viteWasmLoader = {
	load(id: string): any {
		if (id.endsWith('.wasm')) {
			return `export default ${JSON.stringify(id)}`;
		}
	},
} as any;
