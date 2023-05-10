import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';

import {
	provideVSCodeDesignSystem,
	vsCodeButton,
	vsCodeProgressRing,
} from '@vscode/webview-ui-toolkit';
import { InMemoryState } from './state';

provideVSCodeDesignSystem().register(vsCodeButton(), vsCodeProgressRing());

const vscode = acquireVsCodeApi();
const Webview = () => {
	const [appState, setAppState] = useState(
		(window as any).initialState as InMemoryState
	);
	useEffect(() => {
		window.addEventListener('message', (event) => {
			const message = event.data;
			console.log(message);

			switch (message.command) {
				case 'stateChange':
					setAppState(message.state as InMemoryState);
					break;
			}
		});
	}, []);

	return (
		<div>
			<p>
				WordPress Playground is a tool for developing WordPress themes
				and plugins.
			</p>
			<ServerState appState={appState} />
		</div>
	);
};

interface ServerStateProps {
	appState: InMemoryState;
}
const VscodeButton = 'vscode-button' as any;
const VscodeProgressRing = 'vscode-progress-ring' as any;
const ServerState = ({ appState }: ServerStateProps) => {
	if (appState.state === 'starting-server') {
		return (
			<>
				<FlexCenter>
					<VscodeProgressRing />
					<span>Starting WordPress Server...</span>
				</FlexCenter>
			</>
		);
	}

	if (appState.state === 'server-running') {
		return (
			<>
				<FlexCenter>
					<VscodeButton
						className="server-button"
						appearance="primary"
						onClick={handleStopServerClick}
					>
						Stop WordPress Server
					</VscodeButton>
				</FlexCenter>
				<p>
					WordPressServer is running at{' '}
					<a href={appState.serverAddress}>
						{appState.serverAddress}
					</a>
				</p>
				<p>PHP Version: {appState.phpVersion}</p>
				<p>WordPress Version: {appState.wordPressVersion}</p>
				<p>Mode: {appState.mode}</p>
				<p>Project path: {appState.projectPath}</p>
			</>
		);
	}

	return (
		<>
			<p>To get started, press the button below:</p>
			<FlexCenter>
				<VscodeButton
					className="server-button"
					appearance="primary"
					onClick={handleStartServerClick}
				>
					Start WordPress Server
				</VscodeButton>
			</FlexCenter>
		</>
	);
};

function FlexCenter({ children }) {
	return (
		<div
			style={{
				display: 'flex',
				justifyContent: 'center',
				alignItems: 'center',
				gap: '1rem',
			}}
		>
			{children}
		</div>
	);
}

function handleStartServerClick() {
	vscode.postMessage({
		command: 'server-start',
	});
}

function handleStopServerClick() {
	vscode.postMessage({
		command: 'server-stop',
	});
}

const root = createRoot(document.querySelector('#root')!);
root.render(<Webview />);
