import { ProgressTracker } from '@php-wasm/progress';
import { UniversalPHP } from '@php-wasm/universal';
import { FileReference } from '../resources';
import { ActivatePluginStep } from './activate-plugin';
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
import { RunSqlStep } from './run-sql';
import { MkdirStep } from './mkdir';
import { MvStep } from './mv';
import { RunPHPStep } from './run-php';
import { RunPHPWithOptionsStep } from './run-php-with-options';
import { RequestStep } from './request';
import { WriteFileStep } from './write-file';
import { DefineWpConfigConstsStep } from './define-wp-config-consts';
import { ActivateThemeStep } from './activate-theme';
import { UnzipStep } from './unzip';
import { ImportWordPressFilesStep } from './import-wordpress-files';
import { ImportWxrStep } from './import-wxr';
import { EnableMultisiteStep } from './enable-multisite';
import { WPCLIStep } from './wp-cli';

export type Step = GenericStep<FileReference>;
export type StepDefinition = Step & {
	progress?: {
		weight?: number;
		caption?: string;
	};
};

export { wpContentFilesExcludedFromExport } from '../utils/wp-content-files-excluded-from-exports';

/**
 * If you add a step here, make sure to also
 * add it to the exports below.
 */
export type GenericStep<Resource> =
	| ActivatePluginStep
	| ActivateThemeStep
	| CpStep
	| DefineWpConfigConstsStep
	| DefineSiteUrlStep
	| EnableMultisiteStep
	| ImportWxrStep<Resource>
	| ImportWordPressFilesStep<Resource>
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
	| RunSqlStep<Resource>
	| SetSiteOptionsStep
	| UnzipStep<Resource>
	| UpdateUserMetaStep
	| WriteFileStep<Resource>
	| WPCLIStep;

export type {
	ActivatePluginStep,
	ActivateThemeStep,
	CpStep,
	DefineWpConfigConstsStep,
	DefineSiteUrlStep,
	EnableMultisiteStep,
	ImportWxrStep,
	ImportWordPressFilesStep,
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
	RunSqlStep,
	WordPressInstallationOptions,
	SetSiteOptionsStep,
	UnzipStep,
	UpdateUserMetaStep,
	WriteFileStep,
	WPCLIStep,
};

/**
 * Progress reporting details.
 */
export type StepProgress = {
	tracker: ProgressTracker;
	initialCaption?: string;
};

export type StepHandler<S extends GenericStep<File>, Return = any> = (
	/**
	 * A PHP instance or Playground client.
	 */
	php: UniversalPHP,
	args: Omit<S, 'step'>,
	progressArgs?: StepProgress
) => Return;
