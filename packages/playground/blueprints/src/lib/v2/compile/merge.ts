import type { BlueprintV2Declaration } from '../types';
import { BlueprintMergeConflictError } from '../types';

/**
 * Merges multiple V2 blueprint declarations into a single
 * declaration following the spec's composition rules.
 *
 * Merge strategy by property:
 * - `version`: assert all same
 * - `blueprintMeta`, `$schema`: ignored (dropped)
 * - `siteLanguage`, `activeTheme`: conflict if both define
 *   different values
 * - `constants`, `siteOptions`, `postTypes`, `fonts`: append
 *   key-value pairs, fail on key conflicts
 * - `phpVersion`, `wordpressVersion`: intersect ranges
 * - `plugins`, `themes`, `muPlugins`: merge by slug
 * - `additionalStepsAfterExecution`, `content`, `media`:
 *   append arrays
 * - `users`: merge by username, fail on role conflicts
 * - `roles`: merge by name, fail on capability conflicts
 */
export function mergeBlueprintsV2(
	blueprints: BlueprintV2Declaration[]
): BlueprintV2Declaration {
	if (blueprints.length === 0) {
		return { version: 2 } as BlueprintV2Declaration;
	}
	if (blueprints.length === 1) {
		return { ...blueprints[0] };
	}

	const result: Record<string, unknown> = { version: 2 };

	for (const bp of blueprints) {
		assertVersion(bp);
		mergeScalarExclusive(result, bp, 'siteLanguage');
		mergeScalarExclusive(result, bp, 'activeTheme');
		mergeKeyValueMap(result, bp, 'constants');
		mergeKeyValueMap(result, bp, 'siteOptions');
		mergeKeyValueMap(result, bp, 'postTypes');
		mergeKeyValueMap(result, bp, 'fonts');
		mergeVersionConstraint(result, bp, 'phpVersion');
		mergeVersionConstraint(result, bp, 'wordpressVersion');
		mergeBySlug(result, bp, 'plugins');
		mergeBySlug(result, bp, 'themes');
		mergeBySlug(result, bp, 'muPlugins');
		mergeAppendArray(result, bp, 'additionalStepsAfterExecution');
		mergeAppendArray(result, bp, 'content');
		mergeAppendArray(result, bp, 'media');
		mergeUsers(result, bp);
		mergeRoles(result, bp);
		mergeApplicationOptions(result, bp);
	}

	return result as BlueprintV2Declaration;
}

// ------------------------------------------------------------------
// Merge helpers
// ------------------------------------------------------------------

/**
 * Asserts all blueprints have version 2.
 */
function assertVersion(bp: BlueprintV2Declaration): void {
	const bpObj = bp as Record<string, unknown>;
	if (bpObj.version !== undefined && bpObj.version !== 2) {
		throw new BlueprintMergeConflictError(
			'version',
			`Cannot merge blueprints with different versions: expected 2, got ${bpObj.version}`
		);
	}
}

/**
 * Merges a scalar property that must be exclusive — if both
 * blueprints define it with different values, it's a conflict.
 */
function mergeScalarExclusive(
	result: Record<string, unknown>,
	bp: BlueprintV2Declaration,
	key: string
): void {
	const bpObj = bp as Record<string, unknown>;
	const value = bpObj[key];
	if (value === undefined) {
		return;
	}
	if (result[key] !== undefined && !deepEqual(result[key], value)) {
		throw new BlueprintMergeConflictError(
			key,
			`Conflicting values for "${key}": ` +
				`${JSON.stringify(result[key])} vs ${JSON.stringify(value)}`
		);
	}
	result[key] = value;
}

/**
 * Merges key-value map properties (Record<string, unknown>).
 * Appends new keys, fails on key conflicts with different
 * values.
 */
function mergeKeyValueMap(
	result: Record<string, unknown>,
	bp: BlueprintV2Declaration,
	key: string
): void {
	const bpObj = bp as Record<string, unknown>;
	const incoming = bpObj[key] as Record<string, unknown> | undefined;
	if (!incoming) {
		return;
	}

	const existing = (result[key] ?? {}) as Record<string, unknown>;

	for (const [k, v] of Object.entries(incoming)) {
		if (k in existing && !deepEqual(existing[k], v)) {
			throw new BlueprintMergeConflictError(
				`${key}.${k}`,
				`Conflicting values for "${key}.${k}": ` +
					`${JSON.stringify(existing[k])} vs ${JSON.stringify(v)}`
			);
		}
		existing[k] = v;
	}

	result[key] = existing;
}

/**
 * Merges version constraints by intersecting ranges.
 * If both specify `preferred`, the second wins unless they
 * conflict with the resulting range.
 */
function mergeVersionConstraint(
	result: Record<string, unknown>,
	bp: BlueprintV2Declaration,
	key: string
): void {
	const bpObj = bp as Record<string, unknown>;
	const incoming = bpObj[key];
	if (incoming === undefined) {
		return;
	}

	if (result[key] === undefined) {
		result[key] = incoming;
		return;
	}

	// Normalize to constraint objects
	const a = normalizeVersionConstraint(result[key]);
	const b = normalizeVersionConstraint(incoming);

	const merged: Record<string, string> = {};

	// Take the higher min
	if (a.min && b.min) {
		merged.min = a.min > b.min ? a.min : b.min;
	} else if (a.min || b.min) {
		merged.min = (a.min ?? b.min)!;
	}

	// Take the lower max
	if (a.max && b.max) {
		merged.max = a.max < b.max ? a.max : b.max;
	} else if (a.max || b.max) {
		merged.max = (a.max ?? b.max)!;
	}

	// Check for empty intersection
	if (merged.min && merged.max && merged.min > merged.max) {
		throw new BlueprintMergeConflictError(
			key,
			`Incompatible version constraints for "${key}": ` +
				`min ${merged.min} > max ${merged.max}`
		);
	}

	// Preferred: last one wins
	if (b.preferred) {
		merged.preferred = b.preferred;
	} else if (a.preferred) {
		merged.preferred = a.preferred;
	}

	result[key] = merged;
}

/**
 * Normalizes a version constraint — strings become
 * `{ preferred: value }`, objects are used as-is.
 */
function normalizeVersionConstraint(value: unknown): Record<string, string> {
	if (typeof value === 'string') {
		return { preferred: value };
	}
	if (typeof value === 'object' && value !== null) {
		return { ...(value as Record<string, string>) };
	}
	return {};
}

/**
 * Merges array properties by slug. For plugins/themes, each
 * entry is either a string (slug) or an object with a source.
 * Entries with the same slug must be identical.
 */
function mergeBySlug(
	result: Record<string, unknown>,
	bp: BlueprintV2Declaration,
	key: string
): void {
	const bpObj = bp as Record<string, unknown>;
	const incoming = bpObj[key] as unknown[] | undefined;
	if (!incoming || incoming.length === 0) {
		return;
	}

	const existing = ((result[key] ?? []) as unknown[]).slice();
	const slugIndex = buildSlugIndex(existing);

	for (const entry of incoming) {
		const slug = extractSlug(entry);
		if (slug && slug in slugIndex) {
			// Duplicate slug — verify they're identical
			if (!deepEqual(existing[slugIndex[slug]], entry)) {
				throw new BlueprintMergeConflictError(
					`${key}[${slug}]`,
					`Conflicting definitions for "${key}" entry "${slug}"`
				);
			}
			// Already present, skip
		} else {
			if (slug) {
				slugIndex[slug] = existing.length;
			}
			existing.push(entry);
		}
	}

	result[key] = existing;
}

/**
 * Builds a slug → index mapping for an array of entries.
 */
function buildSlugIndex(arr: unknown[]): Record<string, number> {
	const index: Record<string, number> = {};
	for (let i = 0; i < arr.length; i++) {
		const slug = extractSlug(arr[i]);
		if (slug) {
			index[slug] = i;
		}
	}
	return index;
}

/**
 * Extracts a slug from a plugin/theme/mu-plugin entry.
 * Strings are slugs directly; objects may have a `source`
 * or `slug` field.
 */
function extractSlug(entry: unknown): string | null {
	if (typeof entry === 'string') {
		return entry;
	}
	if (typeof entry === 'object' && entry !== null) {
		const obj = entry as Record<string, unknown>;
		if (typeof obj.slug === 'string') {
			return obj.slug;
		}
		if (typeof obj.source === 'string') {
			return obj.source;
		}
	}
	return null;
}

/**
 * Appends arrays from incoming blueprint to result.
 */
function mergeAppendArray(
	result: Record<string, unknown>,
	bp: BlueprintV2Declaration,
	key: string
): void {
	const bpObj = bp as Record<string, unknown>;
	const incoming = bpObj[key] as unknown[] | undefined;
	if (!incoming || incoming.length === 0) {
		return;
	}

	const existing = ((result[key] ?? []) as unknown[]).slice();
	existing.push(...incoming);
	result[key] = existing;
}

/**
 * Merges users by username. Fails on role conflicts for
 * the same user.
 */
function mergeUsers(
	result: Record<string, unknown>,
	bp: BlueprintV2Declaration
): void {
	const bpObj = bp as Record<string, unknown>;
	const incoming = bpObj.users as Record<string, unknown>[] | undefined;
	if (!incoming || incoming.length === 0) {
		return;
	}

	const existing = (
		(result.users ?? []) as Record<string, unknown>[]
	).slice();
	const usernameIndex: Record<string, number> = {};
	for (let i = 0; i < existing.length; i++) {
		const u = String(existing[i].username ?? '');
		if (u) {
			usernameIndex[u] = i;
		}
	}

	for (const user of incoming) {
		const username = String(user.username ?? '');
		if (username in usernameIndex) {
			const existingUser = existing[usernameIndex[username]];
			if (
				existingUser.role !== undefined &&
				user.role !== undefined &&
				existingUser.role !== user.role
			) {
				throw new BlueprintMergeConflictError(
					`users[${username}].role`,
					`Conflicting roles for user "${username}": ` +
						`"${existingUser.role}" vs "${user.role}"`
				);
			}
		} else {
			usernameIndex[username] = existing.length;
			existing.push(user);
		}
	}

	result.users = existing;
}

/**
 * Merges roles by name. Fails on capability conflicts.
 */
function mergeRoles(
	result: Record<string, unknown>,
	bp: BlueprintV2Declaration
): void {
	const bpObj = bp as Record<string, unknown>;
	const incoming = bpObj.roles as Record<string, unknown>[] | undefined;
	if (!incoming || incoming.length === 0) {
		return;
	}

	const existing = (
		(result.roles ?? []) as Record<string, unknown>[]
	).slice();
	const nameIndex: Record<string, number> = {};
	for (let i = 0; i < existing.length; i++) {
		const n = String(existing[i].name ?? '');
		if (n) {
			nameIndex[n] = i;
		}
	}

	for (const role of incoming) {
		const name = String(role.name ?? '');
		if (name in nameIndex) {
			const existingRole = existing[nameIndex[name]];
			if (
				existingRole.capabilities !== undefined &&
				role.capabilities !== undefined &&
				!deepEqual(existingRole.capabilities, role.capabilities)
			) {
				throw new BlueprintMergeConflictError(
					`roles[${name}].capabilities`,
					`Conflicting capabilities for role "${name}"`
				);
			}
		} else {
			nameIndex[name] = existing.length;
			existing.push(role);
		}
	}

	result.roles = existing;
}

/**
 * Merges applicationOptions by deep-merging the
 * 'wordpress-playground' key.
 */
function mergeApplicationOptions(
	result: Record<string, unknown>,
	bp: BlueprintV2Declaration
): void {
	const bpObj = bp as Record<string, unknown>;
	const incoming = bpObj.applicationOptions as
		| Record<string, unknown>
		| undefined;
	if (!incoming) {
		return;
	}

	const existing = (result.applicationOptions ?? {}) as Record<
		string,
		unknown
	>;

	for (const [appKey, appOpts] of Object.entries(incoming)) {
		if (!(appKey in existing)) {
			existing[appKey] = appOpts;
		} else {
			// Shallow merge per-app options
			const merged = {
				...(existing[appKey] as Record<string, unknown>),
				...(appOpts as Record<string, unknown>),
			};
			existing[appKey] = merged;
		}
	}

	result.applicationOptions = existing;
}

// ------------------------------------------------------------------
// Utilities
// ------------------------------------------------------------------

/**
 * Simple deep equality check for JSON-serializable values.
 */
function deepEqual(a: unknown, b: unknown): boolean {
	if (a === b) {
		return true;
	}
	if (
		typeof a !== 'object' ||
		typeof b !== 'object' ||
		a === null ||
		b === null
	) {
		return false;
	}
	const keysA = Object.keys(a as Record<string, unknown>);
	const keysB = Object.keys(b as Record<string, unknown>);
	if (keysA.length !== keysB.length) {
		return false;
	}
	const objA = a as Record<string, unknown>;
	const objB = b as Record<string, unknown>;
	return keysA.every((key) => deepEqual(objA[key], objB[key]));
}
