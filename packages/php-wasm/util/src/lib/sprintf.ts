/**
 * Formats a string like sprintf().
 *
 * This function:
 * - Supports basic format specifiers: %s, %d, %f, %x, %%
 * - Supports bigint values
 *
 * The purpose of this function is for use in optional php-wasm tracing.
 * If we use printf-style formatting for trace messages, we let the trace
 * function decide whether to format and do not have to pay for formatting
 * unless tracing is enabled.
 */
export function sprintf(format: string, ...args: any[]): string {
	let result = '';
	let argIndex = 0;

	for (let i = 0; i < format.length; i++) {
		if (format[i] === '%' && i + 1 < format.length) {
			i++;
			const specifier = format[i];

			switch (specifier) {
				case 's': {
					const arg = args[argIndex++];
					let str;
					if (typeof arg === 'object') {
						try {
							// If an object doesn't provide its own toString(),
							// try to represent it as JSON.
							str = JSON.stringify(
								arg,
								// Represent bigint values as strings in JSON.stringify().
								(key, value) => {
									if (typeof value === 'bigint') {
										return `0x${value.toString(16)}`;
									}
									return value;
								},
								2
							);
						} catch {
							// Ignore error and use default representation.
						}
					} else {
						str = String(arg);
					}

					result += str;
					break;
				}
				case 'd': {
					const arg = args[argIndex++];
					if (typeof arg === 'bigint') {
						result += arg.toString();
					} else {
						result += Math.floor(Number(arg));
					}
					break;
				}
				case 'f': {
					const arg = args[argIndex++];
					if (typeof arg === 'bigint') {
						result += Number(arg);
					} else {
						result += Number(arg);
					}
					break;
				}
				case 'x': {
					const arg = args[argIndex++];
					if (typeof arg === 'bigint') {
						result += arg.toString(16);
					} else {
						result += Math.floor(Number(arg)).toString(16);
					}
					break;
				}
				case '%': {
					result += '%';
					break;
				}
				default: {
					result += '%' + specifier;
				}
			}
		} else {
			result += format[i];
		}
	}

	return result;
}
