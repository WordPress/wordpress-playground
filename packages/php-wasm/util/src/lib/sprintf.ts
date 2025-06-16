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
			const specifier = format[i + 1];

			switch (specifier) {
				case 's':
					let str = String(args[argIndex++]);
					if (str === '[object Object]') {
						try {
							// If an object doesn't provide its own toString(),
							// try to represent it as JSON.
							str = JSON.stringify(args[argIndex++], null, 2);
						} catch {
							// Ignore error and use default representation.
						}
					}
					result += str;
					i++;
					break;
				case 'd':
					const dValue = args[argIndex++];
					if (typeof dValue === 'bigint') {
						result += dValue.toString();
					} else {
						result += Math.floor(Number(dValue));
					}
					i++;
					break;
				case 'f':
					const fValue = args[argIndex++];
					if (typeof fValue === 'bigint') {
						result += Number(fValue);
					} else {
						result += Number(fValue);
					}
					i++;
					break;
				case 'x':
					const xValue = args[argIndex++];
					if (typeof xValue === 'bigint') {
						result += xValue.toString(16);
					} else {
						result += Math.floor(Number(xValue)).toString(16);
					}
					i++;
					break;
				case '%':
					result += '%';
					i++;
					break;
				default:
					result += '%' + specifier;
					i++;
			}
		} else {
			result += format[i];
		}
	}

	return result;
}
