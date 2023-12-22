import { UniversalPHP } from '@php-wasm/universal';
// @ts-ignore
import zipFunctions from './zip-functions.php?raw';
export async function runPhpWithZipFunctions(
	playground: UniversalPHP,
	code: string
) {
	const result = await playground.run({
		code: zipFunctions + code,
	});
	if (result.exitCode !== 0) {
		console.log(zipFunctions + code);
		console.log(code + '');
		console.log(result.errors);
		throw result.errors;
	}
	return result;
}
