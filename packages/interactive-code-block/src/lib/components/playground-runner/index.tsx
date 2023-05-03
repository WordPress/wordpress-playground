import * as React from 'react';
import * as Comlink from 'comlink';
import { ExecutionScript } from '../../types';
// @ts-ignore
import { default as playgroundUrl } from '../../../../public/playground-sandbox.html?url';
import classnames from 'classnames';
import ReactDOM from 'react-dom';
const sandboxHash = playgroundUrl.split('-').pop().split('.')[0];

interface SandboxApi {
	isReady(): Promise<void>;
	execute(code: string): Promise<void>;
}

interface Props {
	initialCode?: string;
	executionScript?: ExecutionScript;
}
interface State {
	iframeId: string;
	isReady: boolean;
	iframeLoaded: boolean;
	isLoading: boolean;
	isRunning: boolean;
	hasOwnLoader: boolean;

	lastEnqueuedCode?: string;
	client?: SandboxApi;
}

export default class PlaygroundRunner extends React.Component<Props, State> {
	static id = 'WordPress Playground' as const;
	static defaultExecutionScript: ExecutionScript = {
		id: PlaygroundRunner.id,
		runner: PlaygroundRunner.id,
		name: 'WordPress Playground',
		content: `/* Implemented in TypeScript as PlaygroundRunner.runCode() */`,
	};

	constructor(props: Props) {
		if (!props.executionScript) {
			props.executionScript = PlaygroundRunner.defaultExecutionScript;
		}
		super(props);
		this.state = {
			iframeId: 'playground-frame',
			iframeLoaded: false,
			isReady: true,
			isLoading: true,
			isRunning: false,
			hasOwnLoader: true,
			lastEnqueuedCode: props.initialCode,
		};
	}

	async onIframeLoaded() {
		if (!this.state.client) {
			const root = ReactDOM.findDOMNode(this)! as Element;
			const iframe = root.querySelector('iframe')!;
			const endpoint = Comlink.windowEndpoint(iframe.contentWindow!);
			const client = Comlink.wrap<SandboxApi>(endpoint);
			this.setState({
				client,
			});
			await client.isReady();

			/**
			 * Run the initial (or last requested) code snippet once
			 * the playground site is loaded
			 */
			if (this.state.lastEnqueuedCode) {
				this.runCode(this.state.lastEnqueuedCode);
				this.setState({ lastEnqueuedCode: undefined });
			}

			this.setState({
				isLoading: false,
			});
		}
	}

	async runCode(code: string) {
		if (this.state.isRunning) {
			this.setState({ lastEnqueuedCode: code });
			return;
		}

		this.setState({ isRunning: true });

		if (!this.state.client) {
			this.setState({ lastEnqueuedCode: code });
			return;
		}

		await this.state.client.isReady();
		await this.state.client.execute(code);

		this.setState({ isRunning: false });

		if (this.state.lastEnqueuedCode) {
			const newCode = this.state.lastEnqueuedCode;
			this.setState({ lastEnqueuedCode: undefined });
			await this.runCode(newCode);
		}
	}

	override render() {
		const className = classnames('has-interactive-code-spinner', {
			['is-spinner-active']: this.state.isLoading,
		});
		// @TODO remove allow-scripts for true sandboxing
		return (
			<div className={className} style={{ width: '100%' }}>
				<iframe
					id="output-iframe"
					sandbox="allow-same-origin allow-scripts"
					style={{
						width: '100%',
						minHeight: '500px',
						border: '1px solid #eee',
						boxShadow: '0 0 10px #eee',
					}}
					onLoad={() => this.onIframeLoaded()}
					src={
						// File from the `public` directory:
						new URL(
							'../playground-sandbox.html?' + sandboxHash,
							import.meta.url
						).href
					}
				></iframe>
			</div>
		);
	}
}
