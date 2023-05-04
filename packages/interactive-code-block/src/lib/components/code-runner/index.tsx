import * as React from 'react';
import { useLibraries } from '../../hooks/use-libraries';
import { ExecutionScript, CodeRunnerClass, Library } from '../../types';
import PHPRunner from '../php-runner';
import PlaygroundRunner from '../playground-runner';

export interface CodeRunnerRef {
	runCode: (code: string) => any;
}

interface InitializationOptions {
	executionScript: ExecutionScript;
	libraries: Library[];
	initialOutput?: string;
	initialCode?: string;
}
export const CodeRunner = React.forwardRef<
	CodeRunnerRef,
	InitializationOptions
>(function CodeRunnerComponent(
	{
		executionScript,
		libraries,
		initialCode,
		initialOutput,
	}: InitializationOptions,
	ref
) {
	const librariesResult = useLibraries(libraries);

	if (executionScript?.runner === PHPRunner.id) {
		return (
			<PHPRunner
				ref={ref as any}
				libraries={librariesResult}
				executionScript={executionScript}
				initialOutput={initialOutput}
			/>
		);
	} else if (executionScript?.runner === PlaygroundRunner.id) {
		return <PlaygroundRunner ref={ref as any} initialCode={initialCode} />;
	} else {
		return null;
	}
});

export const SUPPORTED_RUNNERS: CodeRunnerClass[] = [
	PHPRunner,
	PlaygroundRunner,
];

export function getDefaultExecutionScript(id: string) {
	return SUPPORTED_RUNNERS.find((r) => r.id === id)?.defaultExecutionScript;
}

export function isDefaultScriptId(id: string) {
	return !!getDefaultExecutionScript(id);
}
