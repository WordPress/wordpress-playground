import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { SupportedPHPVersions } from '@php-wasm/universal';
import { InMemoryState } from './state';
import {
	VSCodeButton,
	VSCodeProgressRing,
	VSCodeDropdown,
	VSCodeOption,
} from '@vscode/webview-ui-toolkit/react';

// @TODO Move to @wp-playground/wordpress package
const SupportedWordPressVersions = ['6.2', '6.1', '6.0', '5.9'] as const;

// @ts-ignore
const vscode = acquireVsCodeApi();

interface WebviewProps {
	initialState: InMemoryState;
}
const Webview = ({ initialState }: WebviewProps) => {
	const [appState, setAppState] = useState(initialState as InMemoryState);
	useEffect(() => {
		window.addEventListener('message', (event) => {
			const message = event.data;

			switch (message.command) {
				case 'stateChange':
					setAppState(message.state as InMemoryState);
					break;
			}
		});

		getInitialState().then((state: InMemoryState) => {
			setAppState(state);
		});
	}, []);

	return (
		<div>
			<p>
				WordPress Playground is a tool for developing WordPress themes
				and plugins locally in Visual Studio Code.
			</p>
			<p>
				It provides a working local WordPress environment, with which
				you can develop and test your WordPress plugin or theme, and
				even WordPress core itself.
			</p>
			<p>
				To get started, make sure to open a folder with either your
				plugin, theme, or an entire WordPress, and then press the button
				below to start the playground:
			</p>
			<ServerState appState={appState} />
		</div>
	);
};

interface ServerStateProps {
	appState: InMemoryState;
}
const ServerState = ({ appState }: ServerStateProps) => {
	if (appState.state === 'starting-server') {
		return (
			<>
				<FlexCenter>
					<VSCodeProgressRing />
					<span>Starting WordPress Server...</span>
				</FlexCenter>
			</>
		);
	}

	if (appState.state === 'server-running') {
		return (
			<>
				<FlexCenter>
					<VSCodeButton
						className="server-button"
						appearance="primary"
						onClick={handleStopServerClick}
					>
						Stop WordPress Server
					</VSCodeButton>
				</FlexCenter>
				<p>
					WordPressServer is running at{' '}
					<a href={appState.serverAddress}>
						{appState.serverAddress}
					</a>
				</p>
				<Dropdown
					label="PHP Version:"
					options={Object.fromEntries(
						SupportedPHPVersions.map((version) => [
							version,
							version,
						])
					)}
					selected={appState.phpVersion!}
					onChange={(value) => {
						vscode.postMessage({
							command: 'option-change',
							option: 'phpVersion',
							value,
						});
					}}
				/>
				{!['core', 'core-develop'].includes(appState.mode) ? (
					<Dropdown
						label="WordPress Version:"
						options={Object.fromEntries(
							SupportedWordPressVersions.map((version) => [
								version,
								version,
							])
						)}
						selected={appState.wordPressVersion!}
						onChange={(value) => {
							vscode.postMessage({
								command: 'option-change',
								option: 'wordPressVersion',
								value,
							});
						}}
					/>
				) : null}
				<p>Mode: {appState.mode}</p>
				<p>Project path: {appState.projectPath}</p>
			</>
		);
	}

	return (
		<FlexCenter>
			<VSCodeButton
				className="server-button"
				appearance="primary"
				onClick={handleStartServerClick}
			>
				Start WordPress Server
			</VSCodeButton>
		</FlexCenter>
	);
};

interface DropdownProps {
	label: string;
	options: Record<string, string>;
	selected: string;
	onChange: (value: string) => void;
}

function Dropdown({ label, options, selected, onChange }: DropdownProps) {
	const handleSelectChange = (event) => {
		console.log(event.target.value);
		onChange(event.target.value);
	};

	return (
		<div className="dropdown-container">
			<label htmlFor="my-dropdown">{label}</label>
			<VSCodeDropdown id="my-dropdown" onChange={handleSelectChange}>
				{Object.entries(options).map(([value, label]) => (
					<VSCodeOption
						key={value}
						selected={value === selected}
						value={value}
					>
						{label}
					</VSCodeOption>
				))}
			</VSCodeDropdown>
		</div>
	);
}

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
root.render(
	<Webview initialState={JSON.parse(localStorage.getItem('state') || '{}')} />
);
window.addEventListener('message', function (event) {
	if (event?.data?.command === 'stateChange') {
		localStorage.setItem('state', JSON.stringify(event?.data?.state));
	}
});

function getInitialState() {
	return new Promise((resolve) => {
		vscode.postMessage({ command: 'get-state' });
		function renderOnStateChange(event) {
			if (event?.data?.command === 'stateChange') {
				window.removeEventListener('message', renderOnStateChange);
				console.log(event?.data?.state);
				resolve(event?.data?.state);
			}
		}
		window.addEventListener('message', renderOnStateChange);
	});
}
