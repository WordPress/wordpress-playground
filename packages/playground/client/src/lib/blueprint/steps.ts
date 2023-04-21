import { InstallPluginOptions } from '../install-plugin';
import { InstallThemeOptions } from '../install-theme';
import { PHPRequest, PHPRunOptions } from '../..';
import { SiteOptions, UserMeta } from '../site-data';

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
			options?: PHPRunOptions;
	  }
	| {
			step: 'setPhpIniEntry';
			key: string;
			value: string;
	  }
	| {
			step: 'request';
			request: PHPRequest;
			maxRedirects?: number;
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
