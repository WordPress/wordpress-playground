/**
 * Debounce a function.
 * 
 * @param fn 
 * @param delay 
 * @returns 
 */
export function debounce(fn: () => void, delay: number) {
	let timeout: number | null = null;
	return () => {
		if (null !== timeout) {
			clearTimeout(timeout);
		}
		timeout = setTimeout(fn, delay) as any;
	};
}
