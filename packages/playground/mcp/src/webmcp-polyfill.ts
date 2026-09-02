/**
 * A `document.modelContext` implementation for browsers that have none.
 *
 * WebMCP is a draft proposal. Chrome ships it behind
 * `chrome://flags/#enable-webmcp-testing`, and no other browser implements it,
 * so without a polyfill Playground has nowhere to register its tools and
 * anything driving the page — an extension, a userscript, a test — has nothing
 * to read.
 *
 * This is a registry, not an agent: it holds the tools and hands them to
 * whoever asks. Callers invoke a tool by calling its `execute()`.
 *
 *     document.modelContext.tools.map((tool) => tool.name);
 *     await document.modelContext.tools
 *         .find((tool) => tool.name === 'playground_execute_php')
 *         .execute({ code: '<?php echo 1;' });
 *
 * It mirrors the registry the mu-plugin installs inside the WordPress
 * document, and defers to the browser wherever WebMCP is native.
 *
 * @see packages/playground/remote/src/lib/playground-mu-plugin/0-playground.php
 */

import { logger } from '@php-wasm/logger';
import type {
	ModelContext,
	ModelContextClient,
	ModelContextTool,
} from './webmcp';

/**
 * Installs the polyfill unless the browser provides WebMCP itself.
 *
 * @returns Whether `document.modelContext` is available afterwards.
 */
export function installWebMCPPolyfill(): boolean {
	if (typeof document === 'undefined') {
		return false;
	}
	if (typeof document.modelContext?.registerTool === 'function') {
		return true;
	}

	const tools = new Map<string, ModelContextTool>();

	function addTool(
		tool: ModelContextTool,
		options?: { signal?: AbortSignal }
	) {
		if (!tool?.name || typeof tool.execute !== 'function') {
			throw new TypeError(
				'A WebMCP tool needs a name and an execute() function.'
			);
		}
		tools.set(tool.name, tool);
		const signal = options?.signal;
		if (!signal) {
			return;
		}
		if (signal.aborted) {
			tools.delete(tool.name);
			return;
		}
		signal.addEventListener('abort', () => {
			// Only the registration that owns the name may withdraw it: a
			// re-registration under the same name supersedes this one.
			if (tools.get(tool.name) === tool) {
				tools.delete(tool.name);
			}
		});
	}

	const modelContext: ModelContext = {
		get tools() {
			return Array.from(tools.values());
		},
		registerTool(tool, options) {
			addTool(tool, options);
			return Promise.resolve();
		},
		provideContext({ tools: provided }) {
			tools.clear();
			for (const tool of provided ?? []) {
				addTool(tool);
			}
		},
	};

	try {
		Object.defineProperty(document, 'modelContext', {
			configurable: true,
			value: modelContext,
		});
	} catch (error) {
		// A non-configurable `modelContext` cannot be replaced. Callers wire
		// up the MCP bridge right after this, so failing loudly here would
		// cost them the parts that do not need WebMCP at all.
		logger.warn('Failed to install the WebMCP polyfill:', error);
		return false;
	}
	return true;
}

/**
 * The `client` argument a WebMCP agent passes to `execute()`. Playground's own
 * tools ignore it, and a caller reaching a tool through the polyfill has no
 * agent to prompt through, so user interaction runs the callback directly.
 */
export const polyfillToolClient: ModelContextClient = {
	requestUserInteraction: (callback) => Promise.resolve().then(callback),
};
