const literal = Symbol('literal');

function jsToPhp(value: any): string {
	if (typeof value === 'string') {
		if (value.startsWith('$')) {
			return value;
		} else {
			return JSON.stringify(value);
		}
	} else if (typeof value === 'number') {
		return value.toString();
	} else if (Array.isArray(value)) {
		const phpArray = value.map(jsToPhp).join(', ');
		return `array(${phpArray})`;
	} else if (typeof value === 'object') {
		if (literal in value) {
			return value.toString();
		} else {
			const phpAssocArray = Object.entries(value)
				.map(
					([key, val]) => `${JSON.stringify(key)} => ${jsToPhp(val)}`
				)
				.join(', ');
			return `array(${phpAssocArray})`;
		}
	} else if (typeof value === 'function') {
		return value();
	}
	return '';
}

const handler: ProxyHandler<any> = {
	get: (target, prop: string) => {
		const result = function (...argumentsList: any[]) {
			if (prop.startsWith('$')) {
				return prop;
			}
			return {
				[literal]: true,
				toString() {
					const args = argumentsList
						.map((arg) => jsToPhp(arg))
						.join(', ');
					return `${prop}(${args})`;
				},
			};
		};
		result.toString = () => {
			return jsToPhp(prop);
		};
		return result;
	},
};

/**
 * Creates a new JS to PHP translator.
 *
 * A translator is an object where PHP functions are accessible as properties.
 *
 * @example
 * ```js
 * const t = jsToPHPTranslator();
 * const code = t.echo('Hello, World!');
 * // code is echo("Hello, World!")
 * ```
 *
 * @example
 * ```js
 * const t = jsToPHPTranslator();
 * const absoluteUrl = 'http://example.com';
 * const code = `
 * 	${t.define('WP_HOME', absoluteUrl)};
 * 	${t.define('WP_SITEURL', absoluteUrl)};
 * `;
 * // code is:
 * // define("WP_HOME", "http://example.com");
 * // define("WP_SITEURL", "http://example.com");
 * ```
 */
export function jsToPHPTranslator() {
	return new Proxy({}, handler);
}
