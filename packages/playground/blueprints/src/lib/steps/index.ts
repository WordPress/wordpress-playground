import { ProgressTracker } from '@php-wasm/progress';
import { UniversalPHP } from '@php-wasm/universal';
import { FileReference } from '../resources';
import { activatePlugin, ActivatePluginArgs } from './activate-plugin';
import {
	applyWordPressPatches,
	ApplyWordPressPatchesArgs,
} from './apply-wordpress-patches';
import {
	rm,
	cp,
	mkdir,
	rmdir,
	mv,
	setPhpIniEntry,
	runPHP,
	runPHPWithOptions,
	request,
	RequestArgs,
	CpArgs,
	MkdirArgs,
	MvArgs,
	RmArgs,
	RmdirArgs,
	RunPHPArgs,
	RunPHPWithOptionsArgs,
	SetPhpIniEntryArgs,
} from './client-methods';
import { defineSiteUrl, DefineSiteUrlArgs } from './define-site-url';
import {
	importFile,
	unzip,
	replaceSite,
	ImportFileArgs,
	ReplaceSiteArgs,
	UnzipArgs,
} from './import-export';
import { installPlugin, InstallPluginArgs } from './install-plugin';
import { installTheme, InstallThemeArgs } from './install-theme';
import { login, LoginArgs } from './login';
import {
	runWpInstallationWizard,
	RunWpInstallationWizardArgs,
} from './run-wp-installation-wizard';
import {
	setSiteOptions,
	SetSiteOptionsArgs,
	updateUserMeta,
	UpdateUserMetaArgs,
} from './site-data';

export { zipEntireSite } from './import-export';

export type StepDefinition =
	| _StepDefinition<'setSiteOptions', SetSiteOptionsArgs>
	| _StepDefinition<'updateUserMeta', UpdateUserMetaArgs>
	| _StepDefinition<'login', LoginArgs>
	| _StepDefinition<'activatePlugin', ActivatePluginArgs>
	| _StepDefinition<'installPlugin', InstallPluginArgs<FileReference>>
	| _StepDefinition<'installTheme', InstallThemeArgs<FileReference>>
	| _StepDefinition<'importFile', ImportFileArgs<FileReference>>
	| _StepDefinition<'unzip', UnzipArgs>
	| _StepDefinition<'replaceSite', ReplaceSiteArgs<FileReference>>
	| _StepDefinition<'applyWordPressPatches', ApplyWordPressPatchesArgs>
	| _StepDefinition<'runWpInstallationWizard', RunWpInstallationWizardArgs>
	| _StepDefinition<'defineSiteUrl', DefineSiteUrlArgs>
	| _StepDefinition<'rm', RmArgs>
	| _StepDefinition<'cp', CpArgs>
	| _StepDefinition<'mkdir', MkdirArgs>
	| _StepDefinition<'rmdir', RmdirArgs>
	| _StepDefinition<'mv', MvArgs>
	| _StepDefinition<'setPhpIniEntry', SetPhpIniEntryArgs>
	| _StepDefinition<'runPHP', RunPHPArgs>
	| _StepDefinition<'runPHPWithOptions', RunPHPWithOptionsArgs>
	| _StepDefinition<'request', RequestArgs>;

export type _StepDefinition<Name, Args> = {
	step: Name;
	progress?: {
		weight?: number;
		caption?: string;
	};
} & Args;

export type ProgressArgs = {
	tracker: ProgressTracker;
	initialCaption?: string;
};

export const stepHandlers = {
	setSiteOptions,
	updateUserMeta,
	login,
	activatePlugin,
	installPlugin,
	installTheme,
	importFile,
	unzip,
	replaceSite,
	applyWordPressPatches,
	runWpInstallationWizard,
	defineSiteUrl,
	rm,
	cp,
	mkdir,
	rmdir,
	mv,
	setPhpIniEntry,
	runPHP,
	runPHPWithOptions,
	request,
} as const;

export {
	setSiteOptions,
	updateUserMeta,
	login,
	activatePlugin,
	installPlugin,
	installTheme,
	importFile,
	unzip,
	replaceSite,
	applyWordPressPatches,
	runWpInstallationWizard,
	defineSiteUrl,
	rm,
	cp,
	mkdir,
	rmdir,
	mv,
	setPhpIniEntry,
	runPHP,
	runPHPWithOptions,
	request,
};

export type StepHandler<Args> = (
	php: UniversalPHP,
	args: Args,
	progressArgs?: ProgressArgs
) => Promise<void> | void;
