export { getWordPressModuleDetails } from './wordpress/get-wordpress-module-details';
export { getWordPressModule } from './wordpress/get-wordpress-module';
export * as sqliteDatabaseIntegrationModuleDetails from './sqlite-database-integration/get-sqlite-database-plugin-details';
export { getSqliteDatabaseModule } from './sqlite-database-integration/get-sqlite-database-module';
import SupportedWordPressVersions from './wordpress/wp-versions.json';

export { SupportedWordPressVersions };
export const SupportedWordPressVersionsList = Object.keys(
	SupportedWordPressVersions
) as any as string[];
export const LatestSupportedWordPressVersion =
	SupportedWordPressVersionsList.filter((v) => v.match(/^\d/))[0] as string;
