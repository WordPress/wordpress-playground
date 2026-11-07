vi.mock('./config', () => ({ playgroundOrigin: 'https://app.test' }));
import { assertAppParent } from './deployment';

// An app-only document must reject a foreign/opaque parent before discovering
// a shared runtime. Otherwise a public iframe URL could attach to saved storage.
describe('app-only runtime parent', () => {
	afterEach(() => vi.unstubAllGlobals());
	it('accepts the actual app-origin parent', () => {
		vi.stubGlobal('window', {
			parent: { location: { origin: 'https://app.test' } },
		});
		expect(() => assertAppParent()).not.toThrow();
	});
	it.each(['https://sandbox.test', 'https://external.test', 'null'])(
		'rejects parent origin %s',
		(origin) => {
			vi.stubGlobal('window', { parent: { location: { origin } } });
			expect(() => assertAppParent()).toThrow();
		}
	);
	it('rejects a parent whose location the browser refuses to expose', () => {
		vi.stubGlobal('window', {
			parent: {
				get location() {
					throw new DOMException('cross origin', 'SecurityError');
				},
			},
		});
		expect(() => assertAppParent()).toThrow();
	});
	it('rejects top-level privileged runtime documents', () => {
		const context: { parent?: object } = {};
		context.parent = context;
		vi.stubGlobal('window', context);
		expect(() => assertAppParent()).toThrow();
	});
});
