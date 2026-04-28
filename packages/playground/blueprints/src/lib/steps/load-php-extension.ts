import { loadPHPExtension } from '@php-wasm/universal';
import type { StepHandler } from '.';

/**
 * @inheritDoc loadPHPExtension
 * @example
 *
 * <code>
 * {
 *   "step": "loadPHPExtension",
 *   "name": "wp_mysql_parser",
 *   "url": "https://example.com/wp_mysql_parser-php8.3-jspi.so"
 * }
 * </code>
 */
export interface LoadPHPExtensionStep {
	step: 'loadPHPExtension';
	/**
	 * Identifier used as the on-disk file name (no extension).
	 * Use snake_case or kebab-case; the regex `[A-Za-z0-9_-]+` is enforced.
	 */
	name: string;
	/**
	 * URL to the compiled `.so` side module. Must match the running PHP
	 * version and async mode (Asyncify vs JSPI). For multi-target
	 * extensions, point this at the right artifact for the runtime —
	 * a manifest-aware loader is on the roadmap.
	 */
	url: string;
	/**
	 * `extension=` (default) or `zend_extension=`. Use the latter for
	 * Xdebug-style extensions that hook into the Zend engine.
	 */
	kind?: 'extension' | 'zend_extension';
	/** Extra ini entries written into the per-extension ini file. */
	iniEntries?: Record<string, string>;
}

/**
 * Loads a pre-built PHP extension (.so side module) into the running
 * Playground PHP runtime. The extension takes effect on the next
 * runtime startup — for blueprints this means subsequent steps and
 * the first user-visible request.
 */
export const loadPHPExtensionStep: StepHandler<LoadPHPExtensionStep> = async (
	playground,
	{ name, url, kind, iniEntries }
) => {
	const response = await fetch(url);
	if (!response.ok) {
		throw new Error(
			`loadPHPExtension: failed to fetch ${url} (HTTP ${response.status})`
		);
	}
	const soBytes = new Uint8Array(await response.arrayBuffer());
	await loadPHPExtension(playground, { name, soBytes, kind, iniEntries });
};
