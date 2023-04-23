export {
	zipEntireSite,
	exportWXR,
	exportWXZ,
	replaceSite,
	submitImporterForm,
} from './import-export';
export { login } from './login';
export { installTheme } from './install-theme';
export type { InstallThemeOptions } from './install-theme';
export { installPlugin } from './install-plugin';
export type { InstallPluginOptions } from './install-plugin';
export { activatePlugin } from './activate-plugin';
export { setSiteOptions, updateUserMeta } from './site-data';
export { defineSiteUrl } from './define-site-url';
export { applyWordPressPatches } from './apply-wordpress-patches';
export {
	runWpInstallationWizard,
	WordPressInstallationOptions,
} from './run-wp-installation-wizard';

import { PHPRequest, PHPRunOptions } from '@php-wasm/universal';
import { InstallPluginOptions } from './install-plugin';
import { InstallThemeOptions } from './install-theme';
import { WordPressInstallationOptions } from './run-wp-installation-wizard';
import { SiteOptions, UserMeta } from './site-data';

export type Step<ResourceType> = (
	| {
			step: 'installPlugin';
			pluginZipFile: ResourceType;
			options?: InstallPluginOptions;
	  }
	| {
			step: 'installTheme';
			themeZipFile: ResourceType;
			options?: InstallThemeOptions;
	  }
	| {
			step: 'login';
			username?: string;
			password?: string;
	  }
	| {
			step: 'importFile';
			file: ResourceType;
	  }
	| {
			step: 'activatePlugin';
			plugin: string;
	  }
	| {
			step: 'replaceSite';
			fullSiteZip: ResourceType;
	  }
	| {
			step: 'unzip';
			zipPath: string;
			extractToPath: string;
	  }
	| {
			step: 'defineSiteUrl';
			siteUrl: string;
	  }
	| {
			step: 'applyWordPressPatches';
			wordpressPath: string;
	  }
	| {
			step: 'runWpInstallationWizard';
			options: WordPressInstallationOptions;
	  }
	| {
			step: 'setSiteOptions';
			options: SiteOptions;
	  }
	| {
			step: 'updateUserMeta';
			meta: UserMeta;
			userId: number;
	  }
	| {
			step: 'runPHP';
			code: string;
	  }
	| {
			step: 'runPHPWithOptions';
			options: PHPRunOptions;
	  }
	| {
			step: 'setPhpIniEntry';
			key: string;
			value: string;
	  }
	| {
			step: 'request';
			request: PHPRequest;
	  }
	| {
			step: 'cp';
			fromPath: string;
			toPath: string;
	  }
	| {
			step: 'mv';
			fromPath: string;
			toPath: string;
	  }
	| {
			step: 'mkdir';
			path: string;
	  }
	| {
			step: 'rm';
			path: string;
	  }
	| {
			step: 'rmdir';
			path: string;
	  }
	| {
			step: 'fetch';
			url: string;
			path: string;
	  }
	| {
			step: 'writeFile';
			path: string;
			data: ResourceType | string | Uint8Array;
	  }
) & {
	progress?: {
		weight?: number;
		caption?: string;
	};
};
