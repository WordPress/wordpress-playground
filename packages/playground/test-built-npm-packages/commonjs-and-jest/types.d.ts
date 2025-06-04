declare module '@wp-playground/cli' {
	export function runCLI(options: any): Promise<any>;
}

declare module '@php-wasm/universal' {
	export const SupportedPHPVersions: string[];
}
