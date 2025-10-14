import fs from 'fs';
import path from 'path';
import { logger } from '@php-wasm/logger';
import { type Mount } from './mounts';
import { Builder, parseStringPromise } from 'xml2js';

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
	let pathMappingsSet = false;
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

		pathMappingsSet = true;
	}

	configFilePath = path.join(process.cwd(), '.vscode/launch.json');
	// VSCode
	if (fs.existsSync(configFilePath)) {
		const config = JSON.parse(fs.readFileSync(configFilePath, 'utf-8'));

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

		if (!config.configurations) {
			logger.warn(
				"VSCode configuration file is missing a 'configurations' array. Skipping path mapping."
			);
			return;
		}

		const component = config.configurations.find(
			(c: { name: string }) => c.name === name
		);

		if (!component) {
			config.configurations.push(configuration);
		}

		const json = JSON.stringify(config, null, 4);

		fs.writeFileSync(configFilePath, json);

		pathMappingsSet = true;
	}

	if (!pathMappingsSet) {
		logger.warn(
			"No IDE configuration file was found. Running with '--experimental-ide' requires an IDE configuration file. Skipping path mapping."
		);
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
		const config = JSON.parse(fs.readFileSync(configFilePath, 'utf-8'));

		const component = config?.configurations?.filter(
			(configuration: { name: string }) => configuration.name !== name
		);

		if (component) {
			config.configurations = component;

			const json = JSON.stringify(config, null, 4);

			fs.writeFileSync(configFilePath, json);
		}
	}
}
