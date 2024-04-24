import { UniversalPHP } from '@php-wasm/universal';
// @ts-ignore
import zipFunctionsFile from './zip-functions.php';
const zipFunctions = await Bun.file(zipFunctionsFile).text();
export async function runPhpWithZipFunctions(
	playground: UniversalPHP,
	code: string
) {
	return await playground.run({
		code: zipFunctions + code,
	});
}
