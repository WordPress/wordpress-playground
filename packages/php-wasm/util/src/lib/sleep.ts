export const SleepFinished = Symbol('SleepFinished');

export function sleep(ms: number): Promise<typeof SleepFinished> {
	return new Promise((resolve) => {
		setTimeout(() => resolve(SleepFinished), ms);
	});
}
