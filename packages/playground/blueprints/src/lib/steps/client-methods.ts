import { PHPRunOptions, PHPRequest } from '@php-wasm/universal';
import { BaseStep } from '.';

export interface RunPHPStep extends BaseStep {
	step: 'runPHP';
	code: string;
}

export interface RunPHPWithOptionsStep extends BaseStep {
	step: 'runPHPWithOptions';
	options: PHPRunOptions;
}

export interface SetPhpIniEntryStep extends BaseStep {
	step: 'setPhpIniEntry';
	key: string;
	value: string;
}

export interface RequestStep extends BaseStep {
	step: 'request';
	request: PHPRequest;
}

export interface CpStep extends BaseStep {
	step: 'cp';
	fromPath: string;
	toPath: string;
}

export interface MvStep extends BaseStep {
	step: 'mv';
	fromPath: string;
	toPath: string;
}

export interface MkdirStep extends BaseStep {
	step: 'mkdir';
	path: string;
}

export interface RmStep extends BaseStep {
	step: 'rm';
	path: string;
}

export interface RmdirStep extends BaseStep {
	step: 'rmdir';
	path: string;
}

export interface WriteFileStep<ResourceType> extends BaseStep {
	step: 'writeFile';
	path: string;
	data: ResourceType | string | Uint8Array;
}
