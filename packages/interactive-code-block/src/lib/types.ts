export type MemFile = {
	fileName: string;
	contents: string;
};

export const outputFormats = {
	plaintext: 'Plain text',
	html: 'HTML',
	jsontabular: 'JSON (tabular)',
	jsontabularsql: 'JSON (tabular, SQL queries)',
} as const;
export type OutputFormat = keyof typeof outputFormats;

export interface ExecutionScript {
	id: string;
	runner: CodeRunnerClass['id'];
	name?: string;
	content: string;
	outputFormat?: OutputFormat;
	libraries?: string[];
}

export interface Library {
	id: string;
	name: string;
	url: string;
}

export type LoadingStatus = 'idle' | 'loading' | 'ready' | 'error';

export interface InteractiveCodeSnippetBlockAttributes {
	code: string;
	fileType: 'php' | 'sql';
	executionScript: string;
	libraries: string[];
	cachedOutput: string;
	showCachedOutput: boolean;
}

export interface ICodeRunner {
	isReady: boolean;
	isRunning: boolean;
	result?: string;
	run(code: string): Promise<string>;
	addEventListener(event: string, listener: any): void;
	setLoadedLibraries(loadedLibraries: Record<string, Uint8Array>): void;
}

import type PHPRunner from './components/php-runner';
import type PlaygroundRunner from './components/playground-runner';

export type CodeRunner = PHPRunner | PlaygroundRunner;

// Get class type from instance type
export interface Type<T> extends Function {
	new (...args: any[]): T;
}
export type CodeRunnerClass = Type<CodeRunner> & {
	id: string;
	defaultExecutionScript: ExecutionScript;
};

export interface Loader {
	load(): Promise<void>;
	// progress or ready
	addEventListener(event: string, callback: any): void;
}
