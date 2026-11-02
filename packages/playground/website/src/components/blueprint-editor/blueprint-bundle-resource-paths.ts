import { ensureAbsolutePath } from '@php-wasm/util';

/**
 * Finds files that must be copied out of a Blueprint bundle before editing.
 *
 * V1 declarations spell bundle files as `{ "resource": "bundled" }`. V2
 * keeps those references as execution-context paths (`./file.zip` or
 * `/file.zip`) until compile time, so the editor has to preserve both shapes.
 */
export function collectBlueprintBundleResourcePaths(
	value: unknown
): Set<string> {
	const accumulator = new Set<string>();
	collectV1BundledResourcePaths(value, accumulator);
	collectV2ExecutionContextResourcePaths(value, accumulator);
	return accumulator;
}

/**
 * Walks the whole Blueprint tree to find legacy `{ resource: "bundled" }`
 * declarations, regardless of which step owns them.
 */
function collectV1BundledResourcePaths(
	value: unknown,
	accumulator: Set<string>
): void {
	const stack: unknown[] = [value];
	while (stack.length) {
		const current = stack.pop();
		if (!current || typeof current !== 'object') {
			continue;
		}

		if (Array.isArray(current)) {
			for (const item of current) {
				stack.push(item);
			}
			continue;
		}

		const candidate = current as { resource?: unknown; path?: unknown };
		if (
			candidate.resource === 'bundled' &&
			typeof candidate.path === 'string'
		) {
			addBundlePath(candidate.path, accumulator);
		}

		for (const child of Object.values(current)) {
			stack.push(child);
		}
	}
}

/**
 * Collects the bundle-backed fields that Blueprint v2 keeps as raw
 * execution-context paths until compile time.
 */
function collectV2ExecutionContextResourcePaths(
	value: unknown,
	accumulator: Set<string>
): void {
	if (!isRecord(value) || value.version !== 2) {
		return;
	}

	collectDataReference(value.activeTheme, accumulator);
	collectDataReferenceList(value.themes, accumulator);
	collectDataReferenceList(value.plugins, accumulator);
	collectDataReferenceList(value.muPlugins, accumulator);
	collectExecutionContextStrings(value.fonts, accumulator);
	collectPostTypes(value.postTypes, accumulator);
	collectMediaDefinitions(value.media, accumulator);
	collectContentDefinitions(value.content, accumulator);
	collectAdditionalSteps(value.additionalStepsAfterExecution, accumulator);
}

/**
 * Reads arrays of v2 data references, such as `plugins`, `themes`, or
 * `muPlugins`.
 */
function collectDataReferenceList(
	value: unknown,
	accumulator: Set<string>
): void {
	if (!Array.isArray(value)) {
		return;
	}
	for (const item of value) {
		collectDataReference(item, accumulator);
	}
}

/**
 * Reads one v2 data reference shape: a string path, a list, or an object with a
 * nested `source` reference.
 */
function collectDataReference(value: unknown, accumulator: Set<string>): void {
	if (typeof value === 'string') {
		addV2ExecutionContextPath(value, accumulator);
		return;
	}
	if (Array.isArray(value)) {
		for (const item of value) {
			collectDataReference(item, accumulator);
		}
		return;
	}
	if (!isRecord(value)) {
		return;
	}
	collectDataReference(value.source, accumulator);
}

/**
 * Reads v2 `postTypes`, whose values may point at JSON files in the bundle.
 */
function collectPostTypes(value: unknown, accumulator: Set<string>): void {
	if (!isRecord(value)) {
		return;
	}
	for (const postType of Object.values(value)) {
		if (typeof postType === 'string') {
			addV2ExecutionContextPath(postType, accumulator);
		}
	}
}

/**
 * Reads v2 media entries, each of which follows the same reference forms as
 * plugin and theme sources.
 */
function collectMediaDefinitions(
	value: unknown,
	accumulator: Set<string>
): void {
	if (!Array.isArray(value)) {
		return;
	}
	for (const item of value) {
		collectDataReference(item, accumulator);
	}
}

/**
 * Reads v2 content import entries and records any bundled source files they
 * reference.
 */
function collectContentDefinitions(
	value: unknown,
	accumulator: Set<string>
): void {
	if (!Array.isArray(value)) {
		return;
	}
	for (const item of value) {
		if (!isRecord(item)) {
			continue;
		}
		collectDataReference(item.source, accumulator);
	}
}

/**
 * Reads v2 additional steps, whose nested properties reuse several different
 * bundle reference shapes.
 */
function collectAdditionalSteps(
	value: unknown,
	accumulator: Set<string>
): void {
	if (!Array.isArray(value)) {
		return;
	}
	for (const step of value) {
		if (!isRecord(step)) {
			continue;
		}
		collectDataReference(step, accumulator);
		collectDataReference(step.code, accumulator);
		collectDataReference(step.source, accumulator);
		collectDataReference(step.zipFile, accumulator);
		collectContentDefinitions(step.content, accumulator);
		collectMediaDefinitions(step.media, accumulator);
		collectWriteFiles(step.files, accumulator);
	}
}

/**
 * Reads v2 `writeFiles` values, which may map target filenames to bundled
 * source files.
 */
function collectWriteFiles(value: unknown, accumulator: Set<string>): void {
	if (!isRecord(value)) {
		return;
	}
	for (const file of Object.values(value)) {
		collectDataReference(file, accumulator);
	}
}

/**
 * Recursively finds execution-context strings in arbitrary v2 option objects,
 * such as nested font-face definitions.
 */
function collectExecutionContextStrings(
	value: unknown,
	accumulator: Set<string>
): void {
	if (typeof value === 'string') {
		addV2ExecutionContextPath(value, accumulator);
		return;
	}
	if (!value || typeof value !== 'object') {
		return;
	}
	if (Array.isArray(value)) {
		for (const item of value) {
			collectExecutionContextStrings(item, accumulator);
		}
		return;
	}
	for (const child of Object.values(value)) {
		collectExecutionContextStrings(child, accumulator);
	}
}

/**
 * Converts a valid v2 execution-context path into the absolute bundle path
 * stored in the accumulator.
 */
function addV2ExecutionContextPath(
	path: string,
	accumulator: Set<string>
): void {
	if (!isV2ExecutionContextPath(path)) {
		return;
	}
	addBundlePath(path, accumulator);
}

/**
 * Adds a bundle path after normalizing it to the bundle filesystem root.
 */
function addBundlePath(path: string, accumulator: Set<string>): void {
	if (path.includes('\0')) {
		return;
	}
	const absolutePath = ensureAbsolutePath(path);
	if (absolutePath !== '/') {
		accumulator.add(absolutePath);
	}
}

/**
 * Checks whether a string is a v2 bundle-local execution-context
 * path rather than a package slug or remote URL.
 */
function isV2ExecutionContextPath(path: string): boolean {
	if (!(path.startsWith('./') || path.startsWith('/'))) {
		return false;
	}
	return true;
}

/**
 * Narrows arbitrary JSON-like values to plain object records for property reads.
 */
function isRecord(value: unknown): value is Record<string, unknown> {
	return !!value && typeof value === 'object' && !Array.isArray(value);
}
