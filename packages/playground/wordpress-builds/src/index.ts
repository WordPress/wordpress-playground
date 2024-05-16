export { getWordPressModuleDetails } from './wordpress/get-wordpress-module-details';
export { getWordPressModule } from './wordpress/get-wordpress-module';
import SupportedWordPressVersions from './wordpress/wp-versions.json';

export { SupportedWordPressVersions };
export const SupportedWordPressVersionsList = Object.keys(
	SupportedWordPressVersions
) as any as string[];
export const LatestSupportedWordPressVersion =
	SupportedWordPressVersionsList.filter((v) => v.match(/^\d/))[0] as string;

// @ts-ignore
import sqliteIntegrationUrl from './wordpress/sqlite-database-integration.zip?url';
export { sqliteIntegrationUrl };
