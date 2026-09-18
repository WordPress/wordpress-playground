import fs from 'fs';
import path from 'path';
import { toPosixPath } from '@php-wasm/util';
import type { Mount } from './mounts';
import {
	type X2jOptions,
	type XmlBuilderOptions,
	XMLParser,
	XMLBuilder,
} from 'fast-xml-parser';
import * as JSONC from 'jsonc-parser';

export interface XdebugOptions {
	ideKey?: string;
	pathMappings?: Mount[];
	pathSkippings?: string[];
}

export const DEFAULT_IDE_KEY = 'PHPWASMCLI';
export const DEFAULT_PATH_SKIPPINGS = [
	'/dev/',
	'/home/',
	'/internal/',
	'/request/',
	'/proc/',
];

/**
 * Create a symlink to a tempory directory.
 *
 * The symlink is created to access the system temp dir
 * inside the current debugging directory.
 *
 * @param nativeDirPath The system temp dir path.
 * @param symlinkPath The symlink name.
 */
export async function createTempDirSymlink(
	nativeDirPath: string,
	symlinkPath: string,
	platform: string
) {
	const type =
		platform === 'win32'
			? // On Windows, creating a 'dir' symlink can require elevated permissions.
				// In this case, let's make junction points because they function like
				// symlinks and do not require elevated permissions.
				'junction'
			: 'dir';
	fs.symlinkSync(nativeDirPath, symlinkPath, type);
}

/**
 * Remove the given temporary directory symlink if it exists.
 *
 * @param symlinkPath The symlink path.
 */
export async function removeTempDirSymlink(symlinkPath: string) {
	try {
		const stats = fs.lstatSync(symlinkPath);
		if (stats.isSymbolicLink()) {
			fs.unlinkSync(symlinkPath);
		}
	} catch {
		// Symlink does not exist or cannot be accessed, nothing to remove
	}
}

/**
 * Filters out mounts that are not in the current working directory
 *
 * @param mounts The mounts list.
 */
function filterLocalMounts(cwd: string, mounts: Mount[]) {
	return mounts.filter((mount) => {
		const absoluteHostPath = path.resolve(mount.hostPath);
		const cwdChildPrefix = path.join(cwd, path.sep);
		return (
			// If auto-mounting from the current directory,
			// the entire project directory can be mapped.
			absoluteHostPath === cwd ||
			absoluteHostPath.startsWith(cwdChildPrefix)
		);
	});
}

export type XdebugConfig = {
	/**
	 * The current working directory to consider for debugger path mapping.
	 */
	cwd?: string;
	/**
	 * The mounts to consider for debugger path mapping.
	 */
	mounts?: Mount[];
	/**
	 * The paths to consider for debugger path skipping.
	 */
	pathSkippings?: string[];
};

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
	 * The current working directory to consider for debugger path mapping.
	 */
	cwd: string;
	/**
	 * The mounts to consider for debugger path mapping.
	 */
	mounts?: Mount[];
	/**
	 * The paths to skip when debugging.
	 */
	pathSkippings?: string[];
	/**
	 * The IDE key to use for the debug configuration. Defaults to 'PHPWASMCLI'.
	 */
	ideKey?: string;
};

type PhpStormWorkspaceConfigMetaData = {
	name?: string;
	version?: string;
	host?: string;
	use_path_mappings?: string;
	'local-root'?: string;
	'remote-root'?: string;
	type?: 'PhpRemoteDebugRunConfigurationType';
	factoryName?: string;
	filter_connections?: 'FILTER';
	server_name?: string;
	session_id?: string;
	v?: string;
};

type PhpStormWorkspaceConfigNode = {
	':@'?: PhpStormWorkspaceConfigMetaData;
	project?: PhpStormWorkspaceConfigNode[];
	component?: PhpStormWorkspaceConfigNode[];
	servers?: PhpStormWorkspaceConfigNode[];
	server?: PhpStormWorkspaceConfigNode[];
	path_mappings?: PhpStormWorkspaceConfigNode[];
	mapping?: PhpStormWorkspaceConfigNode[];
	configuration?: PhpStormWorkspaceConfigNode[];
	method?: PhpStormWorkspaceConfigNode[];
};

type PhpStormPHPConfigMetaData = {
	name?: string;
	version?: string;
	file?: string;
};

type PhpStormPHPConfigNode = {
	':@'?: PhpStormPHPConfigMetaData;
	project?: PhpStormPHPConfigNode[];
	component?: PhpStormPHPConfigNode[];
	skipped_files?: PhpStormPHPConfigNode[];
	skipped_file?: PhpStormPHPConfigNode[];
};

type VSCodeConfigMetaData = {
	[key: string]: string;
};

type VSCodeConfigNode = {
	name: string;
	type: string;
	request: string;
	port: number;
	pathMappings?: VSCodeConfigMetaData;
	skipFiles?: string[];
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

const jsoncParseOptions: JSONC.ParseOptions = {
	allowEmptyContent: true,
	allowTrailingComma: true,
};

export type PhpStormWorkspaceConfigOptions = {
	name: string;
	host: string;
	port: number;
	projectDir: string;
	pathMappings?: Mount[];
	ideKey: string;
};

/**
 * Pure function to update PHPStorm XML config with Xdebug server and run configuration.
 *
 * @param xmlContent The original XML content of workspace.xml
 * @param options Configuration options for the server
 * @returns Updated XML content
 * @throws Error if XML is invalid or configuration is incompatible
 */
export function updatePhpStormWorkspaceConfig(
	xmlContent: string,
	options: PhpStormWorkspaceConfigOptions
): string {
	const { name, host, port, pathMappings, ideKey } = options;

	const xmlParser = new XMLParser(xmlParserOptions);

	// Parse the XML
	const config: PhpStormWorkspaceConfigNode[] = (() => {
		try {
			return xmlParser.parse(xmlContent, true);
		} catch {
			throw new Error('PhpStorm configuration file is not valid XML.');
		}
	})();

	// Create the server element with path mappings
	const serverElement: PhpStormWorkspaceConfigNode = {
		server: [{}],
		':@': {
			name,
			// NOTE: PhpStorm quirk: Xdebug only works when the full URL (including port)
			// is provided in `host`. The separate `port` field is ignored or misinterpreted,
			// so we rely solely on host: "host:port".
			host: `${host}:${port}`,
			use_path_mappings: 'true',
		},
	};

	if (pathMappings && pathMappings.length) {
		serverElement.server![0].path_mappings = pathMappings.map(
			(pathMapping) => ({
				mapping: [],
				':@': {
					'local-root': `$PROJECT_DIR$/${toPosixPath(
						path.relative(options.projectDir, pathMapping.hostPath)
					)}`,
					'remote-root': pathMapping.vfsPath,
				},
			})
		);
	}

	// Find or create project element
	let projectElement = config?.find(
		(c: PhpStormWorkspaceConfigNode) => !!c?.project
	);
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

	// Find or create PhpServers component
	let componentElement = projectElement.project?.find(
		(c: PhpStormWorkspaceConfigNode) =>
			!!c?.component && c?.[':@']?.name === 'PhpServers'
	);
	if (componentElement === undefined) {
		componentElement = {
			component: [],
			':@': { name: 'PhpServers' },
		};

		if (projectElement.project === undefined) {
			projectElement.project = [];
		}

		projectElement.project.push(componentElement);
	}

	// Find or create servers element
	let serversElement = componentElement.component?.find(
		(c: PhpStormWorkspaceConfigNode) => !!c?.servers
	);
	if (serversElement === undefined) {
		serversElement = { servers: [] };

		if (componentElement.component === undefined) {
			componentElement.component = [];
		}

		componentElement.component.push(serversElement);
	}

	// Check if server already exists
	const serverElementIndex = serversElement.servers?.findIndex(
		(c: PhpStormWorkspaceConfigNode) =>
			!!c?.server && c?.[':@']?.name === name
	);

	// Only add server if it doesn't exist
	if (serverElementIndex === undefined || serverElementIndex < 0) {
		if (serversElement.servers === undefined) {
			serversElement.servers = [];
		}

		serversElement.servers.push(serverElement);
	}

	// Find or create RunManager component
	let runManagerElement = projectElement.project?.find(
		(c: PhpStormWorkspaceConfigNode) =>
			!!c?.component && c?.[':@']?.name === 'RunManager'
	);
	if (runManagerElement === undefined) {
		runManagerElement = {
			component: [],
			':@': { name: 'RunManager' },
		};

		if (projectElement.project === undefined) {
			projectElement.project = [];
		}

		projectElement.project.push(runManagerElement);
	}

	// Check if run configuration already exists
	const existingConfigIndex =
		runManagerElement.component?.findIndex(
			(c: PhpStormWorkspaceConfigNode) =>
				!!c?.configuration && c?.[':@']?.name === name
		) ?? -1;

	// Only add run configuration if it doesn't exist
	if (existingConfigIndex < 0) {
		const runConfigElement: PhpStormWorkspaceConfigNode = {
			configuration: [
				{
					method: [],
					':@': { v: '2' },
				},
			],
			':@': {
				name: name,
				type: 'PhpRemoteDebugRunConfigurationType',
				factoryName: 'PHP Remote Debug',
				filter_connections: 'FILTER',
				server_name: name,
				session_id: ideKey,
			},
		};

		if (runManagerElement.component === undefined) {
			runManagerElement.component = [];
		}

		runManagerElement.component.push(runConfigElement);
	}

	// Build the updated XML
	const xmlBuilder = new XMLBuilder(xmlBuilderOptions);
	const xml = xmlBuilder.build(config);

	// Validate the generated XML
	try {
		xmlParser.parse(xml, true);
	} catch {
		throw new Error(
			'The resulting PhpStorm configuration file is not valid XML.'
		);
	}

	return xml;
}

export type PhpStormPHPConfigOptions = {
	pathSkippings?: string[];
};

/**
 * Pure function to update PhpStorm php.xml config with skipped files.
 *
 * @param xmlContent The original XML content of php.xml
 * @param options Configuration options for skipped files
 * @returns Updated XML content
 * @throws Error if XML is invalid or configuration is incompatible
 */
export function updatePhpStormPHPConfig(
	xmlContent: string,
	options: PhpStormPHPConfigOptions
): string {
	const { pathSkippings } = options;

	const xmlParser = new XMLParser(xmlParserOptions);

	const config: PhpStormPHPConfigNode[] = (() => {
		try {
			return xmlParser.parse(xmlContent, true);
		} catch {
			throw new Error(
				'PhpStorm PHP configuration file is not valid XML.'
			);
		}
	})();

	// Find or create project element
	let projectElement = config?.find(
		(c: PhpStormPHPConfigNode) => !!c?.project
	);
	if (projectElement) {
		const projectVersion = projectElement[':@']?.version;
		if (projectVersion === undefined) {
			throw new Error(
				'PhpStorm IDE integration only supports ' +
					'<project version="4"> in php.xml, ' +
					'but the <project> configuration has no version number.'
			);
		} else if (projectVersion !== '4') {
			throw new Error(
				'PhpStorm IDE integration only supports ' +
					'<project version="4"> in php.xml, ' +
					`but we found a <project> configuration ` +
					`with version "${projectVersion}".`
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

	// Find or create PhpStepFilterConfiguration component
	let componentElement = projectElement.project?.find(
		(c: PhpStormPHPConfigNode) =>
			!!c?.component && c?.[':@']?.name === 'PhpStepFilterConfiguration'
	);
	if (componentElement === undefined) {
		componentElement = {
			component: [],
			':@': { name: 'PhpStepFilterConfiguration' },
		};

		if (projectElement.project === undefined) {
			projectElement.project = [];
		}

		projectElement.project.push(componentElement);
	}

	// Find or create skipped_files element
	let skippedFilesElement = componentElement.component?.find(
		(c: PhpStormPHPConfigNode) => !!c?.skipped_files
	);
	if (skippedFilesElement === undefined) {
		skippedFilesElement = { skipped_files: [] };

		if (componentElement.component === undefined) {
			componentElement.component = [];
		}

		componentElement.component.push(skippedFilesElement);
	}

	// Add skipped files
	if (pathSkippings && pathSkippings.length) {
		for (const skippedPath of pathSkippings) {
			const normalizedPath = skippedPath.endsWith('/')
				? skippedPath.slice(0, -1)
				: skippedPath;
			const filePath = `$PROJECT_DIR$${normalizedPath}`;

			// Check if already exists
			const exists = skippedFilesElement.skipped_files?.some(
				(c: PhpStormPHPConfigNode) =>
					!!c?.skipped_file && c?.[':@']?.file === filePath
			);

			if (!exists) {
				if (skippedFilesElement.skipped_files === undefined) {
					skippedFilesElement.skipped_files = [];
				}

				skippedFilesElement.skipped_files.push({
					skipped_file: [],
					':@': { file: filePath },
				});
			}
		}
	}

	// Build the updated XML
	const xmlBuilder = new XMLBuilder(xmlBuilderOptions);
	const xml = xmlBuilder.build(config);

	// Validate the generated XML
	try {
		xmlParser.parse(xml, true);
	} catch {
		throw new Error(
			'The resulting PhpStorm PHP configuration file ' +
				'is not valid XML.'
		);
	}

	return xml;
}

export type VSCodeConfigOptions = {
	name: string;
	workspaceDir: string;
	pathMappings?: Mount[];
	pathSkippings?: string[];
};

/**
 * Pure function to update VS Code JSON config with Xdebug configuration.
 *
 * @param jsonContent The original JSON content of launch.json
 * @param options Configuration options
 * @returns Updated JSON content
 * @throws Error if JSON is invalid
 */
export function updateVSCodeConfig(
	jsonContent: string,
	options: VSCodeConfigOptions
): string {
	const { name, pathMappings, pathSkippings } = options;

	const errors: JSONC.ParseError[] = [];

	let content = jsonContent;
	let root = JSONC.parseTree(content, errors, jsoncParseOptions);

	if (root === undefined || errors.length) {
		throw new Error('VS Code configuration file is not valid JSON.');
	}

	// Find or create configurations array
	let configurationsNode = JSONC.findNodeAtLocation(root, ['configurations']);

	if (
		configurationsNode === undefined ||
		configurationsNode.children === undefined
	) {
		const edits = JSONC.modify(content, ['configurations'], [], {});
		content = JSONC.applyEdits(content, edits);

		root = JSONC.parseTree(content, [], jsoncParseOptions);
		configurationsNode = JSONC.findNodeAtLocation(root!, [
			'configurations',
		]);
	}

	// Check if configuration already exists
	const configurationIndex = configurationsNode?.children?.findIndex(
		(child: any) =>
			JSONC.findNodeAtLocation(child, ['name'])?.value === name
	);

	// Only add configuration if it doesn't exist
	if (configurationIndex === undefined || configurationIndex < 0) {
		const configuration: VSCodeConfigNode = {
			name: name,
			type: 'php',
			request: 'launch',
			port: 9003,
		};

		if (pathMappings && pathMappings.length) {
			configuration.pathMappings = pathMappings.reduce((acc, mount) => {
				acc[mount.vfsPath] = `\${workspaceFolder}/${toPosixPath(
					path.relative(options.workspaceDir, mount.hostPath)
				)}`;
				return acc;
			}, {} as VSCodeConfigMetaData);
		}

		if (pathSkippings && pathSkippings.length) {
			configuration.skipFiles = pathSkippings.map((skippedPath) =>
				skippedPath.endsWith('/') ? `${skippedPath}**` : skippedPath
			);
		}

		// Get the current length to append at the end
		const currentLength = configurationsNode?.children?.length || 0;

		const edits = JSONC.modify(
			content,
			['configurations', currentLength],
			configuration,
			{
				formattingOptions: {
					insertSpaces: true,
					tabSize: 4,
					eol: '\n',
				},
			}
		);

		content = jsoncApplyEdits(content, edits);
	}

	return content;
}

/**
 * Implement necessary parameters and path mappings in IDE configuration files.
 *
 * @param name The configuration name.
 * @param mounts The mounts options.
 */
export async function addXdebugIDEConfig({
	name,
	ides,
	host,
	port,
	cwd,
	mounts,
	pathSkippings,
	ideKey = DEFAULT_IDE_KEY,
}: IDEConfig) {
	const pathMappings = mounts ? filterLocalMounts(cwd, mounts) : [];
	const modifiedConfig: Record<string, string> = {};

	// PHPstorm
	if (ides.includes('phpstorm')) {
		const phpStormRelativeConfigFilePath = '.idea/workspace.xml';
		const phpStormConfigFilePath = path.join(
			cwd,
			phpStormRelativeConfigFilePath
		);

		// Create a template config file if the IDE directory exists,
		// or throw an error if IDE integration is requested but the directory is missing.
		if (!fs.existsSync(phpStormConfigFilePath)) {
			if (fs.existsSync(path.dirname(phpStormConfigFilePath))) {
				fs.writeFileSync(
					phpStormConfigFilePath,
					'<?xml version="1.0" encoding="UTF-8"?>\n<project version="4">\n</project>'
				);
			} else if (ides.length == 1) {
				throw new Error(
					`PhpStorm IDE integration requested, but no '.idea' directory was found in the current working directory.`
				);
			}
		}

		if (fs.existsSync(phpStormConfigFilePath)) {
			const contents = fs.readFileSync(phpStormConfigFilePath, 'utf8');
			const updatedXml = updatePhpStormWorkspaceConfig(contents, {
				name,
				host,
				port,
				projectDir: cwd,
				pathMappings,
				ideKey,
			});
			fs.writeFileSync(phpStormConfigFilePath, updatedXml);
			modifiedConfig['phpstorm'] = phpStormRelativeConfigFilePath;
		}

		// PhpStorm php.xml (path skippings)
		if (pathSkippings && pathSkippings.length) {
			const phpStormRelativePHPConfigFilePath = '.idea/php.xml';
			const phpStormPHPConfigFilePath = path.join(
				cwd,
				phpStormRelativePHPConfigFilePath
			);

			if (!fs.existsSync(phpStormPHPConfigFilePath)) {
				if (fs.existsSync(path.dirname(phpStormPHPConfigFilePath))) {
					fs.writeFileSync(
						phpStormPHPConfigFilePath,
						'<?xml version="1.0" encoding="UTF-8"?>\n<project version="4">\n</project>'
					);
				}
			}

			if (fs.existsSync(phpStormPHPConfigFilePath)) {
				const contents = fs.readFileSync(
					phpStormPHPConfigFilePath,
					'utf8'
				);
				const updatedXml = updatePhpStormPHPConfig(contents, {
					pathSkippings,
				});
				fs.writeFileSync(phpStormPHPConfigFilePath, updatedXml);
				modifiedConfig['phpstorm-php'] =
					phpStormRelativePHPConfigFilePath;
			}
		}
	}

	// VSCode
	if (ides.includes('vscode')) {
		const vsCodeRelativeConfigFilePath = '.vscode/launch.json';
		const vsCodeConfigFilePath = path.join(
			cwd,
			vsCodeRelativeConfigFilePath
		);

		// Create a template config file if the IDE directory exists,
		// or throw an error if IDE integration is requested but the directory is missing.
		if (!fs.existsSync(vsCodeConfigFilePath)) {
			if (fs.existsSync(path.dirname(vsCodeConfigFilePath))) {
				fs.writeFileSync(
					vsCodeConfigFilePath,
					'{\n    "configurations": []\n}'
				);
			} else if (ides.length == 1) {
				throw new Error(
					`VS Code IDE integration requested, but no '.vscode' directory was found in the current working directory.`
				);
			}
		}

		if (fs.existsSync(vsCodeConfigFilePath)) {
			const content = fs.readFileSync(vsCodeConfigFilePath, 'utf-8');
			const updatedJson = updateVSCodeConfig(content, {
				name,
				workspaceDir: cwd,
				pathMappings,
				pathSkippings,
			});

			// Only write and track the file if changes were made
			if (updatedJson !== content) {
				fs.writeFileSync(vsCodeConfigFilePath, updatedJson);
				modifiedConfig['vscode'] = vsCodeRelativeConfigFilePath;
			}
		}
	}

	return modifiedConfig;
}

/**
 * Remove stale parameters and path mappings in IDE configuration files.
 *
 * @param name The configuration name.
 * @param cwd The current working directory.
 */
export async function clearXdebugIDEConfig(name: string, cwd: string) {
	const phpStormConfigFilePath = path.join(cwd, '.idea/workspace.xml');
	// PhpStorm
	if (fs.existsSync(phpStormConfigFilePath)) {
		const contents = fs.readFileSync(phpStormConfigFilePath, 'utf8');
		const xmlParser = new XMLParser(xmlParserOptions);
		// NOTE: Using an IIFE so `config` can remain const.
		const config: PhpStormWorkspaceConfigNode[] = (() => {
			try {
				return xmlParser.parse(contents, true);
			} catch {
				throw new Error(
					'PhpStorm configuration file is not valid XML.'
				);
			}
		})();

		const projectElement = config.find(
			(c: PhpStormWorkspaceConfigNode) => !!c?.project
		);
		const componentElement = projectElement?.project?.find(
			(c: PhpStormWorkspaceConfigNode) =>
				!!c?.component && c?.[':@']?.name === 'PhpServers'
		);
		const serversElement = componentElement?.component?.find(
			(c: PhpStormWorkspaceConfigNode) => !!c?.servers
		);
		const serverElementIndex = serversElement?.servers?.findIndex(
			(c: PhpStormWorkspaceConfigNode) =>
				!!c?.server && c?.[':@']?.name === name
		);

		if (serverElementIndex !== undefined && serverElementIndex >= 0) {
			serversElement!.servers!.splice(serverElementIndex, 1);

			const xmlBuilder = new XMLBuilder(xmlBuilderOptions);
			const xml = xmlBuilder.build(config);

			try {
				xmlParser.parse(xml, true);
			} catch {
				throw new Error(
					'The resulting PhpStorm configuration file is not valid XML.'
				);
			}

			if (
				xml ===
				'<?xml version="1.0" encoding="UTF-8"?>\n<project version="4">\n	<component name="PhpServers">\n		<servers></servers>\n	</component>\n</project>'
			) {
				fs.unlinkSync(phpStormConfigFilePath);
			} else {
				fs.writeFileSync(phpStormConfigFilePath, xml);
			}
		}
	}

	// PhpStorm php.xml (path skippings)
	const phpStormPHPConfigFilePath = path.join(cwd, '.idea/php.xml');
	if (fs.existsSync(phpStormPHPConfigFilePath)) {
		const contents = fs.readFileSync(phpStormPHPConfigFilePath, 'utf8');
		const xmlParser = new XMLParser(xmlParserOptions);
		const config: PhpStormPHPConfigNode[] = (() => {
			try {
				return xmlParser.parse(contents, true);
			} catch {
				throw new Error(
					'PhpStorm PHP configuration file is not valid XML.'
				);
			}
		})();

		const projectElement = config.find(
			(c: PhpStormPHPConfigNode) => !!c?.project
		);
		const componentIndex = projectElement?.project?.findIndex(
			(c: PhpStormPHPConfigNode) =>
				!!c?.component &&
				c?.[':@']?.name === 'PhpStepFilterConfiguration'
		);

		if (componentIndex !== undefined && componentIndex >= 0) {
			projectElement!.project!.splice(componentIndex, 1);

			const xmlBuilder = new XMLBuilder(xmlBuilderOptions);
			const xml = xmlBuilder.build(config);

			try {
				xmlParser.parse(xml, true);
			} catch {
				throw new Error(
					'The resulting PhpStorm PHP configuration file ' +
						'is not valid XML.'
				);
			}

			if (
				xml ===
				'<?xml version="1.0" encoding="UTF-8"?>\n<project version="4">\n</project>'
			) {
				fs.unlinkSync(phpStormPHPConfigFilePath);
			} else {
				fs.writeFileSync(phpStormPHPConfigFilePath, xml);
			}
		}
	}

	const vsCodeConfigFilePath = path.join(cwd, '.vscode/launch.json');
	// VSCode
	if (fs.existsSync(vsCodeConfigFilePath)) {
		const errors: JSONC.ParseError[] = [];

		const content = fs.readFileSync(vsCodeConfigFilePath, 'utf-8');
		const root = JSONC.parseTree(content, errors, jsoncParseOptions);

		if (root === undefined || errors.length) {
			throw new Error('VS Code configuration file is not valid JSON.');
		}

		const configurationsNode = JSONC.findNodeAtLocation(root, [
			'configurations',
		]);

		const configurationIndex = configurationsNode?.children?.findIndex(
			(child: any) =>
				JSONC.findNodeAtLocation(child, ['name'])?.value === name
		);

		if (configurationIndex !== undefined && configurationIndex >= 0) {
			const edits = JSONC.modify(
				content,
				['configurations', configurationIndex],
				undefined,
				{
					formattingOptions: {
						insertSpaces: true,
						tabSize: 4,
						eol: '\n',
					},
				}
			);

			const json = jsoncApplyEdits(content, edits);
			if (json === '{\n    "configurations": []\n}') {
				fs.unlinkSync(vsCodeConfigFilePath);
			} else {
				fs.writeFileSync(vsCodeConfigFilePath, json);
			}
		}
	}
}

/**
 * Implement path mapping and path skipping in Xdebug.
 *
 * @param name The configuration name.
 * @param mounts The mounts options.
 * @param pathSkippings The skipping paths options.
 * @returns Xdebug options
 */
export function makeXdebugConfig({
	cwd,
	mounts,
	pathSkippings,
}: XdebugConfig): XdebugOptions {
	const pathMappings =
		cwd && mounts ? filterLocalMounts(cwd, mounts) : undefined;

	return { pathMappings, pathSkippings };
}

function jsoncApplyEdits(content: string, edits: JSONC.Edit[]) {
	const errors: JSONC.ParseError[] = [];
	const json = JSONC.applyEdits(content, edits);

	errors.length = 0;

	JSONC.parseTree(json, errors, jsoncParseOptions);

	if (errors.length) {
		const formattedErrors = errors
			.map((error) => {
				return {
					message: JSONC.printParseErrorCode(error.error),
					offset: error.offset,
					length: error.length,
					fragment: json.slice(
						Math.max(0, error.offset - 20),
						Math.min(json.length, error.offset + error.length + 10)
					),
				};
			})
			.map(
				(error) =>
					`${error.message} at ${error.offset}:${error.length} (${error.fragment})`
			);
		const formattedEdits = edits.map(
			(edit) => `At ${edit.offset}:${edit.length} - (${edit.content})`
		);
		throw new Error(
			`VS Code configuration file (.vscode/launch.json) is not valid a JSONC after CLI modifications. This is likely ` +
				`a CLI bug. Please report it at https://github.com/WordPress/wordpress-playground/issues and include the contents ` +
				`of your ".vscode/launch.json" file. \n\n Applied edits: ${formattedEdits.join(
					'\n'
				)}\n\n The errors are: ${formattedErrors.join('\n')}`
		);
	}

	return json;
}
