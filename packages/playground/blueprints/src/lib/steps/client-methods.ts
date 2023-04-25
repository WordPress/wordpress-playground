import { PHPRunOptions, PHPRequest } from '@php-wasm/universal';
import { StepHandler } from '.';
import { fileToUint8Array } from './common';

export interface RunPHPStep {
	step: 'runPHP';
	code: string;
}

export const runPHP: StepHandler<RunPHPStep> = async (playground, { code }) => {
	return await playground.run({ code });
};

export interface RunPHPWithOptionsStep {
	step: 'runPHPWithOptions';
	options: PHPRunOptions;
}

export const runPHPWithOptions: StepHandler<RunPHPWithOptionsStep> = async (
	playground,
	{ options }
) => {
	return await playground.run(options);
};

export interface SetPhpIniEntryStep {
	step: 'setPhpIniEntry';
	key: string;
	value: string;
}

export const setPhpIniEntry: StepHandler<SetPhpIniEntryStep> = async (
	playground,
	{ key, value }
) => {
	await playground.setPhpIniEntry(key, value);
};

export interface RequestStep {
	step: 'request';
	request: PHPRequest;
}

export const request: StepHandler<RequestStep> = async (
	playground,
	{ request }
) => {
	return await playground.request(request);
};

export interface CpStep {
	step: 'cp';
	fromPath: string;
	toPath: string;
}

export const cp: StepHandler<CpStep> = async (
	playground,
	{ fromPath, toPath }
) => {
	await playground.writeFile(
		toPath,
		await playground.readFileAsBuffer(fromPath)
	);
};

export interface MvStep {
	step: 'mv';
	fromPath: string;
	toPath: string;
}

export const mv: StepHandler<MvStep> = async (
	playground,
	{ fromPath, toPath }
) => {
	await playground.mv(fromPath, toPath);
};

export interface MkdirStep {
	step: 'mkdir';
	path: string;
}

export const mkdir: StepHandler<MkdirStep> = async (playground, { path }) => {
	await playground.mkdir(path);
};

export interface RmStep {
	step: 'rm';
	path: string;
}

export const rm: StepHandler<RmStep> = async (playground, { path }) => {
	await playground.unlink(path);
};

export interface RmdirStep {
	step: 'rmdir';
	path: string;
}

export const rmdir: StepHandler<RmdirStep> = async (playground, { path }) => {
	await playground.rmdir(path);
};

export interface WriteFileStep<ResourceType> {
	step: 'writeFile';
	path: string;
	data: ResourceType | string | Uint8Array;
}

export const writeFile: StepHandler<WriteFileStep<File>> = async (
	playground,
	{ path, data }
) => {
	if (data instanceof File) {
		data = await fileToUint8Array(data);
	}
	await playground.writeFile(path, data);
};
