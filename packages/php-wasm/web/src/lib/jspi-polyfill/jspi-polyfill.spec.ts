import {
	needsJspiPolyfill,
	installJspiPolyfill,
	uninstallJspiPolyfill,
	isJspiPolyfillInstalled,
} from './jspi-polyfill';

// Save the pristine state before any test modifies it.
const hadSuspending = 'Suspending' in WebAssembly;
const hadPromising = 'promising' in WebAssembly;
const pristineSuspending = hadSuspending
	? (WebAssembly as any).Suspending
	: undefined;
const pristinePromising = hadPromising
	? (WebAssembly as any).promising
	: undefined;

afterEach(() => {
	// Always clean up after each test regardless of
	// what state the test left things in.
	uninstallJspiPolyfill();

	// Extra safety: restore to the true pristine state
	// in case uninstall was a no-op (e.g. test called
	// uninstall itself).
	if (hadSuspending) {
		(WebAssembly as any).Suspending = pristineSuspending;
	} else {
		delete (WebAssembly as any).Suspending;
	}
	if (hadPromising) {
		(WebAssembly as any).promising = pristinePromising;
	} else {
		delete (WebAssembly as any).promising;
	}
});

describe('needsJspiPolyfill', () => {
	it('returns a Promise that resolves to a boolean', async () => {
		const result = needsJspiPolyfill();
		expect(result).toBeInstanceOf(Promise);
		expect(typeof (await result)).toBe('boolean');
	});
});

describe('installJspiPolyfill', () => {
	it('makes WebAssembly.Suspending return fn unchanged', () => {
		installJspiPolyfill();

		const fn = () => 42;
		const wrapped = new (WebAssembly as any).Suspending(fn);
		expect(wrapped).toBe(fn);
	});

	it('makes WebAssembly.promising return a Promise wrapper', async () => {
		installJspiPolyfill();

		const fn = (x: number) => x * 2;
		const wrapped = (WebAssembly as any).promising(fn);

		const result = wrapped(21);
		expect(result).toBeInstanceOf(Promise);
		expect(await result).toBe(42);
	});

	it('sets isJspiPolyfillInstalled to true', () => {
		expect(isJspiPolyfillInstalled()).toBe(false);
		installJspiPolyfill();
		expect(isJspiPolyfillInstalled()).toBe(true);
	});

	it('is idempotent — calling twice does not error', () => {
		installJspiPolyfill();
		const suspending = (WebAssembly as any).Suspending;

		installJspiPolyfill();
		// Should still be the same polyfill, not doubly wrapped.
		expect((WebAssembly as any).Suspending).toBe(suspending);
	});

	it('promising wrapper passes all arguments through', async () => {
		installJspiPolyfill();

		const fn = (a: number, b: string, c: boolean) => `${a}-${b}-${c}`;
		const wrapped = (WebAssembly as any).promising(fn);

		expect(await wrapped(1, 'hello', true)).toBe('1-hello-true');
	});
});

describe('uninstallJspiPolyfill', () => {
	it('sets isJspiPolyfillInstalled to false', () => {
		installJspiPolyfill();
		expect(isJspiPolyfillInstalled()).toBe(true);

		uninstallJspiPolyfill();
		expect(isJspiPolyfillInstalled()).toBe(false);
	});

	it('restores originals if they existed', () => {
		// Simulate a browser with native JSPI.
		const fakeSuspending = class {};
		const fakePromising = () => {};
		(WebAssembly as any).Suspending = fakeSuspending;
		(WebAssembly as any).promising = fakePromising;

		installJspiPolyfill();
		// Polyfill should have replaced them.
		expect((WebAssembly as any).Suspending).not.toBe(fakeSuspending);
		expect((WebAssembly as any).promising).not.toBe(fakePromising);

		uninstallJspiPolyfill();
		expect((WebAssembly as any).Suspending).toBe(fakeSuspending);
		expect((WebAssembly as any).promising).toBe(fakePromising);
	});

	it('removes properties if they did not exist before', () => {
		// Ensure they don't exist.
		delete (WebAssembly as any).Suspending;
		delete (WebAssembly as any).promising;

		installJspiPolyfill();
		expect('Suspending' in WebAssembly).toBe(true);
		expect('promising' in WebAssembly).toBe(true);

		uninstallJspiPolyfill();
		expect('Suspending' in WebAssembly).toBe(false);
		expect('promising' in WebAssembly).toBe(false);
	});

	it('is a no-op if polyfill was not installed', () => {
		// Should not throw.
		uninstallJspiPolyfill();
		expect(isJspiPolyfillInstalled()).toBe(false);
	});
});
