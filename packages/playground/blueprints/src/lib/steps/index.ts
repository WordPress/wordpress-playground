import { ProgressTracker } from '@php-wasm/progress';
import { UniversalPHP } from '@php-wasm/universal';
import { FileReference } from '../resources';
import { ActivatePluginStep } from './activate-plugin';
import { ApplyWordPressPatchesStep } from './apply-wordpress-patches';
import { DefineSiteUrlStep } from './define-site-url';
import { InstallPluginStep, InstallPluginOptions } from './install-plugin';
import { InstallThemeStep, InstallThemeOptions } from './install-theme';
import { LoginStep } from './login';
import {
	RunWpInstallationWizardStep,
	WordPressInstallationOptions,
} from './run-wp-installation-wizard';
import { SetSiteOptionsStep, UpdateUserMetaStep } from './site-data';
import { RmStep } from './rm';
import { CpStep } from './cp';
import { RmdirStep } from './rmdir';
import { MkdirStep } from './mkdir';
import { MvStep } from './mv';
import { SetPhpIniEntryStep } from './set-php-ini-entry';
import { RunPHPStep } from './run-php';
import { RunPHPWithOptionsStep } from './run-php-with-options';
import { RequestStep } from './request';
import { WriteFileStep } from './write-file';
import { DefineWpConfigConstsStep } from './define-wp-config-consts';
import { ActivateThemeStep } from './activate-theme';
import { ImportFileStep } from './import-file';
import { UnzipStep } from './unzip';
import { ImportWpContentStep } from './import-wp-content';

export type Step = GenericStep<FileReference>;
export type StepDefinition = Step & {
	progress?: {
		weight?: number;
		caption?: string;
	};
};

/**
 * If you add a step here, make sure to also
 * add it to the exports below.
 */
export type GenericStep<Resource> =
	| ActivatePluginStep
	| ActivateThemeStep
	| ApplyWordPressPatchesStep
	| CpStep
	| DefineWpConfigConstsStep
	| DefineSiteUrlStep
	| ImportFileStep<Resource>
	| ImportWpContentStep<Resource>
	| InstallPluginStep<Resource>
	| InstallThemeStep<Resource>
	| LoginStep
	| MkdirStep
	| MvStep
	| RequestStep
	| RmStep
	| RmdirStep
	| RunPHPStep
	| RunPHPWithOptionsStep
	| RunWpInstallationWizardStep
	| SetPhpIniEntryStep
	| SetSiteOptionsStep
	| UnzipStep
	| UpdateUserMetaStep
	| WriteFileStep<Resource>;

export type {
	ActivatePluginStep,
	ActivateThemeStep,
	ApplyWordPressPatchesStep,
	CpStep,
	DefineWpConfigConstsStep,
	DefineSiteUrlStep,
	ImportFileStep,
	ImportWpContentStep,
	InstallPluginStep,
	InstallPluginOptions,
	InstallThemeStep,
	InstallThemeOptions,
	LoginStep,
	MkdirStep,
	MvStep,
	RequestStep,
	RmStep,
	RmdirStep,
	RunPHPStep,
	RunPHPWithOptionsStep,
	RunWpInstallationWizardStep,
	WordPressInstallationOptions,
	SetPhpIniEntryStep,
	SetSiteOptionsStep,
	UnzipStep,
	UpdateUserMetaStep,
	WriteFileStep,
};

/**
 * Progress reporting details.
 */
export type StepProgress = {
	tracker: ProgressTracker;
	initialCaption?: string;
};

export type StepHandler<S extends GenericStep<File>> = (
	/**
	 * A PHP instance or Playground client.
	 */
	php: UniversalPHP,
	args: Omit<S, 'step'>,
	progressArgs?: StepProgress
) => any;
