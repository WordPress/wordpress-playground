import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { cpSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { after, test } from 'node:test';

const dist = new URL('../../../../../dist/', import.meta.url);
const fixture = new URL(`mcp-client-types-${randomUUID()}/`, dist);
const mcp = new URL('node_modules/@wp-playground/mcp/', fixture);
const remote = new URL('node_modules/@wp-playground/remote/', fixture);

after(() => rmSync(fixture, { recursive: true, force: true }));

mkdirSync(mcp, { recursive: true });
cpSync(new URL('packages/playground/mcp/', dist), mcp, { recursive: true });
mkdirSync(remote, { recursive: true });
writeFileSync(
	new URL('package.json', remote),
	JSON.stringify({ type: 'module', types: './index.d.ts' })
);
writeFileSync(
	new URL('index.d.ts', remote),
	'export interface PlaygroundClient {}\nexport interface WebMCPToolDescriptor {}\n'
);
writeFileSync(
	new URL('tsconfig.json', fixture),
	JSON.stringify({
		compilerOptions: {
			noEmit: true,
			strict: true,
			target: 'es2021',
			types: [],
		},
		files: ['consumer.mts', 'consumer.cts'],
	})
);
writeFileSync(
	new URL('consumer.mts', fixture),
	`import { registerWebMCPTools, unregisterWebMCPTools, startMcpBridge, startWebMCPSiteToolProxy, getModelContext } from '@wp-playground/mcp/client';
import type { PlaygroundBridgeConfig, McpBridgeHandle, WebMCPSiteToolProxy } from '@wp-playground/mcp/client';
declare const config: PlaygroundBridgeConfig;
const result: Promise<void> = registerWebMCPTools(config);
unregisterWebMCPTools();
// @ts-expect-error A configuration is required.
registerWebMCPTools();
void [result, startMcpBridge, startWebMCPSiteToolProxy, getModelContext];
export type Handles = [McpBridgeHandle, WebMCPSiteToolProxy];
`
);
writeFileSync(
	new URL('consumer.cts', fixture),
	`import client = require('@wp-playground/mcp/client');
declare const config: client.PlaygroundBridgeConfig;
const result: Promise<void> = client.registerWebMCPTools(config);
client.unregisterWebMCPTools();
// @ts-expect-error A configuration is required.
client.registerWebMCPTools();
void [result, client.startMcpBridge, client.startWebMCPSiteToolProxy, client.getModelContext];
export type Handles = [client.McpBridgeHandle, client.WebMCPSiteToolProxy];
`
);

for (const mode of ['node16', 'nodenext']) {
	test(`the built client types work with ${mode} resolution`, () => {
		execFileSync(
			process.execPath,
			[
				fileURLToPath(
					new URL(
						'../../../../../node_modules/typescript/bin/tsc',
						import.meta.url
					)
				),
				'--project',
				fileURLToPath(new URL('tsconfig.json', fixture)),
				'--module',
				mode,
				'--moduleResolution',
				mode,
			],
			{ encoding: 'utf8' }
		);
	});
}
