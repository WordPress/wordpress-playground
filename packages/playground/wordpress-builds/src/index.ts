export { getWordPressModuleDetails } from './wordpress/get-wordpress-module-details';
export { getWordPressModule } from './wordpress/get-wordpress-module';
export {
	getSqliteDriverModule,
	LatestSqliteDriverVersion,
} from './sqlite-database-integration/get-sqlite-driver-module';
export { getSqliteDriverModuleDetails } from './sqlite-database-integration/get-sqlite-driver-module-details';
import MinifiedWordPressVersions from './wordpress/wp-versions.json';

export { MinifiedWordPressVersions };
export const MinifiedWordPressVersionsList = Object.keys(
	MinifiedWordPressVersions
) as any as string[];
export const LatestMinifiedWordPressVersion =
	MinifiedWordPressVersionsList.filter((v) => v.match(/^\d/))[0] as string;

export function wpVersionToStaticAssetsDirectory(
	wpVersion: string
): string | undefined {
	return wpVersion in MinifiedWordPressVersions
		? `wp-${wpVersion}`
		: undefined;
}
