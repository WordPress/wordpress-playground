export const phpNextVersion = "8.6.0-dev";
export const phpNextRef = "master";
const availableModes = ["jspi","asyncify"];
function selectMode(asyncMode) {
	if (availableModes.includes(asyncMode)) {
		return asyncMode;
	}
	throw new Error(`PHP next build mode ${asyncMode} is not available.`);
}
export async function getPHPLoaderModule(asyncMode = 'asyncify') {
	const mode = selectMode(asyncMode);
	return mode === 'jspi'
		? await import('./jspi/php_8_6.js')
		: await import('./asyncify/php_8_6.js');
}
