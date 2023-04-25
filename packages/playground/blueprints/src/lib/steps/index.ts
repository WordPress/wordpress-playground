import { ProgressTracker } from '@php-wasm/progress';
import { UniversalPHP } from '@php-wasm/universal';
import { FileReference } from '../resources';
import { ActivatePluginStep } from './activate-plugin';
import { ApplyWordPressPatchesStep } from './apply-wordpress-patches';
import { DefineSiteUrlStep } from './define-site-url';
import { ImportFileStep, ReplaceSiteStep, UnzipStep } from './import-export';
import { InstallPluginStep } from './install-plugin';
import { InstallThemeStep } from './install-theme';
import { LoginStep } from './login';
import { RunWpInstallationWizardStep } from './run-wp-installation-wizard';
import { SetSiteOptionsStep, UpdateUserMetaStep } from './site-data';
import {
	RmStep,
	CpStep,
	MkdirStep,
	RmdirStep,
	MvStep,
	SetPhpIniEntryStep,
	RunPHPStep,
	RunPHPWithOptionsStep,
	RequestStep,
	WriteFileStep,
} from './client-methods';

export type Step = GenericStep<FileReference>;
export type StepDefinition = Step & {
	progress?: {
		weight?: number;
		caption?: string;
	};
};

export type GenericStep<Resource> =
	| ActivatePluginStep
	| ApplyWordPressPatchesStep
	| CpStep
	| DefineSiteUrlStep
	| ImportFileStep<Resource>
	| InstallPluginStep<Resource>
	| InstallThemeStep<Resource>
	| LoginStep
	| MkdirStep
	| MvStep
	| RequestStep
	| ReplaceSiteStep<Resource>
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

export type StepHandler<S extends GenericStep<File>> = (
	php: UniversalPHP,
	args: Omit<S, 'step'>,
	progressArgs?: {
		tracker: ProgressTracker;
		initialCaption?: string;
	}
) => Promise<void> | void;
