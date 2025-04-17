import type { ProgressTracker } from '@php-wasm/progress';
import type { UniversalPHP } from '@php-wasm/universal';
import type {
	FileReference,
	DirectoryReference,
	Directory,
} from '../resources';
import type { ActivatePluginStep } from './activate-plugin';
import type { DefineSiteUrlStep } from './define-site-url';
import type { InstallPluginStep, InstallPluginOptions } from './install-plugin';
import type { InstallThemeStep, InstallThemeOptions } from './install-theme';
import type { LoginStep } from './login';
import type {
	RunWpInstallationWizardStep,
	WordPressInstallationOptions,
} from './run-wp-installation-wizard';
import type { SetSiteOptionsStep, UpdateUserMetaStep } from './site-data';
import type { RmStep } from './rm';
import type { CpStep } from './cp';
import type { RmdirStep } from './rmdir';
import type { RunSqlStep } from './run-sql';
import type { MkdirStep } from './mkdir';
import type { MvStep } from './mv';
import type { RunPHPStep } from './run-php';
import type { RunPHPWithOptionsStep } from './run-php-with-options';
import type { RequestStep } from './request';
import type { WriteFileStep } from './write-file';
import type { WriteFilesStep } from './write-files';
import type { DefineWpConfigConstsStep } from './define-wp-config-consts';
import type { ActivateThemeStep } from './activate-theme';
import type { UnzipStep } from './unzip';
import type { ImportWordPressFilesStep } from './import-wordpress-files';
import type { ImportThemeStarterContentStep } from './import-theme-starter-content';
import type { ImportWxrStep } from './import-wxr';
import type { EnableMultisiteStep } from './enable-multisite';
import type { WPCLIStep } from './wp-cli';
import type { ResetDataStep } from './reset-data';
import type { SetSiteLanguageStep } from './set-site-language';

export type Step = GenericStep<FileReference, DirectoryReference>;
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
export type GenericStep<FileResource, DirectoryResource> =
	| ActivatePluginStep
	| ActivateThemeStep
	| CpStep
	| DefineWpConfigConstsStep
	| DefineSiteUrlStep
	| EnableMultisiteStep
	| ImportWxrStep<FileResource>
	| ImportThemeStarterContentStep
	| ImportWordPressFilesStep<FileResource>
	| InstallPluginStep<FileResource, DirectoryResource>
	| InstallThemeStep<FileResource, DirectoryResource>
	| LoginStep
	| MkdirStep
	| MvStep
	| ResetDataStep
	| RequestStep
	| RmStep
	| RmdirStep
	| RunPHPStep
	| RunPHPWithOptionsStep
	| RunWpInstallationWizardStep
	| RunSqlStep<FileResource>
	| SetSiteOptionsStep
	| UnzipStep<FileResource>
	| UpdateUserMetaStep
	| WriteFileStep<FileResource>
	| WriteFilesStep<DirectoryResource>
	| WPCLIStep
	| SetSiteLanguageStep;

export type {
	ActivatePluginStep,
	ActivateThemeStep,
	CpStep,
	DefineWpConfigConstsStep,
	DefineSiteUrlStep,
	EnableMultisiteStep,
	ImportWxrStep,
	ImportThemeStarterContentStep,
	ImportWordPressFilesStep,
	InstallPluginStep,
	InstallPluginOptions,
	InstallThemeStep,
	InstallThemeOptions,
	LoginStep,
	MkdirStep,
	MvStep,
	ResetDataStep,
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
	WriteFilesStep,
	WPCLIStep,
	SetSiteLanguageStep,
};

/**
 * Progress reporting details.
 */
export type StepProgress = {
	tracker: ProgressTracker;
	initialCaption?: string;
};

export type StepHandler<
	S extends GenericStep<File, Directory>,
	Return = any
> = (
	/**
	 * A PHP instance or Playground client.
	 */
	php: UniversalPHP,
	args: Omit<S, 'step'>,
	progressArgs?: StepProgress
) => Return;
