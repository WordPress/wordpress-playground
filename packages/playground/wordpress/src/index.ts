export * from './wordpress/get-wordpress-module';
import { getWordPressModule } from './wordpress/get-wordpress-module';
import SupportedWordPressVersions from './wordpress/wp-versions.json';

export { SupportedWordPressVersions };
export const SupportedWordPressVersionsList = Object.keys(
	SupportedWordPressVersions
) as any as string[];
export const LatestSupportedWordPressVersion =
	SupportedWordPressVersionsList.filter((v) => v.match(/^\d/))[0] as string;

export async function getWordPressModuleInNode(version?: string) {
	const module = await getWordPressModule(version);
	const wpDataModulePath = module.dependencyFilename.replace(/^\/@fs/, '');
	const { readFileSync } = await import('node:fs');
	const wpData = readFileSync(wpDataModulePath);
	const wpDataArrayBuffer = wpData.buffer.slice(
		wpData.byteOffset,
		wpData.byteOffset + wpData.byteLength
	);
	return {
		...module,
		default: function (PHPModule: any) {
			return module.default({
				...(PHPModule || {}),
				getPreloadedPackage() {
					return wpDataArrayBuffer;
				},
			});
		},
	};
}
