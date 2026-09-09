import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { createRequire } from 'module';
import { playgroundMcpProfile } from './playground-mcp-profile';
import type {
	McpServerDefinition,
	McpServerPromptDefinition,
} from './mcp-server-profile';

export type {
	McpServerDefinition,
	McpServerPromptDefinition,
} from './mcp-server-profile';

export interface McpServerExtension {
	prompts?: McpServerPromptDefinition[];
	registerTools?: (server: McpServer) => void;
}

export interface CreateMcpServerOptions {
	definition?: McpServerDefinition;
	extensions?: McpServerExtension[];
}

const require = createRequire(import.meta.url);
let packageVersion: string;
try {
	packageVersion = require('./package.json').version;
} catch {
	// In the development environment, the package.json file is located in the parent directory.
	packageVersion = require('../package.json').version;
}

export function createServer(options: CreateMcpServerOptions = {}): McpServer {
	const serverDefinition = options.definition ?? playgroundMcpProfile;
	const extensions = options.extensions ?? [];
	const server = new McpServer({
		name: serverDefinition.name,
		version: packageVersion,
		description: serverDefinition.description,
	});
	registerPrompts(server, [
		...serverDefinition.prompts,
		...extensions.flatMap((extension) => extension.prompts ?? []),
	]);
	for (const extension of extensions) {
		extension.registerTools?.(server);
	}
	return server;
}

function registerPrompts(
	server: McpServer,
	prompts: McpServerPromptDefinition[]
) {
	for (const prompt of prompts) {
		server.registerPrompt(
			prompt.name,
			{
				title: prompt.title,
				description: prompt.description,
			},
			async () => promptMessages(prompt.text)
		);
	}
}

function promptMessages(text: string) {
	return {
		messages: [
			{
				role: 'user' as const,
				content: {
					type: 'text' as const,
					text,
				},
			},
		],
	};
}
