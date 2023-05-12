import { Worker } from 'worker_threads';
import * as vscode from 'vscode';
// @ts-ignore
import webviewHtml from './webview.html';
import { InMemoryStateManager } from './state';

let worker;
const stateManager = new InMemoryStateManager();
async function startWordPressServer() {
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
		await stateManager.write({ state: 'starting-server' });
		worker = new Worker(__dirname + '/worker.js');

		worker.on('message', (message) => {
			switch (message.command) {
				case 'server-started':
					stateManager.write({ state: 'server-running' });
					vscode.env.openExternal(vscode.Uri.parse(message.url));
					stateManager.write({
						serverAddress: message.url,
						wordPressVersion: message.wordPressVersion,
						mode: message.mode,
						phpVersion: message.phpVersion,
						projectPath: message.projectPath,
					});
					vscode.window.showInformationMessage(
						'WordPress is running at ' + message.url
					);
					break;
			}
		});

		worker.on('error', (err) => {
			vscode.window.showErrorMessage(
				'WordPress Playground error: ' + err.message
			);
			console.trace(err);
			stateManager.write({ state: 'idle', serverAddress: undefined });
		});

		worker.postMessage({
			command: 'start-server',
			config: {
				phpVersion: stateManager.read().phpVersion,
				wordPressVersion: stateManager.read().wordPressVersion,
				projectPath: vscode.workspace.workspaceFolders[0].uri.fsPath,
			},
		});
	} catch (e) {
		vscode.window.showErrorMessage(
			'WordPress Playground error: ' + e.message
		);
		console.trace(e);
		stateManager.write({ state: 'idle', serverAddress: undefined });
	}
}

async function stopWordPressServer() {
	if (!stateManager.read().serverAddress) {
		vscode.window.showInformationMessage('WordPress server is not running');
		return;
	}

	try {
		stateManager.write({ state: 'stopping-server' });
		worker.terminate();
		stateManager.write({ state: 'idle', serverAddress: undefined });
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
			provider
		)
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

	/**
	 * Revolves a webview view.
	 *
	 * `resolveWebviewView` is called when a view first becomes visible. This may happen when the view is
	 * first loaded or when the user hides and then shows a view again.
	 *
	 * @return Optional thenable indicating that the view has been fully resolved.
	 */
	public resolveWebviewView(webviewView: vscode.WebviewView) {
		console.log('CREATING WEB VIEW');
		webviewView.webview.options = {
			// Allow scripts in the webview
			enableScripts: true,

			localResourceRoots: [this._extensionUri],
		};

		stateManager.addEventListener('change', (e) => {
			webviewView.webview.postMessage({
				command: 'stateChange',
				state: (e as any).state,
			});
		});

		webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);

		webviewView.webview.onDidReceiveMessage(async (message) => {
			console.log('MESSAGE RECEIVED', message);
			switch (message.command) {
				case 'get-state':
					webviewView.webview.postMessage({
						command: 'stateChange',
						state: stateManager.read(),
					});
					break;
				case 'server-start':
					startWordPressServer();
					break;
				case 'server-stop':
					stopWordPressServer();
					break;
				case 'option-change':
					await stopWordPressServer();
					if (message.option === 'phpVersion') {
						stateManager.write({
							phpVersion: message.value,
						});
					} else if (message.option === 'wordPressVersion') {
						stateManager.write({
							wordPressVersion: message.value,
						});
					}
					startWordPressServer();
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
