import fs from 'fs';
import path from 'path';
import { logger } from '@php-wasm/logger';
import { type Mount } from './mounts';
import { XMLParser, XMLBuilder } from 'fast-xml-parser';
import type { X2jOptions, XmlBuilderOptions } from 'fast-xml-parser';
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
		const cwd = process.cwd();
		const cwdChildPrefix = path.join(cwd, path.sep);
		return (
			// If auto-mounting from the current directory,
			// the entire project directory can be mapped.
			absoluteHostPath === cwd ||
			absoluteHostPath.startsWith(cwdChildPrefix)
		);
	});
}

export type IDEConfig = {
	/**
	 * The name of the configuration within the IDE configuration.
	 */
	name: string;
	/**
	 * The IDEs to configure.
	 */
	ides: string[];
	/**
	 * The web server host.
	 */
	host: string;
	/**
	 * The web server port.
	 */
	port: number;
	/**
	 * The mounts to consider for debugger path mapping.
	 */
	mounts: Mount[];
};

const xmlParserOptions: X2jOptions = {
	ignoreAttributes: false,
	attributeNamePrefix: '',
	preserveOrder: true,
	cdataPropName: '__cdata',
	commentPropName: '__xmlComment',
	allowBooleanAttributes: true,
	trimValues: true,
};
const xmlBuilderOptions: XmlBuilderOptions = {
	ignoreAttributes: xmlParserOptions.ignoreAttributes,
	attributeNamePrefix: xmlParserOptions.attributeNamePrefix,
	preserveOrder: xmlParserOptions.preserveOrder,
	cdataPropName: xmlParserOptions.cdataPropName,
	commentPropName: xmlParserOptions.commentPropName,
	suppressBooleanAttributes: !xmlParserOptions.allowBooleanAttributes,
	format: true,
	indentBy: '\t',
};

/**
 * Implement necessary parameters and path mappings in IDE configuration files.
 *
 * @param name The configuration name.
 * @param mounts The Playground CLI mount options.
 */
export async function addXdebugIDEConfig({
	name,
	host,
	port,
	ides,
	mounts,
}: IDEConfig) {
	const mappings = filterLocalMounts(mounts);

	// PHPstorm
	if (ides.includes('phpstorm')) {
		const serverElement = {
			server: [
				{
					path_mappings: mappings.map((mapping) => ({
						mapping: [],
						':@': {
							'local-root': `$PROJECT_DIR$/${mapping.hostPath.replace(
								/^\.\/?/,
								''
							)}`,
							'remote-root': mapping.vfsPath,
						},
					})),
				},
			],
			':@': {
				name,
				// NOTE: If we pass Playground's host and port separately here,
				// eliminating the `port: '80'` config, PhpStorm fails to hit breakpoints
				// from Playground's Xdebug setup.
				// TODO: Why is this? Is there something about how the Playground Xdebug
				// feature is implemented that requires this? Could we fix it?
				host: `${host}:${port}`,
				port: '80',
				use_path_mappings: 'true',
			},
		};

		const configFilePath = path.join(process.cwd(), '.idea/workspace.xml');

		if (!fs.existsSync(configFilePath)) {
			const dirname = path.dirname(configFilePath);
			if (!fs.existsSync(dirname)) {
				if (ides.length > 1) return;

				fs.mkdirSync(dirname);
			}
			fs.writeFileSync(
				configFilePath,
				'<?xml version="1.0" encoding="UTF-8"?>\n<project version="4">\n</project>'
			);
		}

		const contents = fs.readFileSync(configFilePath, 'utf8');
		const xmlParser = new XMLParser(xmlParserOptions);
		// NOTE: Using an IIFE so `config` can remain const.
		const config = (() => {
			try {
				return xmlParser.parse(contents, true);
			} catch (e) {
				logger.error(e);
				throw new Error(
					'There was an error parsing PhpStorm workspace.xml.'
				);
			}
		})();

		let projectElement = config?.find((c: any) => c?.project !== undefined);
		if (projectElement) {
			const projectVersion = projectElement[':@']?.version;
			if (projectVersion === undefined) {
				throw new Error(
					'PhpStorm IDE integration only supports <project version="4"> in workspace.xml, ' +
						'but the <project> configuration has no version number.'
				);
			} else if (projectVersion !== '4') {
				throw new Error(
					'PhpStorm IDE integration only supports <project version="4"> in workspace.xml, ' +
						`but we found a <project> configuration with version "${projectVersion}".`
				);
			}
		}
		if (projectElement === undefined) {
			projectElement = {
				project: [],
				':@': { version: '4' },
			};
			config.push(projectElement);
		}

		let componentElement = projectElement.project.find(
			(c: any) =>
				c?.component !== undefined && c?.[':@']?.name === 'PhpServers'
		);
		if (componentElement === undefined) {
			componentElement = {
				component: [],
				':@': { name: 'PhpServers' },
			};
			projectElement.project.push(componentElement);
		}

		let serversElement = componentElement.component.find(
			(c: any) => c?.servers !== undefined
		);
		if (serversElement === undefined) {
			serversElement = { servers: [] };
			componentElement.component.push(serversElement);
		}

		const serverElementIndex = serversElement.servers.findIndex(
			(c: any) => c?.server !== undefined && c?.[':@']?.name === name
		);
		if (serverElementIndex === -1) {
			serversElement.servers.push(serverElement);
		} else {
			serversElement.servers[serverElementIndex] = serverElement;
		}

		const xmlBuilder = new XMLBuilder(xmlBuilderOptions);
		const xml = xmlBuilder.build(config);

		fs.writeFileSync(configFilePath, xml);
	}

	// VSCode
	if (ides.includes('vscode')) {
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

		const configFilePath = path.join(process.cwd(), '.vscode/launch.json');

		if (!fs.existsSync(configFilePath)) {
			const dirname = path.dirname(configFilePath);
			if (!fs.existsSync(dirname)) {
				if (ides.length > 1) return;

				fs.mkdirSync(dirname);
			}
			fs.writeFileSync(configFilePath, '{\n    "configurations": []\n}');
		}

		const errors: JSONC.ParseError[] = [];

		let content = fs.readFileSync(configFilePath, 'utf-8');
		let root = JSONC.parseTree(content, errors, {
			allowEmptyContent: true,
			allowTrailingComma: true,
		});

		if (!root || errors.length) {
			logger.error(errors);
			throw new Error('VSCode configuration file is not valid JSON.');
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
export async function clearXdebugIDEConfig(name: string) {
	const phpStormConfigFilePath = path.join(
		process.cwd(),
		'.idea/workspace.xml'
	);
	if (fs.existsSync(phpStormConfigFilePath)) {
		const contents = fs.readFileSync(phpStormConfigFilePath, 'utf8');
		const xmlParser = new XMLParser(xmlParserOptions);
		// NOTE: Using an IIFE so `config` can remain const.
		const config = (() => {
			try {
				return xmlParser.parse(contents, true);
			} catch (e) {
				logger.error(e);
				throw new Error(
					'There was an error parsing PhpStorm workspace.xml.'
				);
			}
		})();

		const projectElement = config.find(
			(c: any) => c?.project !== undefined
		);
		const componentElement = projectElement?.project.find(
			(c: any) =>
				c?.component !== undefined && c?.[':@']?.name === 'PhpServers'
		);
		const serversElement = componentElement?.component.find(
			(c: any) => c?.servers !== undefined
		);
		const serverElementIndex = serversElement?.servers.findIndex(
			(c: any) => c?.server !== undefined && c?.[':@']?.name === name
		);

		if (serversElement && serverElementIndex >= 0) {
			serversElement.servers.splice(serverElementIndex, 1);

			const xmlBuilder = new XMLBuilder(xmlBuilderOptions);
			const xml = xmlBuilder.build(config);
			fs.writeFileSync(phpStormConfigFilePath, xml);
		}
	}

	const vsCodeConfigFilePath = path.join(
		process.cwd(),
		'.vscode/launch.json'
	);
	// VSCode
	if (fs.existsSync(vsCodeConfigFilePath)) {
		const errors: JSONC.ParseError[] = [];

		const content = fs.readFileSync(vsCodeConfigFilePath, 'utf-8');
		const root = JSONC.parseTree(content, errors, {
			allowEmptyContent: true,
			allowTrailingComma: true,
		});

		if (!root || errors.length) {
			logger.error(errors);
			throw new Error('VSCode configuration file is not valid JSON.');
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

			if (json === '{\n    "configurations": []\n}') {
				fs.unlinkSync(vsCodeConfigFilePath);
			} else {
				fs.writeFileSync(vsCodeConfigFilePath, json);
			}
		}
	}
}
