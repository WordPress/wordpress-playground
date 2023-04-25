import { PHPRunOptions, PHPRequest } from '@php-wasm/universal';
import { StepHandler } from '.';

export interface RunPHPArgs {
	code: string;
}

export const runPHP: StepHandler<RunPHPArgs> = async (playground, { code }) => {
	await playground.run({ code });
};

export interface RunPHPWithOptionsArgs {
	options: PHPRunOptions;
}

export const runPHPWithOptions: StepHandler<RunPHPWithOptionsArgs> = async (
	playground,
	{ options }
) => {
	await playground.run(options);
};

export interface SetPhpIniEntryArgs {
	key: string;
	value: string;
}

export const setPhpIniEntry: StepHandler<SetPhpIniEntryArgs> = async (
	playground,
	{ key, value }
) => {
	await playground.setPhpIniEntry(key, value);
};

export interface RequestArgs {
	request: PHPRequest;
}

export const request: StepHandler<RequestArgs> = async (
	playground,
	{ request }
) => {
	await playground.request(request);
};

export interface CpArgs {
	fromPath: string;
	toPath: string;
}

export const cp: StepHandler<CpArgs> = async (
	playground,
	{ fromPath, toPath }
) => {
	await playground.writeFile(
		toPath,
		await playground.readFileAsBuffer(fromPath)
	);
};

export interface MvArgs {
	fromPath: string;
	toPath: string;
}

export const mv: StepHandler<MvArgs> = async (
	playground,
	{ fromPath, toPath }
) => {
	await playground.mv(fromPath, toPath);
};

export interface MkdirArgs {
	path: string;
}

export const mkdir: StepHandler<MkdirArgs> = async (playground, { path }) => {
	await playground.mkdir(path);
};

export interface RmArgs {
	path: string;
}

export const rm: StepHandler<RmArgs> = async (playground, { path }) => {
	await playground.unlink(path);
};

export interface RmdirArgs {
	path: string;
}

export const rmdir: StepHandler<RmdirArgs> = async (playground, { path }) => {
	await playground.rmdir(path);
};

export interface WriteFileArgs<ResourceType> {
	path: string;
	data: ResourceType | string | Uint8Array;
}

export const writeFile: StepHandler<WriteFileArgs<any>> = async (
	playground,
	{ path, data }
) => {
	await playground.writeFile(path, data);
};
