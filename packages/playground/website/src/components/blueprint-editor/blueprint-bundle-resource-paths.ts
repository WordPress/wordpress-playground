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

function collectWriteFiles(value: unknown, accumulator: Set<string>): void {
	if (!isRecord(value)) {
		return;
	}
	for (const file of Object.values(value)) {
		collectDataReference(file, accumulator);
	}
}

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

function addV2ExecutionContextPath(
	path: string,
	accumulator: Set<string>
): void {
	if (!isV2ExecutionContextPath(path)) {
		return;
	}
	addBundlePath(path.replace(/^\.?\/+/, ''), accumulator);
}

function addBundlePath(path: string, accumulator: Set<string>): void {
	if (!path || path.includes('\0')) {
		return;
	}
	const absolutePath = ensureAbsolutePath(path);
	if (absolutePath !== '/') {
		accumulator.add(absolutePath);
	}
}

function isV2ExecutionContextPath(path: string): boolean {
	if (!(path.startsWith('./') || path.startsWith('/'))) {
		return false;
	}
	return !path.replace(/\\/g, '/').split('/').includes('..');
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return !!value && typeof value === 'object' && !Array.isArray(value);
}
