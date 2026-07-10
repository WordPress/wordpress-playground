export interface PlaygroundDetection {
	hasPlayground: boolean;
	documentRoot?: string;
	playgroundGeneration?: string;
}

export type PlaygroundMethodResult =
	| { result: unknown; error?: never }
	| { result?: never; error: string };

/**
 * Detects the current main-world Playground object and assigns it a stable generation.
 *
 * This function is passed to chrome.scripting.executeScript. Keep it self-contained:
 * references to module-scoped values are not available in the inspected page.
 */
export function detectPlaygroundInMainWorld(
	stateKey: string
): PlaygroundDetection {
	const playground = (window as any).playground;
	const hasPlayground = playground != null;
	let documentRoot: string | undefined = undefined;
	let playgroundGeneration: string | undefined = undefined;
	const stateSymbol = Symbol.for(stateKey);
	const stateHost = window as unknown as Record<PropertyKey, unknown>;
	if (hasPlayground) {
		type PlaygroundState = {
			playground: unknown;
			generation: string;
		};
		let state = stateHost[stateSymbol] as PlaygroundState | undefined;
		if (!state || state.playground !== playground) {
			state = {
				playground,
				generation: Array.from(
					crypto.getRandomValues(new Uint32Array(4)),
					(part) => part.toString(16).padStart(8, '0')
				).join(''),
			};
			stateHost[stateSymbol] = state;
		}
		playgroundGeneration = state.generation;
		if (typeof playground.documentRoot === 'string') {
			documentRoot = playground.documentRoot;
		}
	} else {
		delete stateHost[stateSymbol];
	}
	return {
		hasPlayground,
		documentRoot,
		playgroundGeneration,
	};
}

/**
 * Invokes one method only if window.playground still owns the expected generation.
 *
 * This function is passed to chrome.scripting.executeScript. Keep it self-contained:
 * references to module-scoped values are not available in the inspected page.
 */
export async function executePlaygroundMethodInMainWorld(
	methodName: string,
	methodArgs: unknown[],
	expectedGeneration: string,
	stateKey: string
): Promise<PlaygroundMethodResult> {
	try {
		const playground = (window as any).playground;
		const stateHost = window as unknown as Record<PropertyKey, unknown>;
		const state = stateHost[Symbol.for(stateKey)] as
			| {
					playground: unknown;
					generation: string;
			  }
			| undefined;
		if (
			!playground ||
			!state ||
			state.playground !== playground ||
			state.generation !== expectedGeneration
		) {
			throw new Error(
				'The selected Playground instance is no longer available.'
			);
		}
		if (typeof playground[methodName] !== 'function') {
			throw new Error(
				`Method ${methodName} is not a function on window.playground`
			);
		}
		let result = await playground[methodName](...methodArgs);
		// Handle ArrayBuffer/Uint8Array results by converting to array
		if (result instanceof Uint8Array) {
			result = {
				__type: 'Uint8Array',
				data: Array.from(result),
			};
		} else if (result instanceof ArrayBuffer) {
			result = {
				__type: 'Uint8Array',
				data: Array.from(new Uint8Array(result)),
			};
		}
		return { result };
	} catch (error) {
		return {
			error: error instanceof Error ? error.message : String(error),
		};
	}
}
