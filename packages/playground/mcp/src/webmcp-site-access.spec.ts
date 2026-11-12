import { describe, expect, it, vi } from 'vitest';
import type { PlaygroundClient } from '@wp-playground/remote';
import type {
	SiteAccessDecision,
	SiteAccessRequest,
	SiteAccessSite,
} from './webmcp-site-access';
import { createSiteAccess } from './webmcp-site-access';
import { createSiteAccessRegistry } from './webmcp-site-access-registry';

// Contract: a grant token reaches only the site the user approved, and every
// failure of the token, the site or the shared record refuses access. Token
// bookkeeping, site switching and the shared registry can each break this
// independently.
describe('site access grants', () => {
	it('designate one site and fail closed', async () => {
		const browser = createBrowser();
		const tab = browser.openTab([site('a', true)]);
		const { grant } = await tab.access.request('a');
		await expect(tab.access.authorize('a', grant)).resolves.toBe(
			tab.clients.get('a')
		);
		await expect(tab.access.authorize('b', grant)).rejects.toThrow(
			'not valid for this site'
		);
		await expect(tab.access.authorize('a', 'forged')).rejects.toThrow(
			'not valid for this site'
		);
		browser.advance(31 * 60 * 1000);
		await expect(tab.access.authorize('a', grant)).rejects.toThrow(
			'expired'
		);
	});

	it('are denied for multi-site configs without a confirmation callback', async () => {
		const tab = createBrowser().openTab([site('a', true), site('b')]);
		await expect(tab.access.request('a')).rejects.toThrow('did not grant');
	});

	it('act only on the current site', async () => {
		const tab = createBrowser().openTab(
			[site('a', true), site('b')],
			async () => 'allow'
		);
		const { grant } = await tab.access.request('b');
		await expect(tab.access.authorize('b', grant)).rejects.toThrow(
			'not the current site'
		);
		await expect(
			tab.access.authorizeSwitch('b', grant)
		).resolves.toBeUndefined();
		tab.activate('b');
		await expect(tab.access.authorize('b', grant)).resolves.toBe(
			tab.clients.get('b')
		);
	});

	it('are revoked when their site is deleted', async () => {
		const tab = createBrowser().openTab([site('a', true)]);
		const { grant } = await tab.access.request('a');
		tab.sites.length = 0;
		await tab.access.sitesChanged();
		tab.sites.push(site('a', true));
		await expect(tab.access.authorize('a', grant)).rejects.toThrow(
			'not valid for this site'
		);
	});

	it('are refused while the shared record is unreadable', async () => {
		const browser = createBrowser();
		const tab = browser.openTab([site('a', true)]);
		browser.storage.setItem('playground-webmcp-site-access', '{');
		await expect(tab.access.request('a')).rejects.toThrow('unavailable');
		await tab.access.endSession();
		await expect(tab.access.request('a')).resolves.toMatchObject({
			siteId: 'a',
		});
	});
});

// Contract: data can flow between two sites only after the user saw a
// Playground-written warning naming both, in any tab and in any order. Tabs,
// expiry and revocation each change the shared state independently.
describe('cross-site access', () => {
	it('warns about sites used in other tabs and revokes them on request', async () => {
		const browser = createBrowser();
		const sites = () => [site('a', true), site('b')];
		const first = browser.openTab(sites(), async () => 'allow');
		const seen: SiteAccessRequest[] = [];
		const second = browser.openTab(sites(), async (request) => {
			seen.push(request);
			return 'allow-revoke-others';
		});
		second.activate('b');
		const a = await first.access.request('a');
		const b = await second.access.request('b');
		expect(seen[0]).toMatchObject({
			earlierSites: [{ siteId: 'a' }],
			sitesWithAccess: [{ siteId: 'a' }],
		});
		await expect(first.access.authorize('a', a.grant)).rejects.toThrow(
			'expired'
		);
		await expect(second.access.authorize('b', b.grant)).resolves.toBe(
			second.clients.get('b')
		);
	});

	it('keeps both grants only with a reason', async () => {
		const browser = createBrowser();
		const decide = vi.fn(async (): Promise<SiteAccessDecision> => 'allow');
		const tab = browser.openTab([site('a', true), site('b')], decide);
		const a = await tab.access.request('a');
		decide.mockResolvedValue('allow-cross-site');
		await expect(tab.access.request('b')).rejects.toThrow('did not grant');
		const b = await tab.access.request('b', { reason: 'Compare themes' });
		expect(decide).toHaveBeenLastCalledWith(
			expect.objectContaining({ reason: 'Compare themes' })
		);
		await expect(tab.access.authorize('a', a.grant)).resolves.toBe(
			tab.clients.get('a')
		);
		await expect(tab.access.authorizeSwitch('b', b.grant)).resolves.toBe(
			undefined
		);
	});

	it('remembers sites whose grants ended', async () => {
		const browser = createBrowser();
		const seen: SiteAccessRequest[] = [];
		const tab = browser.openTab([site('a', true), site('b')], async (r) => {
			seen.push(r);
			return 'allow';
		});
		await tab.access.request('a');
		browser.advance(31 * 60 * 1000);
		await tab.access.request('b');
		expect(seen[1]).toMatchObject({
			earlierSites: [{ siteId: 'a' }],
			sitesWithAccess: [],
		});
	});

	it('refuses a grant when access changed during confirmation', async () => {
		const browser = createBrowser();
		const sites = () => [site('a', true), site('b'), site('c')];
		const other = browser.openTab(sites(), async () => 'allow');
		const tab = browser.openTab(sites(), async () => {
			await other.access.request('c');
			return 'allow';
		});
		await expect(tab.access.request('a')).rejects.toThrow('changed');
	});
});

function site(slug: string, isActive = false): SiteAccessSite {
	return { slug, name: `Site ${slug}`, isActive };
}

/** Tabs of one browser profile sharing storage, locks and a clock. */
function createBrowser() {
	let time = Date.UTC(2026, 0, 1);
	const values = new Map<string, string>();
	const storage = {
		getItem: (key: string) => values.get(key) ?? null,
		setItem: (key: string, value: string) => {
			values.set(key, value);
		},
	};
	let queue: Promise<unknown> = Promise.resolve();
	const locks = {
		request: (_name: string, run: () => Promise<unknown>) => {
			const result = queue.then(run);
			queue = result.catch(() => undefined);
			return result;
		},
	} as unknown as Pick<LockManager, 'request'>;
	const now = () => time;
	return {
		storage,
		advance(ms: number) {
			time += ms;
		},
		openTab(
			sites: SiteAccessSite[],
			confirm?: (
				request: SiteAccessRequest
			) => Promise<SiteAccessDecision>
		) {
			const clients = new Map(
				sites.map((s) => [s.slug, { site: s.slug } as never])
			) as Map<string, PlaygroundClient>;
			const access = createSiteAccess({
				listSites: () => sites,
				getActiveClient: () =>
					clients.get(sites.find((s) => s.isActive)?.slug ?? ''),
				confirm,
				registry: createSiteAccessRegistry({ storage, locks, now }),
				now,
			});
			return {
				access,
				clients,
				sites,
				activate(slug: string) {
					for (const s of sites) {
						s.isActive = s.slug === slug;
					}
				},
			};
		},
	};
}
