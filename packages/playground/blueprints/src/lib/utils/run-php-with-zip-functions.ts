import { UniversalPHP } from '@php-wasm/universal';
// @ts-ignore
import zipFunctions from './zip-functions.php?raw';
export async function runPhpWithZipFunctions(
	playground: UniversalPHP,
	code: string
) {
	return await playground.run({
		throwOnError: true,
		code: zipFunctions + code,
	});
}
