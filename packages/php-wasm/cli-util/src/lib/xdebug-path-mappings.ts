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
	 * The IDE key to use for the debug configuration. Defaults to 'PLAYGROUNDCLI'.
	 */
	ideKey?: string;
};

type PhpStormConfigMetaData = {
	name?: string;
	version?: string;
	host?: string;
	use_path_mappings?: string;
	'local-root'?: string;
	'remote-root'?: string;
	/**
	 * The type of the server.
	 */
	type?: 'PhpRemoteDebugRunConfigurationType';
	factoryName?: string;
	filter_connections?: 'FILTER';
	server_name?: string;
	session_id?: string;
	v?: string;
};

type PhpStormConfigNode = {
	':@'?: PhpStormConfigMetaData;
	project?: PhpStormConfigNode[];
	component?: PhpStormConfigNode[];
	servers?: PhpStormConfigNode[];
	server?: PhpStormConfigNode[];
	path_mappings?: PhpStormConfigNode[];
	mapping?: PhpStormConfigNode[];
	configuration?: PhpStormConfigNode[];
	method?: PhpStormConfigNode[];
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

export type PhpStormConfigOptions = {
	name: string;
	host: string;
	port: number;
	projectDir: string;
	mappings?: Mount[];
	ideKey: string;
};

/**
 * Pure function to update PHPStorm XML config with XDebug server and run configuration.
 *
 * @param xmlContent The original XML content of workspace.xml
 * @param options Configuration options for the server
 * @returns Updated XML content
 * @throws Error if XML is invalid or configuration is incompatible
 */
export function updatePhpStormConfig(
	xmlContent: string,
	options: PhpStormConfigOptions
): string {
	const { name, host, port, mappings, ideKey } = options;

	const xmlParser = new XMLParser(xmlParserOptions);

	// Parse the XML
	const config: PhpStormConfigNode[] = (() => {
		try {
			return xmlParser.parse(xmlContent, true);
		} catch {
			throw new Error('PhpStorm configuration file is not valid XML.');
		}
	})();

	// Create the server element with path mappings
	const serverElement: PhpStormConfigNode = {
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

	if (mappings && mappings.length) {
		serverElement.server![0].path_mappings = mappings.map((mapping) => ({
			mapping: [],
			':@': {
				'local-root': `$PROJECT_DIR$/${toPosixPath(
					path.relative(options.projectDir, mapping.hostPath)
				)}`,
				'remote-root': mapping.vfsPath,
			},
		}));
	}

	// Find or create project element
	let projectElement = config?.find((c: PhpStormConfigNode) => !!c?.project);
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
		(c: PhpStormConfigNode) =>
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
		(c: PhpStormConfigNode) => !!c?.servers
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
		(c: PhpStormConfigNode) => !!c?.server && c?.[':@']?.name === name
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
		(c: PhpStormConfigNode) =>
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
			(c: PhpStormConfigNode) =>
				!!c?.configuration && c?.[':@']?.name === name
		) ?? -1;

	// Only add run configuration if it doesn't exist
	if (existingConfigIndex < 0) {
		const runConfigElement: PhpStormConfigNode = {
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

export type VSCodeConfigOptions = {
	name: string;
	workspaceDir: string;
	mappings?: Mount[];
};

/**
 * Pure function to update VS Code launch.json config with XDebug configuration.
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
	const { name, mappings } = options;

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

		if (mappings && mappings.length) {
			configuration.pathMappings = mappings.reduce((acc, mount) => {
				acc[mount.vfsPath] = `\${workspaceFolder}/${toPosixPath(
					path.relative(options.workspaceDir, mount.hostPath)
				)}`;
				return acc;
			}, {} as VSCodeConfigMetaData);
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
	ideKey = 'PHPWASMCLI',
}: IDEConfig) {
	const mappings = mounts ? filterLocalMounts(cwd, mounts) : [];
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
			const updatedXml = updatePhpStormConfig(contents, {
				name,
				host,
				port,
				projectDir: cwd,
				mappings,
				ideKey,
			});
			fs.writeFileSync(phpStormConfigFilePath, updatedXml);
			modifiedConfig['phpstorm'] = phpStormRelativeConfigFilePath;
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
				mappings,
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
		const config: PhpStormConfigNode[] = (() => {
			try {
				return xmlParser.parse(contents, true);
			} catch {
				throw new Error(
					'PhpStorm configuration file is not valid XML.'
				);
			}
		})();

		const projectElement = config.find(
			(c: PhpStormConfigNode) => !!c?.project
		);
		const componentElement = projectElement?.project?.find(
			(c: PhpStormConfigNode) =>
				!!c?.component && c?.[':@']?.name === 'PhpServers'
		);
		const serversElement = componentElement?.component?.find(
			(c: PhpStormConfigNode) => !!c?.servers
		);
		const serverElementIndex = serversElement?.servers?.findIndex(
			(c: PhpStormConfigNode) => !!c?.server && c?.[':@']?.name === name
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
