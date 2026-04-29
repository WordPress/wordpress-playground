import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';

export type ExtensionLanguage = 'c' | 'rust';

const EXTENSION_NAME_PATTERNS = [
	/\bPHP_ARG_ENABLE\(\s*\[?([A-Za-z0-9_]+)\]?/m,
	/\bPHP_ARG_WITH\(\s*\[?([A-Za-z0-9_]+)\]?/m,
	/\bPHP_NEW_EXTENSION\(\s*\[?([A-Za-z0-9_]+)\]?/m,
];

/**
 * Decides the language by what's on disk:
 *   - `Cargo.toml` ⇒ rust
 *   - `config.m4` ⇒ c
 *
 * If neither exists we throw; if both exist we prefer rust because that
 * matches how Rust extensions ship today (a `Cargo.toml` plus an empty
 * stub `config.m4` from `phpize` is rare in practice).
 */
export async function detectLanguage(
	sourceDir: string
): Promise<ExtensionLanguage> {
	const hasCargo = await pathExists(path.join(sourceDir, 'Cargo.toml'));
	if (hasCargo) {
		return 'rust';
	}
	const hasConfigM4 = await pathExists(path.join(sourceDir, 'config.m4'));
	if (hasConfigM4) {
		return 'c';
	}
	throw new Error(
		`Could not detect language: ${sourceDir} has neither Cargo.toml nor config.m4. ` +
			`Pass --language=rust|c explicitly.`
	);
}

export async function detectExtensionName(
	sourceDir: string,
	language: ExtensionLanguage = 'c'
): Promise<string> {
	if (language === 'rust') {
		return detectRustCrateName(sourceDir);
	}
	const configPath = path.join(sourceDir, 'config.m4');
	let config: string;
	try {
		config = await readFile(configPath, 'utf8');
	} catch (error) {
		throw new Error(
			`Could not read ${configPath}. Pass --name or provide a config.m4 file.`,
			{ cause: error }
		);
	}

	const detected = detectExtensionNameFromConfig(config);
	if (!detected) {
		throw new Error(
			`Could not detect the extension name from ${configPath}. Pass --name explicitly.`
		);
	}
	return detected;
}

export function detectExtensionNameFromConfig(config: string): string | null {
	for (const pattern of EXTENSION_NAME_PATTERNS) {
		const match = pattern.exec(config);
		if (match?.[1]) {
			return match[1];
		}
	}
	return null;
}

/*
 * For Rust extensions, the on-disk filename of the cdylib is derived from
 * `[package].name` (or `[lib].name`, if set) in Cargo.toml. We only need
 * a tiny TOML reader here — pulling in a full parser would be overkill.
 */
export async function detectRustCrateName(sourceDir: string): Promise<string> {
	const cargoPath = path.join(sourceDir, 'Cargo.toml');
	let cargo: string;
	try {
		cargo = await readFile(cargoPath, 'utf8');
	} catch (error) {
		throw new Error(
			`Could not read ${cargoPath}. Pass --name explicitly.`,
			{ cause: error }
		);
	}
	const detected = detectRustCrateNameFromCargo(cargo);
	if (!detected) {
		throw new Error(
			`Could not detect the crate name from ${cargoPath}. Pass --name explicitly.`
		);
	}
	return detected;
}

export function detectRustCrateNameFromCargo(cargo: string): string | null {
	// Prefer [lib].name when set — that's what controls the cdylib filename.
	const lib = matchTableScalar(cargo, 'lib', 'name');
	if (lib) {
		return lib;
	}
	return matchTableScalar(cargo, 'package', 'name');
}

function matchTableScalar(
	text: string,
	table: string,
	key: string
): string | null {
	const tableHeader = new RegExp(`^\\[\\s*${table}\\s*\\]`, 'm');
	const start = tableHeader.exec(text);
	if (!start) {
		return null;
	}
	const after = text.slice(start.index + start[0].length);
	const next = /^\[/m.exec(after);
	const section = next ? after.slice(0, next.index) : after;
	const keyPattern = new RegExp(
		`^\\s*${key}\\s*=\\s*"([^"\\n]+)"\\s*$`,
		'm'
	);
	const match = keyPattern.exec(section);
	return match ? match[1] : null;
}

async function pathExists(p: string): Promise<boolean> {
	try {
		await stat(p);
		return true;
	} catch {
		return false;
	}
}
