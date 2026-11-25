const { readFileSync, globSync } = require('node:fs');
const { join } = require('node:path');
const { runInNewContext } = require('node:vm');
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

// Test the compiler input and the checked-in loaders: a source-only change
// would leave existing browser downloads using the slow timer path.
const librarySource = readFileSync(
	join(__dirname, 'phpwasm-emscripten-library.js'),
	'utf8'
);
const implementations = [
	[
		'compiler library',
		`${librarySource}\nLibraryManager.library.emscripten_sleep;`,
	],
	...globSync('*/*/php_*.js', {
		cwd: join(__dirname, '../../web-builds'),
	}).map((path) => {
		const source = readFileSync(
			join(__dirname, '../../web-builds', path),
			'utf8'
		);
		const start = source.indexOf('var _emscripten_sleep =');
		const end = source.indexOf('_emscripten_sleep.sig', start);
		assert.ok(start !== -1 && end > start, `Missing sleep in ${path}`);
		return [path, `${source.slice(start, end)}\n_emscripten_sleep;`];
	}),
];

for (const [name, source] of implementations) {
	describe(name, () => {
		it('yields zero-delay sleeps to a task, keeping the runtime alive', () => {
			const runtime = createRuntime(source);
			runtime.sleep(0);
			assert.equal(runtime.tasks.length, 1);
			assert.equal(runtime.timers.length, 0);
			assert.deepEqual(runtime.events, ['keepalive']);
			runtime.tasks.shift()();
			assert.deepEqual(runtime.events, [
				'keepalive',
				'release',
				'callback',
				'wake',
			]);
		});

		it('keeps positive sleeps on the existing timer path', () => {
			const runtime = createRuntime(source);
			runtime.sleep(125);
			assert.equal(runtime.tasks.length, 0);
			assert.equal(runtime.timers.length, 1);
			assert.equal(runtime.timers[0].delay, 125);
			runtime.timers[0].callback();
			assert.deepEqual(runtime.events, ['wake']);
		});

		for (const scheduler of [undefined, {}]) {
			it(`uses the timer when postTask is unavailable (${JSON.stringify(scheduler)})`, () => {
				const runtime = createRuntime(source, scheduler);
				runtime.sleep(0);
				assert.equal(runtime.tasks.length, 0);
				assert.equal(runtime.timers.length, 1);
				assert.equal(runtime.timers[0].delay, 0);
				runtime.timers[0].callback();
				assert.deepEqual(runtime.events, ['wake']);
			});
		}

		it('lets callUserCallback skip resuming an aborted runtime', () => {
			const runtime = createRuntime(source);
			runtime.sleep(0);
			runtime.context.callUserCallback = () =>
				runtime.events.push('aborted');
			runtime.tasks.shift()();
			assert.deepEqual(runtime.events, [
				'keepalive',
				'release',
				'aborted',
			]);
		});
	});
}

/** Evaluates one sleep implementation with controlled task and timer queues. */
function createRuntime(source, ...schedulerOverride) {
	const events = [];
	const tasks = [];
	const timers = [];
	const context = {
		LibraryManager: { library: {} },
		mergeInto: Object.assign,
		autoAddDeps() {},
		Asyncify: { handleSleep: (start) => start(() => events.push('wake')) },
		safeSetTimeout: (callback, delay) => timers.push({ callback, delay }),
		runtimeKeepalivePush: () => events.push('keepalive'),
		runtimeKeepalivePop: () => events.push('release'),
		callUserCallback: (callback) => {
			events.push('callback');
			callback();
		},
		scheduler: schedulerOverride.length
			? schedulerOverride[0]
			: { postTask: (callback) => tasks.push(callback) },
	};
	return {
		sleep: runInNewContext(source, context),
		context,
		events,
		tasks,
		timers,
	};
}
