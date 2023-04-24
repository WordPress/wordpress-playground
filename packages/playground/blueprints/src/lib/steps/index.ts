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
export type { SiteOptions, UserMeta } from './site-data';
export { defineSiteUrl } from './define-site-url';
export { applyWordPressPatches } from './apply-wordpress-patches';
export type { PatchOptions } from './apply-wordpress-patches';
export { runWpInstallationWizard } from './run-wp-installation-wizard';
export type { WordPressInstallationOptions } from './run-wp-installation-wizard';

import { ActivatePluginStep } from './activate-plugin';
import { ApplyWordPressPatchesStep } from './apply-wordpress-patches';
import {
	RunPHPStep,
	RunPHPWithOptionsStep,
	SetPhpIniEntryStep,
	RequestStep,
	CpStep,
	RmStep,
	RmdirStep,
	MvStep,
	MkdirStep,
	WriteFileStep,
} from './client-methods';
import { DefineSiteUrlStep } from './define-site-url';
import { ImportFileStep, ReplaceSiteStep, UnzipStep } from './import-export';
import { InstallPluginStep } from './install-plugin';
import { InstallThemeStep } from './install-theme';
import { LoginStep } from './login';
import { RunWpInstallationWizardStep } from './run-wp-installation-wizard';
import { SetSiteOptionsStep, UpdateUserMetaStep } from './site-data';
export interface BaseStep {
	step: string;
	progress?: {
		weight?: number;
		caption?: string;
	};
}

export type Step<ResourceType> =
	| InstallPluginStep<ResourceType>
	| InstallThemeStep<ResourceType>
	| LoginStep
	| ImportFileStep<ResourceType>
	| ActivatePluginStep
	| ReplaceSiteStep<ResourceType>
	| UnzipStep
	| DefineSiteUrlStep
	| ApplyWordPressPatchesStep
	| RunWpInstallationWizardStep
	| SetSiteOptionsStep
	| UpdateUserMetaStep
	| RunPHPStep
	| RunPHPWithOptionsStep
	| SetPhpIniEntryStep
	| RequestStep
	| CpStep
	| RmStep
	| RmdirStep
	| MvStep
	| MkdirStep
	| WriteFileStep<ResourceType>;

export type {
	InstallPluginStep,
	InstallThemeStep,
	LoginStep,
	ImportFileStep,
	ActivatePluginStep,
	ReplaceSiteStep,
	UnzipStep,
	DefineSiteUrlStep,
	ApplyWordPressPatchesStep,
	RunWpInstallationWizardStep,
	SetSiteOptionsStep,
	UpdateUserMetaStep,
	RunPHPStep,
	RunPHPWithOptionsStep,
	SetPhpIniEntryStep,
	RequestStep,
	CpStep,
	RmStep,
	RmdirStep,
	MvStep,
	MkdirStep,
	WriteFileStep,
};
