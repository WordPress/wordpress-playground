import * as React from 'react';
import { PHPClient } from '../../php-worker';
import { ExecutionScript } from '../../types';
import { CodeOutput } from '../code-output';
import { CodeOutputLoader } from '../code-output/loader';
import { UseLibrariesResult } from '../../hooks/use-libraries';
import sharedPHPLoader from './php-loader';
import classnames from 'classnames';

interface State {
	userScriptPath: string;
	executionScriptPath: string;
	isReady: boolean;
	isRunning: boolean;
	result?: string;
	lastEnqueuedCode?: string;
	phpProgress: number;
}
interface Props {
	executionScript?: ExecutionScript;
	initialOutput?: string;
	libraries: UseLibrariesResult;
}

export default class PHPRunner extends React.Component<Props, State> {
	static id = 'PHP' as const;
	static defaultExecutionScript: ExecutionScript = {
		id: PHPRunner.id,
		runner: PHPRunner.id,
		name: 'PHP',
		content: `<?php require $SCRIPT_PATH;`,
	};

	constructor(props: Props) {
		if (!props.executionScript) {
			props.executionScript = PHPRunner.defaultExecutionScript;
		}
		super(props);

		this.state = {
			userScriptPath: `/tmp/user.${Math.random()}.php`,
			executionScriptPath: `/tmp/execution.${Math.random()}.php`,
			phpProgress: sharedPHPLoader.progress,
			isReady: false,
			isRunning: false,
			result: props.initialOutput,
		};
	}

	override componentDidUpdate(): void {
		this.updateLoadedLibraries();
	}

	override componentDidMount(): void {
		sharedPHPLoader.addEventListener('progress', ((
			e: CustomEvent<number>
		) => {
			this.setState({
				phpProgress: e.detail,
			});
		}) as any);
		this.php
			.then((php) => php.isReady())
			.then(() => {
				this.updateLoadedLibraries();
				this.setState({ isReady: true });
				if (this.state.lastEnqueuedCode) {
					this.runCode(this.state.lastEnqueuedCode);
					this.setState({
						lastEnqueuedCode: undefined,
					});
				}
			});
	}

	get php(): Promise<PHPClient> {
		return sharedPHPLoader.load();
	}

	async updateLoadedLibraries() {
		const php = await this.php;
		const loaded = this.props.libraries.loaded;
		for (const name in loaded) {
			php!.writeFile(`/${name}`, new Uint8Array(loaded[name]));
		}
	}

	async runCode(code: string) {
		this.setState({ isRunning: true });

		if (!this.state.isReady) {
			this.setState({ lastEnqueuedCode: code });
			return '';
		}

		const php = await this.php;
		php.writeFile(
			this.state.executionScriptPath,
			`<?php $SCRIPT_PATH = "${this.state.userScriptPath}"; ?>` +
				this.props.executionScript!.content
		);
		php.writeFile(this.state.userScriptPath, code);
		const { text } = await php.run({
			scriptPath: this.state.executionScriptPath,
		});
		this.setState({
			result: text,
			isRunning: false,
		});
		return text;
	}

	override render() {
		if (!this.state.isReady) {
			return <CodeOutputLoader progress={this.progress} />;
		}

		const className = classnames('has-interactive-code-spinner', {
			['is-spinner-active']: this.state.isRunning,
		});

		return (
			<div className={className}>
				<CodeOutput
					outputFormat={this.props.executionScript?.outputFormat}
					result={this.state.result}
					isRunning={this.state.isRunning}
				/>
			</div>
		);
	}

	get progress() {
		const parts = [
			this.props.libraries.progress,
			this.state.phpProgress,
		].filter((p) => p !== undefined) as number[];
		return parts.reduce((a, b) => a + b, 0) / parts.length;
	}
}
