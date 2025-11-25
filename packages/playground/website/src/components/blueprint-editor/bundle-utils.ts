import { normalizePath } from '@php-wasm/util';

export function ensureAbsolutePath(path: string): string {
	let normalized = normalizePath(path || '/');
	if (!normalized || normalized === '.') {
		normalized = '/';
	}
	if (!normalized.startsWith('/')) {
		normalized = `/${normalized}`;
	}
	if (normalized === '//') {
		return '/';
	}
	return normalized;
}

export function collectBundledResourcePaths(value: unknown): Set<string> {
	const accumulator = new Set<string>();
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
			accumulator.add(ensureAbsolutePath(candidate.path));
		}

		for (const child of Object.values(current)) {
			stack.push(child);
		}
	}

	return accumulator;
}
