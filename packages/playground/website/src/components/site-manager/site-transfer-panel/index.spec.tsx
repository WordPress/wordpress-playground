// @vitest-environment jsdom
import { act, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import type { PlaygroundClient } from '@wp-playground/client';
import { updateSiteMetadata } from '../../../lib/state/redux/slice-sites';
import { getPlaygroundDefinedPHPConstants } from '../../../lib/state/redux/playground-defined-php-constants';
import type { SiteInfo } from '../../../lib/state/redux/slice-sites';
import { detectReprint, transferSite } from '../../../lib/reprint/reprint';
import type * as Reprint from '../../../lib/reprint/reprint';
import { SiteTransferPanel } from './index';
import { DockPane } from '../../dock/dock-pane';
import type {
	SiteToolPanelProps,
	ToolHeaderState,
} from '../site-info-panel/site-tool-renderers';

const { ui, dispatch } = vi.hoisted(() => ({
	ui: {
		pullRequestedForSite: undefined as string | undefined,
		cloneRequested: false,
		pendingClone: undefined as
			| { slug: string; url: string; secret: string }
			| undefined,
	},
	dispatch: vi.fn(),
}));
vi.mock('../../../lib/state/redux/store', () => ({
	useAppDispatch: () => dispatch,
	useAppSelector: (selector: (state: { ui: typeof ui }) => unknown) =>
		selector({ ui }),
}));
vi.mock('../../../lib/state/redux/slice-sites', () => ({
	preserveSite: vi.fn(),
	selectAllSites: () => [],
	updateSiteMetadata: vi.fn(),
}));
vi.mock('../../../lib/state/redux/site-management-api-middleware', () => ({
	useSitesAPI: () => ({
		createNewTemporarySite: vi.fn(async (slug: string) => slug),
		autosaveTemporarySite: vi.fn(async () => ({})),
	}),
}));
vi.mock('../../../lib/state/redux/playground-defined-php-constants', () => ({
	getPlaygroundDefinedPHPConstants: vi.fn(),
}));
vi.mock('../../../lib/reprint/reprint', async (original) => ({
	...(await original<typeof Reprint>()),
	detectReprint: vi.fn(),
	transferSite: vi.fn(),
}));
vi.mock('virtual:cors-proxy-url', () => ({ corsProxyUrl: '' }));
vi.mock('@wordpress/components', () => ({
	Button: ({
		children,
		variant: _variant,
		isDestructive: _destructive,
		isBusy: _busy,
		type = 'button',
		...props
	}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
		variant?: string;
		isDestructive?: boolean;
		isBusy?: boolean;
	}) => (
		<button type={type} {...props}>
			{children}
		</button>
	),
	// The menu renders open so its items can be clicked like any button.
	DropdownMenu: ({
		children,
	}: {
		children: (props: { onClose: () => void }) => React.ReactNode;
	}) => <div>{children({ onClose: () => {} })}</div>,
	MenuItem: ({
		children,
		...props
	}: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
		<button type="button" {...props}>
			{children}
		</button>
	),
	Notice: ({ children }: { children: React.ReactNode }) => (
		<div>{children}</div>
	),
	__experimentalVStack: ({ children }: { children: React.ReactNode }) => (
		<div>{children}</div>
	),
	TextControl: ({
		label,
		onChange,
		help: _help,
		__nextHasNoMarginBottom: _noMargin,
		...props
	}: Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange'> & {
		label: string;
		help?: string;
		__nextHasNoMarginBottom?: boolean;
		onChange: (value: string) => void;
	}) => (
		<label>
			{label}
			<input
				{...props}
				onChange={(event) => onChange(event.target.value)}
			/>
		</label>
	),
	TextareaControl: ({
		label,
		__nextHasNoMarginBottom: _noMargin,
		...props
	}: React.TextareaHTMLAttributes<HTMLTextAreaElement> & {
		label: string;
		__nextHasNoMarginBottom?: boolean;
	}) => (
		<label>
			{label}
			<textarea {...props} />
		</label>
	),
	CheckboxControl: ({
		label,
		checked,
		onChange,
	}: {
		label: string;
		checked: boolean;
		onChange: (checked: boolean) => void;
	}) => (
		<label>
			<input
				type="checkbox"
				checked={checked}
				onChange={(event) => onChange(event.target.checked)}
			/>
			{label}
		</label>
	),
}));

// A response for site A must never unlock setup for site B or carry A's key
// across a URL edit. Network replies and saved-address reads resolve separately.
describe('Reprint connection changes', () => {
	let container: HTMLDivElement;
	let root: Root;
	let playground: PlaygroundClient;
	beforeEach(() => {
		vi.resetAllMocks();
		ui.pullRequestedForSite = undefined;
		ui.pendingClone = undefined;
		ui.cloneRequested = false;
		dispatch.mockImplementation((action) => {
			if (action?.type === 'ui/setSitePullRequest')
				ui.pullRequestedForSite = action.payload;
			if (action?.type === 'ui/setPendingClone')
				ui.pendingClone = action.payload;
		});
		vi.mocked(transferSite).mockResolvedValue({});
		playground = {
			documentRoot: Promise.resolve('/wordpress'),
			fileExists: vi.fn().mockResolvedValue(false),
			readFileAsText: vi.fn(),
		} as unknown as PlaygroundClient;
		vi.mocked(getPlaygroundDefinedPHPConstants).mockResolvedValue({
			PLAYGROUND_AUTO_LOGIN_AS_USER: 'imported-admin',
			WP_DEBUG: true,
		});
		sessionStorage.clear();
		vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
		container = document.createElement('div');
		document.body.append(container);
		root = createRoot(container);
	});
	afterEach(() => {
		act(() => root.unmount());
		container.remove();
		vi.unstubAllGlobals();
	});

	it('ignores a late detection result after the address changes', async () => {
		let finish!: (value: 'configured') => void;
		vi.mocked(detectReprint).mockReturnValueOnce(
			new Promise((resolve) => {
				finish = resolve;
			})
		);
		await render();
		edit('url', 'https://first.example');
		await submit();
		const signal = vi.mocked(detectReprint).mock.calls[0][1];
		edit('url', 'https://second.example');
		await act(async () => finish('configured'));
		expect(signal.aborted).toBe(true);
		expect(container.querySelector('input[type=password]')).toBeNull();
		expect(container.querySelector('a[href*="wp-admin"]')).toBeNull();
	});
	it('clears the old key before connecting to another address', async () => {
		vi.mocked(detectReprint).mockResolvedValue('configured');
		await render();
		edit('url', 'https://first.example');
		await submit();
		edit('password', 'first-site-private-key');
		await click('Back to site address');
		edit('url', 'https://second.example');
		await submit();
		expect(
			container.querySelector<HTMLInputElement>('input[type=password]')!
				.value
		).toBe('');
		expect(
			container.querySelector<HTMLAnchorElement>('a[href*="tools.php"]')!
				.href
		).toBe('https://second.example/wp-admin/tools.php?page=reprint-server');
	});

	it('does not replace a typed address when the saved address loads later', async () => {
		let finish!: (value: string) => void;
		await render({
			documentRoot: Promise.resolve('/wordpress'),
			fileExists: vi.fn().mockResolvedValue(true),
			readFileAsText: vi.fn().mockReturnValue(
				new Promise((resolve) => {
					finish = resolve;
				})
			),
		} as unknown as PlaygroundClient);
		edit('url', 'https://typed.example');
		await act(async () =>
			finish(
				JSON.stringify({ url: 'https://saved.example/?reprint-api' })
			)
		);
		expect(
			container.querySelector<HTMLInputElement>('input[type=url]')!.value
		).toBe('https://typed.example');
	});

	// Editing or stepping back must not start a pull. Only submitting the key
	// starts it, with no direction choice or second confirmation screen.
	it('preserves the key when stepping back and pulls on key submission', async () => {
		vi.mocked(detectReprint).mockResolvedValue('configured');
		await render();
		edit('url', 'https://example.com');
		await submit();
		edit('password', 'private-key');
		await click('Back to site address');
		await submit();
		expect(
			container.querySelector<HTMLInputElement>('input[type=password]')!
				.value
		).toBe('private-key');
		expect(transferSite).not.toHaveBeenCalled();
		await submit();
		expect(transferSite).toHaveBeenCalledWith(
			playground,
			'pull',
			'https://example.com/',
			'private-key',
			expect.any(Function),
			expect.any(AbortSignal)
		);
		expect(container.textContent).toContain('Open site');
	});

	it('focuses each input and explains completed steps without retaining their forms', async () => {
		vi.mocked(detectReprint).mockResolvedValue('configured');
		await render();
		expect(document.activeElement).toBe(
			container.querySelector('input[type=url]')
		);
		edit('url', 'https://example.com');
		await submit();
		expect(document.activeElement).toBe(
			container.querySelector('input[type=password]')
		);
		expect(container.textContent).toContain('Reprint key on example.com');
		edit('password', 'private-key');
		await submit();
		expect(container.textContent).toContain('example.com cloned');
		expect(container.querySelector('input')).toBeNull();
	});

	it('remembers the key across panel remounts but never sends it to another live site', async () => {
		vi.mocked(detectReprint).mockResolvedValue('configured');
		await render();
		edit('url', 'https://example.com');
		await submit();
		edit('password', 'private-key');
		await submit();
		act(() => root.unmount());
		root = createRoot(container);
		await render();
		expect(
			container.querySelector<HTMLInputElement>('input[type=url]')!.value
		).toBe('https://example.com/');
		await submit();
		expect(
			container.querySelector<HTMLInputElement>('input[type=password]')!
				.value
		).toBe('private-key');
		await click('Back to site address');
		edit('url', 'https://another.example');
		await submit();
		expect(
			container.querySelector<HTMLInputElement>('input[type=password]')!
				.value
		).toBe('');
	});

	it('ignores a recheck reply after going back to change the site', async () => {
		vi.mocked(detectReprint).mockResolvedValueOnce('not-detected');
		await render();
		edit('url', 'https://first.example');
		await submit();
		let finish!: (value: 'configured') => void;
		vi.mocked(detectReprint).mockReturnValueOnce(
			new Promise((resolve) => {
				finish = resolve;
			})
		);
		await click('I’ve activated Reprint — check again');
		const signal = vi.mocked(detectReprint).mock.calls[1][1];
		await click('Back to site address');
		edit('url', 'https://second.example');
		await act(async () => finish('configured'));
		expect(signal.aborted).toBe(true);
		expect(
			container.querySelector<HTMLInputElement>('input[type=url]')!.value
		).toBe('https://second.example');
		expect(container.querySelector('input[type=password]')).toBeNull();
	});

	it('asks for a key created in Reprint settings when the server has none', async () => {
		vi.mocked(detectReprint).mockResolvedValue('needs-key');
		await render();
		edit('url', 'https://example.com');
		await submit();
		expect(container.textContent).toContain(
			'Reprint Server has no key yet'
		);
		edit('password', 'key-from-wp-admin');
		await submit();
		expect(container.querySelector('input')).toBeNull();
		expect(vi.mocked(transferSite).mock.calls[0][3]).toBe(
			'key-from-wp-admin'
		);
	});

	it('copies the audit log while the transfer promise is still pending', async () => {
		vi.mocked(detectReprint).mockResolvedValue('configured');
		let finish!: (value: Awaited<ReturnType<typeof transferSite>>) => void;
		vi.mocked(transferSite).mockReturnValueOnce(
			new Promise((resolve) => {
				finish = resolve;
			})
		);
		const writeText = vi.fn().mockResolvedValue(undefined);
		vi.stubGlobal('navigator', { clipboard: { writeText } });
		const root = '/tmp/playground-reprint-state';
		const files: Record<string, string> = {
			[root + '/site/operation.json']: '{"stage":"files-pull"}',
			[root + '/site/pull-state/audit.log']:
				'Last transfer record private-key',
		};
		const playground = {
			documentRoot: Promise.resolve('/wordpress'),
			fileExists: vi.fn(
				async (path: string) => path === root || path in files
			),
			listFiles: vi.fn(async () => ['site']),
			readFileAsText: vi.fn(async (path: string) => files[path]),
		} as unknown as PlaygroundClient;
		await render(playground);
		edit('url', 'https://example.com');
		await submit();
		edit('password', 'private-key');
		await submit();
		await click('Copy transfer log');
		expect(writeText).toHaveBeenCalledWith(
			expect.stringContaining('Last transfer record [redacted]')
		);
		expect(writeText).toHaveBeenCalledWith(
			expect.stringContaining('"stage":"files-pull"')
		);
		expect(container.querySelector('textarea')).toBeNull();
		expect(transferSite).toHaveBeenCalledTimes(1);
		await act(async () => finish({}));
	});

	it('stops after the current step and returns to the key step without an error', async () => {
		vi.mocked(detectReprint).mockResolvedValue('configured');
		vi.mocked(transferSite).mockImplementationOnce(
			(_playground, _direction, _url, _secret, _onProgress, signal) =>
				new Promise((_resolve, reject) => {
					signal!.addEventListener('abort', () =>
						reject(new DOMException('Pull stopped.', 'AbortError'))
					);
				})
		);
		await render({
			documentRoot: Promise.resolve('/wordpress'),
			fileExists: vi.fn().mockResolvedValue(false),
		} as unknown as PlaygroundClient);
		edit('url', 'https://example.com');
		await submit();
		edit('password', 'private-key');
		await submit();
		await click('Stop');
		await click('Stop pulling');
		// The rejection settles the transfer on a later microtask.
		await act(async () => {});
		expect(
			container.querySelector<HTMLInputElement>('input[type=password]')!
				.value
		).toBe('private-key');
		expect(container.textContent).not.toContain('Pull stopped');
	});

	it('shows a transfer failure during saving but waits before allowing retry', async () => {
		vi.mocked(detectReprint).mockResolvedValue('configured');
		let finish!: (error: Error) => void;
		vi.mocked(transferSite).mockImplementationOnce(
			(_playground, _direction, _url, _secret, onProgress) => {
				onProgress({
					message: 'Saving downloaded files to browser storage…',
					phase: 'files-prepare',
					error: 'A linked file is missing',
					overallPercent: 54,
				});
				return new Promise((_resolve, reject) => {
					finish = reject;
				});
			}
		);
		await render({
			documentRoot: Promise.resolve('/wordpress'),
			fileExists: vi.fn().mockResolvedValue(false),
		} as unknown as PlaygroundClient);
		edit('url', 'https://example.com');
		await submit();
		edit('password', 'private-key');
		await submit();
		expect(container.textContent).toContain('A linked file is missing');
		expect(container.textContent).not.toContain('Resume local setup');
		await act(async () => finish(new Error('A linked file is missing')));
		expect(container.textContent).toContain('Resume local setup');
		vi.mocked(transferSite).mockResolvedValueOnce({});
		await click('Resume local setup');
		expect(vi.mocked(transferSite).mock.calls[1][3]).toBe('private-key');
		expect(container.textContent).not.toContain('A linked file is missing');
	});

	it.each(['error', 'pull'] as const)(
		'leaves a usable screen after transfer %s',
		async (result) => {
			vi.mocked(detectReprint).mockResolvedValue('configured');
			if (result.endsWith('error'))
				vi.mocked(transferSite).mockRejectedValueOnce(
					new Error('Connection failed')
				);
			else vi.mocked(transferSite).mockResolvedValueOnce({});
			await render({
				documentRoot: Promise.resolve('/wordpress'),
				fileExists: vi.fn().mockResolvedValue(false),
			} as unknown as PlaygroundClient);
			edit('url', 'https://example.com');
			await submit();
			edit('password', 'private-key');
			await submit();
			expect(transferSite).toHaveBeenCalledTimes(1);
			if (result === 'pull') {
				expect(updateSiteMetadata).toHaveBeenCalledWith({
					slug: 'test',
					changes: {
						playgroundDefinedConstants: {
							PLAYGROUND_AUTO_LOGIN_AS_USER: 'imported-admin',
							WP_DEBUG: true,
						},
					},
				});
			} else {
				expect(updateSiteMetadata).not.toHaveBeenCalled();
			}
			if (result.endsWith('error')) {
				expect(container.textContent).toContain('Connection failed');
				expect(container.textContent).not.toContain('Re-enter');
				const originalKey = vi.mocked(transferSite).mock.calls[0][3];
				vi.mocked(transferSite).mockResolvedValueOnce({});
				await click('Try resuming');
				expect(transferSite).toHaveBeenCalledTimes(2);
				expect(vi.mocked(transferSite).mock.calls[1][3]).toBe(
					originalKey
				);
			} else {
				expect(container.querySelector('input')).toBeNull();
				expect(container.textContent).toContain('Open site');
				expect(container.textContent).toContain(
					'signed in as an administrator'
				);
				expect(container.textContent).not.toContain(
					'Back to connection key'
				);
			}
		}
	);

	it('pulls fresh changes with the saved key on reopening, but not while hidden or already pulling', async () => {
		vi.mocked(playground.fileExists).mockResolvedValue(true);
		vi.mocked(playground.readFileAsText).mockResolvedValue(
			JSON.stringify({ url: 'https://example.com/?reprint-api' })
		);
		sessionStorage.setItem(
			'playground-reprint:test',
			JSON.stringify({ url: 'https://example.com/', secret: 'saved-key' })
		);
		ui.pullRequestedForSite = 'test';
		await render(playground, false);
		expect(transferSite).not.toHaveBeenCalled();
		let finish!: (result: Awaited<ReturnType<typeof transferSite>>) => void;
		vi.mocked(transferSite).mockReturnValueOnce(
			new Promise((resolve) => {
				finish = resolve;
			})
		);
		await render(playground, true);
		expect(transferSite).toHaveBeenCalledTimes(1);
		expect(vi.mocked(transferSite).mock.calls[0].slice(1, 4)).toEqual([
			'pull',
			'https://example.com/',
			'saved-key',
		]);
		ui.pullRequestedForSite = 'test';
		await render(playground, false);
		await render(playground, true);
		expect(transferSite).toHaveBeenCalledTimes(1);
		await act(async () => finish({}));
		ui.pullRequestedForSite = 'test';
		await render(playground, false);
		await render(playground, true);
		expect(transferSite).toHaveBeenCalledTimes(2);
	});

	it('cancels the pending pull when going back before the new site finishes booting', async () => {
		ui.pendingClone = {
			slug: 'test',
			url: 'https://example.com/',
			secret: 'saved-key',
		};
		// No client yet: the new Playground is still booting.
		await render(null as unknown as PlaygroundClient, true);
		await click('Back to connection key');
		await render(playground, true);
		expect(transferSite).not.toHaveBeenCalled();
		expect(
			container.querySelector<HTMLInputElement>('input[type=password]')!
				.value
		).toBe('saved-key');
		await submit();
		expect(transferSite).toHaveBeenCalledTimes(1);
	});

	it('requires key submission if the remembered key belongs to another address', async () => {
		ui.pullRequestedForSite = 'test';
		vi.mocked(playground.fileExists).mockResolvedValue(true);
		vi.mocked(playground.readFileAsText).mockResolvedValue(
			JSON.stringify({ url: 'https://actual.example/?reprint-api' })
		);
		sessionStorage.setItem(
			'playground-reprint:test',
			JSON.stringify({ url: 'https://old.example/', secret: 'wrong-key' })
		);
		await render();
		expect(
			container.querySelector<HTMLInputElement>('input[type=password]')!
				.value
		).toBe('');
		edit('password', 'correct-key');
		expect(transferSite).not.toHaveBeenCalled();
		await submit();
		expect(vi.mocked(transferSite).mock.calls[0].slice(1, 4)).toEqual([
			'pull',
			'https://actual.example/',
			'correct-key',
		]);
	});

	it('does not pull merely because the panel mounts with a remembered connection', async () => {
		vi.mocked(playground.fileExists).mockResolvedValue(true);
		vi.mocked(playground.readFileAsText).mockResolvedValue(
			JSON.stringify({ url: 'https://example.com/?reprint-api' })
		);
		sessionStorage.setItem(
			'playground-reprint:test',
			JSON.stringify({ url: 'https://example.com/', secret: 'saved-key' })
		);
		await render();
		expect(
			container.querySelector<HTMLInputElement>('input[type=password]')!
				.value
		).toBe('saved-key');
		expect(transferSite).not.toHaveBeenCalled();
	});

	async function click(text: string, startsWith = false) {
		await act(async () => {
			const button = Array.from(
				container.querySelectorAll('button')
			).find((button) =>
				startsWith
					? button.textContent!.startsWith(text)
					: (button.getAttribute('aria-label') ??
							button.textContent) === text
			);
			expect(button).toBeDefined();
			button!.click();
		});
	}

	async function render(
		client: PlaygroundClient = playground,
		isVisible = true,
		initialOpfsSyncPending = false
	) {
		await act(async () =>
			root.render(
				<TransferPanelInDock
					site={
						{
							slug: 'test',
							metadata: {
								storage: 'opfs',
								initialOpfsSyncPending,
								runtimeConfiguration: {
									networking: true,
									phpVersion: '8.3',
								},
							},
						} as SiteInfo
					}
					playground={client}
					isVisible={isVisible}
					mobileHeaderTarget={null}
				/>
			)
		);
	}
	function edit(type: string, value: string) {
		act(() => {
			const input = container.querySelector<HTMLInputElement>(
				`input[type=${type}]`
			)!;
			Object.getOwnPropertyDescriptor(
				HTMLInputElement.prototype,
				'value'
			)!.set!.call(input, value);
			input.dispatchEvent(new Event('input', { bubbles: true }));
		});
	}
	async function submit() {
		await act(async () =>
			container
				.querySelector('form')!
				.dispatchEvent(
					new Event('submit', { bubbles: true, cancelable: true })
				)
		);
	}
});

function TransferPanelInDock(props: SiteToolPanelProps) {
	const [back, setBack] = useState<ToolHeaderState>();
	const { action, ...header } = back ?? {};
	return (
		<DockPane
			title="Pull WordPress site"
			headerAction={action}
			headerOverride={
				back ? { title: 'Pull WordPress site', ...header } : undefined
			}
		>
			<SiteTransferPanel {...props} onBackChange={setBack} />
		</DockPane>
	);
}
