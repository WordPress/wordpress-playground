import type { BlueprintV2Declaration, CompiledV2Step } from '../types';

/**
 * Transpiles declarative blueprint properties into an ordered
 * sequence of compiled steps, following the spec-defined order.
 *
 * Each declarative property (e.g. `plugins`, `themes`, `constants`)
 * maps to one or more step objects that the execution loop can
 * dispatch to step handlers.
 */
export function transpileDeclarativeToSteps(
	blueprint: BlueprintV2Declaration
): CompiledV2Step[] {
	const steps: CompiledV2Step[] = [];

	transpileConstants(blueprint, steps);
	transpileSiteOptions(blueprint, steps);
	transpileMuPlugins(blueprint, steps);
	transpileThemes(blueprint, steps);
	transpileActiveTheme(blueprint, steps);
	transpilePlugins(blueprint, steps);
	transpileFonts(blueprint, steps);
	transpileMedia(blueprint, steps);
	transpileSiteLanguage(blueprint, steps);
	transpileRoles(blueprint, steps);
	transpileUsers(blueprint, steps);
	transpilePostTypes(blueprint, steps);
	transpileContent(blueprint, steps);
	transpileAdditionalSteps(blueprint, steps);

	return steps;
}

// ------------------------------------------------------------------
// Per-property transpilation helpers (spec-defined order)
// ------------------------------------------------------------------

/**
 * 1. constants -> defineConstants step
 */
function transpileConstants(
	blueprint: BlueprintV2Declaration,
	steps: CompiledV2Step[]
): void {
	if (!blueprint.constants) {
		return;
	}
	steps.push({
		step: 'defineConstants',
		args: { constants: blueprint.constants },
		progressHints: {
			caption: 'Defining constants',
			weight: 1,
		},
	});
}

/**
 * 2. siteOptions -> setSiteOptions step
 */
function transpileSiteOptions(
	blueprint: BlueprintV2Declaration,
	steps: CompiledV2Step[]
): void {
	if (!blueprint.siteOptions) {
		return;
	}
	steps.push({
		step: 'setSiteOptions',
		args: { options: blueprint.siteOptions },
		progressHints: {
			caption: 'Setting site options',
			weight: 1,
		},
	});
}

/**
 * 3. muPlugins -> installMuPlugin steps
 */
function transpileMuPlugins(
	blueprint: BlueprintV2Declaration,
	steps: CompiledV2Step[]
): void {
	if (!blueprint.muPlugins) {
		return;
	}
	for (const entry of blueprint.muPlugins) {
		steps.push({
			step: 'installMuPlugin',
			args: { source: entry },
			progressHints: {
				caption: 'Installing mu-plugin',
				weight: 2,
			},
		});
	}
}

/**
 * 4. themes -> installTheme steps (without activation)
 */
function transpileThemes(
	blueprint: BlueprintV2Declaration,
	steps: CompiledV2Step[]
): void {
	if (!blueprint.themes) {
		return;
	}
	for (const entry of blueprint.themes) {
		const args = normalizeThemeEntry(entry);
		const name = describeThemeSource(args);
		steps.push({
			step: 'installTheme',
			args,
			progressHints: {
				caption: `Installing ${name} theme`,
				weight: 5,
			},
		});
	}
}

/**
 * 5. activeTheme -> installTheme + activateTheme steps
 */
function transpileActiveTheme(
	blueprint: BlueprintV2Declaration,
	steps: CompiledV2Step[]
): void {
	if (!blueprint.activeTheme) {
		return;
	}
	const args = normalizeThemeEntry(blueprint.activeTheme);
	const name = describeThemeSource(args);
	steps.push({
		step: 'installTheme',
		args,
		progressHints: {
			caption: `Installing ${name} theme`,
			weight: 5,
		},
	});
	steps.push({
		step: 'activateTheme',
		args: { themeDirectoryName: args.source as string },
		progressHints: {
			caption: `Activating ${name} theme`,
			weight: 1,
		},
	});
}

/**
 * 6. plugins -> installPlugin steps (active: true by default)
 */
function transpilePlugins(
	blueprint: BlueprintV2Declaration,
	steps: CompiledV2Step[]
): void {
	if (!blueprint.plugins) {
		return;
	}
	for (const entry of blueprint.plugins) {
		const args = normalizePluginEntry(entry);
		const name = describePluginSource(args);
		steps.push({
			step: 'installPlugin',
			args,
			progressHints: {
				caption: `Installing ${name} plugin`,
				weight: 5,
			},
		});
	}
}

/**
 * 7. fonts -> installFont steps
 */
function transpileFonts(
	blueprint: BlueprintV2Declaration,
	steps: CompiledV2Step[]
): void {
	if (!blueprint.fonts) {
		return;
	}
	for (const [name, definition] of Object.entries(blueprint.fonts)) {
		steps.push({
			step: 'installFont',
			args: { name, definition },
			progressHints: {
				caption: `Installing ${name} font`,
				weight: 2,
			},
		});
	}
}

/**
 * 8. media -> importMedia steps
 */
function transpileMedia(
	blueprint: BlueprintV2Declaration,
	steps: CompiledV2Step[]
): void {
	if (!blueprint.media) {
		return;
	}
	for (const entry of blueprint.media) {
		const args =
			typeof entry === 'string' ? { source: entry } : { ...entry };
		steps.push({
			step: 'importMedia',
			args,
			progressHints: {
				caption: 'Importing media',
				weight: 2,
			},
		});
	}
}

/**
 * 9. siteLanguage -> setSiteLanguage step
 */
function transpileSiteLanguage(
	blueprint: BlueprintV2Declaration,
	steps: CompiledV2Step[]
): void {
	if (!blueprint.siteLanguage) {
		return;
	}
	steps.push({
		step: 'setSiteLanguage',
		args: { language: blueprint.siteLanguage },
		progressHints: {
			caption: 'Setting site language',
			weight: 1,
		},
	});
}

/**
 * 10. roles -> runPHP steps (stub)
 */
function transpileRoles(
	blueprint: BlueprintV2Declaration,
	steps: CompiledV2Step[]
): void {
	if (!blueprint.roles) {
		return;
	}
	for (const role of blueprint.roles) {
		steps.push({
			step: 'runPHP',
			args: {
				code: generateCreateRolePHP(role),
			},
			progressHints: {
				caption: `Creating ${role.name} role`,
				weight: 1,
			},
		});
	}
}

/**
 * 11. users -> runPHP steps (stub)
 */
function transpileUsers(
	blueprint: BlueprintV2Declaration,
	steps: CompiledV2Step[]
): void {
	if (!blueprint.users) {
		return;
	}
	for (const user of blueprint.users) {
		steps.push({
			step: 'runPHP',
			args: {
				code: generateCreateUserPHP(user),
			},
			progressHints: {
				caption: `Creating user ${user.username}`,
				weight: 1,
			},
		});
	}
}

/**
 * 12. postTypes -> runPHP steps (stub)
 */
function transpilePostTypes(
	blueprint: BlueprintV2Declaration,
	steps: CompiledV2Step[]
): void {
	if (!blueprint.postTypes) {
		return;
	}
	for (const [key, definition] of Object.entries(blueprint.postTypes)) {
		steps.push({
			step: 'runPHP',
			args: {
				code: generateRegisterPostTypePHP(key, definition),
			},
			progressHints: {
				caption: `Registering ${key} post type`,
				weight: 1,
			},
		});
	}
}

/**
 * 13. content -> importContent steps
 */
function transpileContent(
	blueprint: BlueprintV2Declaration,
	steps: CompiledV2Step[]
): void {
	if (!blueprint.content) {
		return;
	}
	for (const entry of blueprint.content) {
		steps.push({
			step: 'importContent',
			args: { ...entry },
			progressHints: {
				caption: 'Importing content',
				weight: 3,
			},
		});
	}
}

/**
 * 14. additionalStepsAfterExecution -> appended as-is
 */
function transpileAdditionalSteps(
	blueprint: BlueprintV2Declaration,
	steps: CompiledV2Step[]
): void {
	if (!blueprint.additionalStepsAfterExecution) {
		return;
	}
	for (const entry of blueprint.additionalStepsAfterExecution) {
		const { step: stepName, ...rest } = entry as Record<string, unknown>;
		steps.push({
			step: stepName as string,
			args: rest,
		});
	}
}

// ------------------------------------------------------------------
// Normalization helpers
// ------------------------------------------------------------------

function normalizePluginEntry(entry: unknown): Record<string, unknown> {
	if (typeof entry === 'string') {
		return { source: entry, active: true };
	}
	if (typeof entry === 'object' && entry !== null) {
		const obj = entry as Record<string, unknown>;
		return {
			...obj,
			active: obj.active !== undefined ? obj.active : true,
		};
	}
	return { source: entry, active: true };
}

function normalizeThemeEntry(entry: unknown): Record<string, unknown> {
	if (typeof entry === 'string') {
		return { source: entry };
	}
	if (typeof entry === 'object' && entry !== null) {
		return { ...(entry as Record<string, unknown>) };
	}
	return { source: entry };
}

function describePluginSource(args: Record<string, unknown>): string {
	if (typeof args.humanReadableName === 'string') {
		return args.humanReadableName;
	}
	if (typeof args.source === 'string') {
		return args.source;
	}
	return 'unknown';
}

function describeThemeSource(args: Record<string, unknown>): string {
	if (typeof args.humanReadableName === 'string') {
		return args.humanReadableName;
	}
	if (typeof args.source === 'string') {
		return args.source;
	}
	return 'unknown';
}

// ------------------------------------------------------------------
// PHP code generation stubs
// ------------------------------------------------------------------

function generateCreateRolePHP(role: Record<string, unknown>): string {
	const name = String(role.name ?? '');
	const caps = role.capabilities ?? {};
	const capsJson = JSON.stringify(caps);
	return [
		'<?php',
		`$caps = json_decode('${capsJson}', true);`,
		`add_role('${name}', '${name}', $caps);`,
	].join('\n');
}

function generateCreateUserPHP(user: Record<string, unknown>): string {
	const username = String(user.username ?? '');
	const email = String(user.email ?? '');
	const role = String(user.role ?? 'subscriber');
	return [
		'<?php',
		`wp_create_user('${username}', wp_generate_password(), '${email}');`,
		`$u = get_user_by('login', '${username}');`,
		`if ($u) { $u->set_role('${role}'); }`,
	].join('\n');
}

function generateRegisterPostTypePHP(key: string, definition: unknown): string {
	if (typeof definition === 'string') {
		// Execution-context path reference — handled by
		// a future data-reference resolution step.
		return `<?php // post type "${key}" from path: ${definition}`;
	}
	const defJson = JSON.stringify(definition);
	return [
		'<?php',
		`$args = json_decode('${defJson}', true);`,
		`register_post_type('${key}', $args);`,
	].join('\n');
}
