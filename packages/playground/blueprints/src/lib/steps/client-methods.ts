import { PHPRunOptions, PHPRequest } from '@php-wasm/universal';
import { StepHandler } from '.';
import { fileToUint8Array } from './common';

/**
 * @inheritDoc runPHP
 * @hasRunnableExample
 * @example
 *
 * <code>
 * {
 * 		"step": "runPHP",
 * 		"code": "<?php require_once 'wordpress/wp-load.php'; wp_insert_post(array('post_title' => 'wp-load.php required for WP functionality', 'post_status' => 'publish')); ?>"
 * }
 * </code>
 */
export interface RunPHPStep {
	/** The step identifier. */
	step: 'runPHP';
	/** The PHP code to run. */
	code: string;
}

/**
 * Runs PHP code.
 */
export const runPHP: StepHandler<RunPHPStep> = async (playground, { code }) => {
	return await playground.run({ code });
};

/**
 * @inheritDoc runPHP
 * @hasRunnableExample
 * @example
 *
 * <code>
 * {
 * 		"step": "runPHP",
 * 		"options": {
 * 			"code": "<?php echo $_SERVER['CONTENT_TYPE']; ?>",
 * 			"headers": {
 * 				"Content-type": "text/plain"
 * 			}
 * 		}
 * }
 * </code>
 */
export interface RunPHPWithOptionsStep {
	step: 'runPHPWithOptions';
	/**
	 * Run options (See /wordpress-playground/api/universal/interface/PHPRunOptions)
	 */
	options: PHPRunOptions;
}

/**
 * Runs PHP code with the given options.
 */
export const runPHPWithOptions: StepHandler<RunPHPWithOptionsStep> = async (
	playground,
	{ options }
) => {
	return await playground.run(options);
};

/**
 * @inheritDoc setPhpIniEntry
 * @hasRunnableExample
 * @example
 *
 * <code>
 * {
 * 		"step": "setPhpIniEntry",
 * 		"key": "display_errors",
 * 		"value": "1"
 * }
 * </code>
 */
export interface SetPhpIniEntryStep {
	step: 'setPhpIniEntry';
	/** Entry name e.g. "display_errors" */
	key: string;
	/** Entry value as a string e.g. "1" */
	value: string;
}

/**
 * Sets a PHP ini entry.
 */
export const setPhpIniEntry: StepHandler<SetPhpIniEntryStep> = async (
	playground,
	{ key, value }
) => {
	await playground.setPhpIniEntry(key, value);
};

/**
 * @inheritDoc request
 * @needsLogin
 * @hasRunnableExample
 * @example
 *
 * <code>
 * {
 * 		"step": "request",
 * 		"request": {
 * 			"method": "POST",
 * 			"url": "/wp-admin/admin-ajax.php",
 * 			"formData": {
 * 				"action": "my_action",
 * 				"foo": "bar"
 * 			}
 * 		}
 * }
 * </code>
 */
export interface RequestStep {
	step: 'request';
	/**
	 * Request details (See /wordpress-playground/api/universal/interface/PHPRequest)
	 */
	request: PHPRequest;
}

/**
 * Sends a HTTP request to the Playground.
 */
export const request: StepHandler<RequestStep> = async (
	playground,
	{ request }
) => {
	return await playground.request(request);
};

/**
 * @inheritDoc cp
 * @hasRunnableExample
 * @landingPage /index2.php
 * @example
 *
 * <code>
 * {
 * 		"step": "cp",
 * 		"fromPath": "/wordpress/index.php",
 * 		"toPath": "/wordpress/index2.php"
 * }
 * </code>
 */
export interface CpStep {
	step: 'cp';
	/** Source path */
	fromPath: string;
	/** Target path */
	toPath: string;
}

/**
 * Copies a file from one path to another.
 */
export const cp: StepHandler<CpStep> = async (
	playground,
	{ fromPath, toPath }
) => {
	await playground.writeFile(
		toPath,
		await playground.readFileAsBuffer(fromPath)
	);
};

/**
 * @inheritDoc mv
 * @hasRunnableExample
 * @landingPage /index2.php
 * @example
 *
 * <code>
 * {
 * 		"step": "mv",
 * 		"fromPath": "/wordpress/index.php",
 * 		"toPath": "/wordpress/index2.php"
 * }
 * </code>
 */
export interface MvStep {
	step: 'mv';
	/** Source path */
	fromPath: string;
	/** Target path */
	toPath: string;
}

/**
 * Moves a file or directory from one path to another.
 */
export const mv: StepHandler<MvStep> = async (
	playground,
	{ fromPath, toPath }
) => {
	await playground.mv(fromPath, toPath);
};

/**
 * @inheritDoc mkdir
 * @hasRunnableExample
 * @example
 *
 * <code>
 * {
 * 		"step": "mkdir",
 * 		"path": "/wordpress/my-new-folder"
 * }
 * </code>
 */
export interface MkdirStep {
	step: 'mkdir';
	/** The path of the directory you want to create */
	path: string;
}

/**
 * Creates a directory at the specified path.
 */
export const mkdir: StepHandler<MkdirStep> = async (playground, { path }) => {
	await playground.mkdir(path);
};

/**
 * @inheritDoc rm
 * @hasRunnableExample
 * @landingPage /index.php
 * @example
 *
 * <code>
 * {
 * 		"step": "rm",
 * 		"path": "/wordpress/index.php"
 * }
 * </code>
 */
export interface RmStep {
	step: 'rm';
	/** The path to remove */
	path: string;
}

/**
 * Removes a file at the specified path.
 */
export const rm: StepHandler<RmStep> = async (playground, { path }) => {
	await playground.unlink(path);
};

/**
 * @inheritDoc rmdir
 * @hasRunnableExample
 * @landingPage /wp-admin/
 * @example
 *
 * <code>
 * {
 * 		"step": "rmdir",
 * 		"path": "/wordpress/wp-admin"
 * }
 * </code>
 */
export interface RmdirStep {
	step: 'rmdir';
	/** The path to remove */
	path: string;
}

/**
 * Removes a directory at the specified path.
 */
export const rmdir: StepHandler<RmdirStep> = async (playground, { path }) => {
	await playground.rmdir(path);
};

/**
 * @inheritDoc writeFile
 * @hasRunnableExample
 * @landingPage /test.php
 * @example
 *
 * <code>
 * {
 * 		"step": "writeFile",
 * 		"path": "/wordpress/test.php",
 * 		"data": "<?php echo 'Hello World!'; ?>"
 * }
 * </code>
 */
export interface WriteFileStep<ResourceType> {
	step: 'writeFile';
	/** The path of the file to write to */
	path: string;
	/** The data to write */
	data: ResourceType | string | Uint8Array;
}

/**
 * Writes data to a file at the specified path.
 */
export const writeFile: StepHandler<WriteFileStep<File>> = async (
	playground,
	{ path, data }
) => {
	if (data instanceof File) {
		data = await fileToUint8Array(data);
	}
	await playground.writeFile(path, data);
};
