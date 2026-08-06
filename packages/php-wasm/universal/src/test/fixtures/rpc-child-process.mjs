/**
 * SPDX-License-Identifier: GPL-2.0-or-later
 */

const { exposeAPI } = await import(process.argv[2]);

const [setReady] = exposeAPI(
	{
		ping(value) {
			return `pong:${value}`;
		},
		async invoke(callback, value) {
			return await callback(value);
		},
		reflect(value) {
			return value;
		},
		fail() {
			throw new RangeError('child failure');
		},
		never() {
			return new Promise(() => {});
		},
	},
	undefined,
	process
);

setReady();
process.send('fixture-ready');
