import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';

import {
	provideVSCodeDesignSystem,
	vsCodeButton,
} from '@vscode/webview-ui-toolkit';
import { InMemoryState } from './state';

provideVSCodeDesignSystem().register(vsCodeButton());

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
const ServerState = ({ appState }: ServerStateProps) => {
	if (appState.serverAddress) {
		return (
			<>
				<vscode-button
					class="server-button"
					appearance="primary"
					onClick={handleStopServerClick}
				>
					Stop WordPress Server
				</vscode-button>
				<p>
					WordPressServer is running at
					<a href={appState.serverAddress}>
						{appState.serverAddress}
					</a>
                </p>
                <p>
                    PHP Version:
                </p>
                <p>
                    WordPress Version:
                </p>
                <p>
                    Mode:
                </p>
			</>
		);
	}

	return (
		<>
			<p>To get started, press the button below.</p>
			<vscode-button
				class="server-button"
				appearance="primary"
				onClick={handleStartServerClick}
			>
				Start WordPress Server
			</vscode-button>
		</>
	);
};

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
