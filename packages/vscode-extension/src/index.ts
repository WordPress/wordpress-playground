import { startServer, WPNowServer } from 'wp-now';
import * as vscode from 'vscode';
// @ts-ignore
import webviewHtml from './webview.html';
import { InMemoryStateManager, StateChangeEvent } from './state';

const stateManager = new InMemoryStateManager();
let server: WPNowServer;
async function startWordPressServer() {
	const memoryData = process.memoryUsage();

	const formatMemoryUsage = (data) =>
		`${Math.round((data / 1024 / 1024) * 100) / 100} MB`;
	const memoryUsage = {
		rss: `${formatMemoryUsage(
			memoryData.rss
		)} -> Resident Set Size - total memory allocated for the process execution`,
		heapTotal: `${formatMemoryUsage(
			memoryData.heapTotal
		)} -> total size of the allocated heap`,
		heapUsed: `${formatMemoryUsage(
			memoryData.heapUsed
		)} -> actual memory used during the execution`,
		external: `${formatMemoryUsage(
			memoryData.external
		)} -> V8 external memory`,
	};

	console.log(memoryUsage);

	if (!vscode.workspace.workspaceFolders) {
		vscode.window.showErrorMessage(
			'Open a folder before starting WordPress Playground server'
		);
		return;
	}
	if (stateManager.read().serverAddress) {
		vscode.window.showInformationMessage(
			'WordPress is running at ' + stateManager.read().serverAddress
		);
		return;
	}

	try {
		vscode.window.showInformationMessage(
			'Starting WordPress Playground server...'
		);
		server = await startServer({
			phpVersion: '7.4',
			projectPath: vscode.workspace.workspaceFolders[0].uri.fsPath,
			mode: 'plugin',
		});
		stateManager.write({ serverAddress: server.url });
		vscode.window.showInformationMessage(
			'WordPress is running at ' + server.url
		);
		vscode.env.openExternal(vscode.Uri.parse(server.url));
	} catch (e) {
		vscode.window.showErrorMessage(
			'WordPress Playground error: ' + e.message
		);
		console.trace(e);
	}
}

async function stopWordPressServer() {
	if (!stateManager.read().serverAddress) {
		vscode.window.showInformationMessage('WordPress server is not running');
		return;
	}

	try {
		server.destroy();
		await stateManager.write({ serverAddress: undefined });
		vscode.window.showInformationMessage('WordPress server stopped');
	} catch (e) {
		vscode.window.showErrorMessage(
			'WordPress Playground error: ' + e.message
		);
		console.trace(e);
	}
}

async function activate(context) {
	const provider = new PlaygroundViewProvider(context.extensionUri);

	context.subscriptions.push(
		vscode.window.registerWebviewViewProvider(
			PlaygroundViewProvider.viewType,
			provider,
			{
				// Enable javascript in the webview
				enableScripts: true,
				// Restrict the webview to only load resources from the `out` directory
				localResourceRoots: [
					vscode.Uri.joinPath(context.extensionUri, 'out'),
				],
			}
		)
	);

	vscode.window.showInformationMessage(
		'WordPress is running at ' + stateManager.read().serverAddress
	);

	context.subscriptions.push(
		vscode.commands.registerCommand(
			'wordpress-playground.serve',
			startWordPressServer
		)
	);
}

class PlaygroundViewProvider implements vscode.WebviewViewProvider {
	public static readonly viewType = 'wordpress-playground-server';

	constructor(private readonly _extensionUri: vscode.Uri) {}

	public resolveWebviewView(webviewView: vscode.WebviewView) {
		webviewView.webview.options = {
			// Allow scripts in the webview
			enableScripts: true,

			localResourceRoots: [this._extensionUri],
		};

		stateManager.addEventListener('change', (e: StateChangeEvent) => {
			webviewView.webview.postMessage({
				command: 'stateChange',
				state: e.state,
			});
		});

		webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);

		webviewView.webview.onDidReceiveMessage((data) => {
			switch (data.command) {
				case 'server-start':
					startWordPressServer();
					break;
				case 'server-stop':
					stopWordPressServer();
					break;
			}
		});
	}

	private _getHtmlForWebview(webview: vscode.Webview) {
		// Get the local path to main script run in the webview, then convert it to a uri we can use in the webview.
		const scriptUri = webview.asWebviewUri(
			vscode.Uri.joinPath(this._extensionUri, 'webview.js')
		);

		// Use a nonce to only allow a specific script to be run.
		const nonce = getNonce();

		return webviewHtml
			.replaceAll('${appState}', JSON.stringify(stateManager.read()))
			.replaceAll('${nonce}', nonce)
			.replaceAll('${scriptUri}', scriptUri);
	}
}

function getNonce() {
	let text = '';
	const possible =
		'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
	for (let i = 0; i < 32; i++) {
		text += possible.charAt(Math.floor(Math.random() * possible.length));
	}
	return text;
}

// This method is called when your extension is deactivated
function deactivate() {}

module.exports = {
	activate,
	deactivate,
};
