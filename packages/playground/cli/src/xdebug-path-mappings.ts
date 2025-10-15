import fs from 'fs';
import path from 'path';
import { logger } from '@php-wasm/logger';
import { type Mount } from './mounts';
import { Builder, parseStringPromise } from 'xml2js';
import JSONC from 'jsonc-parser';

/**
 * Create a symlink to temp dir for the Playground CLI.
 *
 * The symlink is created to access the system temp dir
 * inside the current debugging directory.
 *
 * @param nativeDirPath The system temp dir path.
 * @param symlinkPath The symlink name.
 */
export async function createPlaygroundCliTempDirSymlink(
	nativeDirPath: string,
	symlinkPath: string
) {
	fs.symlinkSync(nativeDirPath, symlinkPath);
}

/**
 * Remove the temp dir symlink if it exists.
 *
 * @param symlinkPath The symlink path.
 */
export async function removePlaygroundCliTempDirSymlink(symlinkPath: string) {
	try {
		const stats = fs.lstatSync(symlinkPath);
		if (stats.isSymbolicLink()) {
			fs.unlinkSync(symlinkPath);
		} else {
			logger.warn(
				`${symlinkPath} exists and is not a symlink. Skipping symlink creation.`
			);
		}
	} catch {
		// Symlink does not exist or cannot be accessed, nothing to remove
	}
}

/**
 * Filters out mounts that are not in the current working directory
 *
 * @param mounts The Playground CLI mount options.
 */
function filterLocalMounts(mounts: Mount[]) {
	return mounts.filter((mount) => {
		const absoluteHostPath = path.resolve(mount.hostPath);
		return absoluteHostPath.startsWith(process.cwd() + path.sep);
	});
}

/**
 * Implement necessary parameters and path mappings in IDE configuration files.
 *
 * @param name The configuration name.
 * @param mounts The Playground CLI mount options.
 */
export async function addIDEConfig(name: string, mounts: Mount[]) {
	let configFilePath;
	const mappings = filterLocalMounts(mounts);

	configFilePath = path.join(process.cwd(), '.idea/workspace.xml');
	// PHPstorm
	if (fs.existsSync(configFilePath)) {
		const contents = fs.readFileSync(configFilePath);
		const config = await parseStringPromise(contents);

		const server = {
			$: {
				name: name,
				host: '127.0.0.1:9400',
				port: '80',
				use_path_mappings: 'true',
			},
			path_mappings: [
				{
					mapping: mappings.map((mapping) => ({
						$: {
							'local-root': `$PROJECT_DIR$/${mapping.hostPath.replace(
								/^\.\/?/,
								''
							)}`,
							'remote-root': mapping.vfsPath,
						},
					})),
				},
			],
		};

		if (!config.project) {
			logger.warn(
				'PhpStorm configuration file does not contain a <project> element. Skipping path mapping.'
			);
			return;
		}

		const component = config?.project?.component?.find(
			(c: { $: { name: string } }) => c.$.name === 'PhpServers'
		);
		if (!component) {
			config.project.component = [];
			config.project.component.push({
				$: { name: 'PhpServers' },
				servers: [{ server: [] }],
			});
		}

		const servers = component?.servers[0]?.server?.find(
			(c: { $: { name: string } }) => c.$.name === name
		);
		if (!servers) {
			component.servers[0].server.push(server);
		}

		const builder = new Builder({
			xmldec: { version: '1.0', encoding: 'UTF-8' },
			headless: false,
			renderOpts: { pretty: true },
		});
		const xml = builder.buildObject(config);

		fs.writeFileSync(configFilePath, xml);
	}

	configFilePath = path.join(process.cwd(), '.vscode/launch.json');
	// VSCode
	if (fs.existsSync(configFilePath)) {
		const configuration = {
			name: name,
			type: 'php',
			request: 'launch',
			port: 9003,
			pathMappings: mappings.reduce((acc, mount) => {
				acc[
					mount.vfsPath
				] = `\${workspaceFolder}/${mount.hostPath.replace(
					/^\.\/?/,
					''
				)}`;
				return acc;
			}, {} as Record<string, string>),
		};

		const errors: JSONC.ParseError[] = [];

		let content = fs.readFileSync(configFilePath, 'utf-8');
		let root = JSONC.parseTree(content, errors, {
			allowEmptyContent: true,
			allowTrailingComma: true,
		});

		if (!root || errors.length) {
			logger.error('VSCode configuration file is not valid JSON.');
			process.exit(1);
		}

		let configurationsNode = JSONC.findNodeAtLocation(root, [
			'configurations',
		]);

		if (!configurationsNode || !configurationsNode.children) {
			const edits = JSONC.modify(content, ['configurations'], [], {});
			content = JSONC.applyEdits(content, edits);

			root = JSONC.parseTree(content, []);
			configurationsNode = JSONC.findNodeAtLocation(root!, [
				'configurations',
			]);
		}

		const index = configurationsNode!.children!.findIndex(
			(child) => JSONC.findNodeAtLocation(child, ['name'])?.value === name
		);

		if (index === -1) {
			const edits = JSONC.modify(
				content,
				['configurations', configurationsNode!.children!.length],
				configuration,
				{
					formattingOptions: {
						insertSpaces: true,
						tabSize: 4,
						eol: '\n',
					},
				}
			);

			content = JSONC.applyEdits(content, edits);

			fs.writeFileSync(configFilePath, content);
		}
	}
}

/**
 * Remove stale parameters and path mappings in IDE configuration files.
 *
 * @param name The configuration name.
 */
export async function clearIDEConfig(name: string) {
	let configFilePath;

	configFilePath = path.join(process.cwd(), '.idea/workspace.xml');
	// PHPstorm
	if (fs.existsSync(configFilePath)) {
		const contents = fs.readFileSync(configFilePath);
		const config = await parseStringPromise(contents);

		const component = config?.project?.component?.find(
			(c: { $: { name: string } }) => c.$.name === 'PhpServers'
		);

		if (component && component?.servers[0]?.server) {
			component.servers[0].server = component.servers[0].server.filter(
				(c: { $: { name: string } }) => c.$.name !== name
			);

			const builder = new Builder({
				xmldec: { version: '1.0', encoding: 'UTF-8' },
				headless: false,
				renderOpts: { pretty: true },
			});
			const xml = builder.buildObject(config);

			fs.writeFileSync(configFilePath, xml);
		}
	}

	configFilePath = path.join(process.cwd(), '.vscode/launch.json');
	// VSCode
	if (fs.existsSync(configFilePath)) {
		const errors: JSONC.ParseError[] = [];

		const content = fs.readFileSync(configFilePath, 'utf-8');
		const root = JSONC.parseTree(content, errors, {
			allowEmptyContent: true,
			allowTrailingComma: true,
		});

		if (!root || errors.length) {
			console.log(errors);
			logger.error('VSCode configuration file is not valid JSON.');
			process.exit(1);
		}

		const configurationsNode = JSONC.findNodeAtLocation(root, [
			'configurations',
		]);

		const index = configurationsNode?.children?.findIndex(
			(child) => JSONC.findNodeAtLocation(child, ['name'])?.value === name
		);

		if (index !== undefined && index !== -1) {
			const edits = JSONC.modify(
				content,
				['configurations', index],
				undefined,
				{
					formattingOptions: {
						insertSpaces: true,
						tabSize: 4,
						eol: '\n',
					},
				}
			);

			const json = JSONC.applyEdits(content, edits);

			fs.writeFileSync(configFilePath, json);
		}
	}
}
