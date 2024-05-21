export const currentJsRuntime = (function () {
	if (typeof process !== 'undefined' && process.release?.name === 'node') {
		return 'NODE';
	} else if (typeof window !== 'undefined') {
		return 'WEB';
	} else if (
		// @ts-ignore
		typeof WorkerGlobalScope !== 'undefined' &&
		// @ts-ignore
		self instanceof (WorkerGlobalScope as any)
	) {
		return 'WORKER';
	} else {
		return 'NODE';
	}
})();
