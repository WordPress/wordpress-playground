import { Remote } from 'comlink';
import { LimitedPHPApi } from './php-worker';

/**
 * Represents an event related to the PHP request.
 */
export interface PHPRequestEndEvent {
	type: 'request.end';
}

/**
 * Represents an error event related to the PHP request.
 */
export interface PHPRequestErrorEvent {
	type: 'request.error';
	error: Error;
	source?: 'request' | 'php-wasm';
}

/**
 * Represents a PHP runtime initialization event.
 */
export interface PHPRuntimeInitializedEvent {
	type: 'runtime.initialized';
}

/**
 * Represents a PHP runtime destruction event.
 */
export interface PHPRuntimeBeforeDestroyEvent {
	type: 'runtime.beforedestroy';
}

/**
 * Represents an event related to the PHP instance.
 * This is intentionally not an extension of CustomEvent
 * to make it isomorphic between different JavaScript runtimes.
 */
export type PHPEvent =
	| PHPRequestEndEvent
	| PHPRequestErrorEvent
	| PHPRuntimeInitializedEvent
	| PHPRuntimeBeforeDestroyEvent;

/**
 * A callback function that handles PHP events.
 */
export type PHPEventListener = (event: PHPEvent) => void;

export type UniversalPHP = LimitedPHPApi | Remote<LimitedPHPApi>;

export type MessageListener = (
	data: string
) => Promise<string | Uint8Array | void> | string | void;
interface EventEmitter {
	on(event: string, listener: (...args: any[]) => void): this;
	emit(event: string, ...args: any[]): boolean;
}
type ChildProcess = EventEmitter & {
	stdout: EventEmitter;
	stderr: EventEmitter;
};
export type SpawnHandler = (command: string, args: string[]) => ChildProcess;

export type HTTPMethod =
	| 'GET'
	| 'POST'
	| 'HEAD'
	| 'OPTIONS'
	| 'PATCH'
	| 'PUT'
	| 'DELETE';
export type PHPRequestHeaders = Record<string, string>;
export interface PHPRequest {
	/**
	 * Request method. Default: `GET`.
	 */
	method?: HTTPMethod;

	/**
	 * Request path or absolute URL.
	 */
	url: string;

	/**
	 * Request headers.
	 */
	headers?: PHPRequestHeaders;

	/**
	 * Request body.
	 * If an object is given, the request will be encoded as multipart
	 * and sent with a `multipart/form-data` header.
	 */
	body?: string | Uint8Array | Record<string, string | Uint8Array | File>;
}

export interface PHPRunOptions {
	/**
	 * Request path following the domain:port part.
	 */
	relativeUri?: string;

	/**
	 * Path of the .php file to execute.
	 */
	scriptPath?: string;

	/**
	 * Request protocol.
	 */
	protocol?: string;

	/**
	 * Request method. Default: `GET`.
	 */
	method?: HTTPMethod;

	/**
	 * Request headers.
	 */
	headers?: PHPRequestHeaders;

	/**
	 * Request body.
	 */
	body?: string | Uint8Array;

	/**
	 * Environment variables to set for this run.
	 */
	env?: Record<string, string>;

	/**
	 * $_SERVER entries to set for this run.
	 */
	$_SERVER?: Record<string, string>;

	/**
	 * The code snippet to eval instead of a php file.
	 */
	code?: string;
}

/**
 * Output of the PHP.wasm runtime.
 */
export interface PHPOutput {
	/** Exit code of the PHP process. 0 means success, 1 and 2 mean error. */
	exitCode: number;

	/** Stdout data */
	stdout: ArrayBuffer;

	/** Stderr lines */
	stderr: string[];
}
