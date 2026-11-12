import { vi } from 'vitest';

const config = vi.hoisted(() => ({
	playgroundOrigin: 'https://my.wordpress.net',
	wordPressSiteUrl: 'https://wpsandbox.wordpress.net',
}));

vi.mock('./config', () => config);

describe('WordPress popup loopback permission', () => {
	afterEach(() => {
		vi.unstubAllGlobals();
		vi.resetModules();
	});

	it.each([
		'https://my.wordpress.net',
		'https://playground.wordpress.net',
		'https://example.com',
	])(
		'does not implicitly delegate based on the hosting domain %s',
		async (origin) => {
			config.playgroundOrigin = origin;
			const frame = { allow: '', src: '' };
			vi.stubGlobal('location', {
				origin,
				href: origin + '/wordpress-popup.html',
				hash: '#https://wpsandbox.wordpress.net/scope:popup/wp-admin/',
			});
			vi.stubGlobal('document', { querySelector: () => frame });

			const { bootWordPressPopup } = await import('./wordpress-popup');
			bootWordPressPopup();

			expect(frame.allow).toBe('');
			expect(frame.src).toBe(
				'https://wpsandbox.wordpress.net/scope:popup/wp-admin/'
			);
		}
	);
	it('lets a Personal WP entry point opt in on a custom host', async () => {
		config.playgroundOrigin = 'https://personal.example';
		const frame = { allow: '', src: '' };
		vi.stubGlobal('location', {
			origin: config.playgroundOrigin,
			href: config.playgroundOrigin + '/wordpress-popup.html',
			hash: '#https://wpsandbox.wordpress.net/scope:popup/wp-admin/',
		});
		vi.stubGlobal('document', { querySelector: () => frame });
		const { bootWordPressPopup } = await import('./wordpress-popup');
		bootWordPressPopup({ allowLoopbackNetwork: true });
		expect(frame.allow).toBe(
			'loopback-network https://wpsandbox.wordpress.net'
		);
		expect(frame.src).toBe(
			'https://wpsandbox.wordpress.net/scope:popup/wp-admin/'
		);
	});

	it.each(['#https://unrelated.example/scope:popup/', '#/api.html'])(
		'rejects an invalid destination %s before delegating',
		async (hash) => {
			const frame = { allow: '', src: '' };
			vi.stubGlobal('location', {
				href: 'https://personal.example/wordpress-popup.html',
				hash,
			});
			vi.stubGlobal('document', { querySelector: () => frame });
			const { bootWordPressPopup } = await import('./wordpress-popup');
			expect(() =>
				bootWordPressPopup({ allowLoopbackNetwork: true })
			).toThrow();
			expect(frame.allow).toBe('');
			expect(frame.src).toBe('');
		}
	);
	it.each([false, true])(
		'preserves scoped-route destinations with delegation %s',
		async (allowed) => {
			const frame = { allow: '', src: '' };
			const location = new URL(
				'https://personal.example/scope:popup/wp-admin/?preview_nonce=a%2Bb#preview'
			);
			vi.stubGlobal('location', location);
			vi.stubGlobal('document', { querySelector: () => frame });
			const { bootWordPressPopup } = await import('./wordpress-popup');
			bootWordPressPopup({ allowLoopbackNetwork: allowed });
			expect(frame.src).toBe(
				'https://wpsandbox.wordpress.net/scope:popup/wp-admin/?preview_nonce=a%2Bb#preview'
			);
			expect(frame.allow).toBe(
				allowed
					? 'loopback-network https://wpsandbox.wordpress.net'
					: ''
			);
		}
	);
});
