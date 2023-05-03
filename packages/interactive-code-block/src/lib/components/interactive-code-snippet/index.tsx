import { useRef, useEffect, useState } from 'react';
import { Button, Spinner } from '@wordpress/components';
// @ts-ignore
import classes from './style.module.css';

import type {
	default as CodeMirrorComponent,
	CodeMirrorRef,
	CodeMirrorProps,
} from '../code-mirror';
import type { ExecutionScript, Library } from '../../types';
import { usePromise } from '../../hooks/use-promise';
import { CodeRunner, CodeRunnerRef } from '../code-runner';

interface InteractiveCodeSnippetProps {
	initialCode: string;
	initialOutput?: string;
	libraries?: Library[];
	fileType: CodeMirrorProps['fileType'];
	executionScript: ExecutionScript;
	onEval?: (result: string) => void;
	onChange?: (updatedContents: string) => void;
	onSave?: (updatedContents: string) => void;
}

let CodeMirror: typeof CodeMirrorComponent;
const CodeMirrorPromise = import('../code-mirror').then((module) => {
	CodeMirror = module.default as any;
});

export function InteractiveCodeSnippet({
	initialCode,
	initialOutput,
	libraries = [],
	fileType,
	executionScript,
	onEval,
	onChange,
	onSave,
}: InteractiveCodeSnippetProps) {
	const [computedResult, setComputedResult] = useState(initialOutput);
	const result = computedResult ?? initialOutput;
	useEffect(() => {
		if (result) {
			onEval?.(result);
		}
	}, [result]);

	usePromise(CodeMirrorPromise);
	const editorRef = useRef<CodeMirrorRef>(null);
	const runnerRef = useRef<CodeRunnerRef>(null);
	async function run() {
		const code = editorRef.current
			? editorRef.current!.getContents()
			: initialCode;
		const result = await runnerRef.current!.runCode(code);
		setComputedResult(result);
	}
	function handleSave() {
		run();
		const code = editorRef.current
			? editorRef.current.getContents()
			: initialCode;
		onSave?.(code);
	}

	return (
		<div className={classes.snippet}>
			<div>
				<div className={classes.title}>
					<b>Live Example:</b>
					<Button
						className={classes.runButton}
						icon="controls-play"
						variant="primary"
						onClick={run}
					>
						Run
					</Button>
				</div>
				{CodeMirror ? (
					<CodeMirror
						fileType={fileType}
						initialContents={initialCode}
						onChange={onChange}
						onSave={handleSave}
						ref={editorRef}
					/>
				) : (
					<Spinner />
				)}
			</div>
			<CodeRunner
				ref={runnerRef}
				libraries={libraries}
				executionScript={executionScript}
				initialCode={initialCode}
				initialOutput={initialOutput}
			/>
		</div>
	);
}
