import { startPlaygroundWeb } from '@wp-playground/client';
import { getRemoteUrl } from '../src/lib/config';
import { TerminalComponent } from './terminal-component';
import { createRoot } from 'react-dom/client';
import React from 'react';

export async function runDemo(iframe: HTMLIFrameElement) {
	const wpCliRequest = fetch(
		'https://raw.githubusercontent.com/wp-cli/builds/gh-pages/phar/wp-cli.phar'
	);
	const playground = await startPlaygroundWeb({
		iframe,
		remoteUrl: getRemoteUrl().toString(),
		blueprint: {
			preferredVersions: {
				php: '8.2',
				wp: 'latest',
			},
			features: {
				networking: true,
			},
			landingPage: '/',
			steps: [{ step: 'login', username: 'admin', password: 'password' }],
		},
		sapiName: 'cli',
	});

	const wpCliResponse = await wpCliRequest;
	const wpCli = await wpCliResponse.arrayBuffer();
	await playground.writeFile('/wordpress/wp-cli.phar', new Uint8Array(wpCli));

	const domNode = document.getElementById('terminal') as any;
	const root = createRoot(domNode);
	root.render(React.createElement(TerminalComponent, { playground }));
}
