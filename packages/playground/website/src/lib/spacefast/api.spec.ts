import { SpacefastClient } from './api';

const fetchMock = vi.fn<typeof fetch>();

describe('Spacefast publishing', () => {
	beforeEach(() => {
		fetchMock.mockReset();
		vi.stubGlobal('fetch', fetchMock);
	});
	afterEach(() => vi.unstubAllGlobals());

	it.each(['X-Upload-Token', 'Authorization'])(
		'uses only issued upload credentials (%s) outside the management API',
		async (uploadHeader) => {
			const client = new SpacefastClient('https://proxy.test/?');
			fetchMock.mockResolvedValueOnce(
				json({
					data: {
						kind: 'space',
						spaceId: 'spc_test',
						apiKey: { secret: 'test-management-key' },
					},
				})
			);
			await client.connect(
				'https://api.spacefast.com/handoffs/testHandoff1234567890'
			);
			expect(fetchMock.mock.calls[0][0]).toBe(
				'https://proxy.test/?https://api.spacefast.com/v1/auth/agent-handoffs/redeem'
			);
			expect(
				new Headers(fetchMock.mock.calls[0][1]?.headers).has(
					'Idempotency-Key'
				)
			).toBe(false);
			fetchMock.mockResolvedValueOnce(
				json({
					data: {
						version: { id: 'ver_test' },
						upload: {
							targets: [
								{
									path: '_playground/database.sqlite',
									method: 'PUT',
									url: 'https://uploads.example.test/issued-target',
									headers: {
										[uploadHeader]: 'upload-only-token',
									},
								},
							],
						},
						links: { refresh: '/refresh', finalize: '/finalize' },
					},
				})
			);
			fetchMock.mockResolvedValueOnce(
				new Response(null, { status: 204 })
			);
			fetchMock.mockResolvedValueOnce(json({ data: { upload: null } }));
			fetchMock.mockResolvedValueOnce(json({ data: { id: 'ver_test' } }));
			fetchMock.mockResolvedValueOnce(
				json({ data: { id: 'ver_test', status: 'ready' } })
			);
			fetchMock.mockResolvedValueOnce(
				json({
					data: {
						id: 'spc_test',
						liveUrl: 'https://example.space.fast/',
						channels: { live: { versionId: 'ver_test' } },
					},
				})
			);
			const database = new Blob(['SQLite bytes']);
			const published = await client.publish(
				'spc_test',
				[
					{
						path: '_playground/database.sqlite',
						data: database,
					},
				],
				{ replace: false, deletePaths: [] },
				vi.fn()
			);
			expect(published.versionId).toBe('ver_test');
			const upload = fetchMock.mock.calls.find(
				([url]) =>
					url ===
					'https://proxy.test/?https://uploads.example.test/issued-target'
			)!;
			expect(upload[1]).toMatchObject({
				method: 'PUT',
				body: database,
			});
			expect(new Headers(upload[1]?.headers).get(uploadHeader)).toBe(
				'upload-only-token'
			);
			if (uploadHeader === 'Authorization') {
				expect(
					new Headers(upload[1]?.headers).get(
						'X-Cors-Proxy-Allowed-Request-Headers'
					)
				).toBe('authorization');
			}
			for (const [url, init] of fetchMock.mock.calls.slice(1)) {
				const authorization = new Headers(init?.headers).get(
					'authorization'
				);
				expect(authorization).toBe(
					new URL(new URL(String(url)).search.slice(1)).origin ===
						'https://api.spacefast.com'
						? 'Bearer test-management-key'
						: uploadHeader === 'Authorization'
							? 'upload-only-token'
							: null
				);
			}
		}
	);

	it('does not forward a credential to a foreign finalize URL returned in a receipt', async () => {
		const client = new SpacefastClient('');
		fetchMock.mockResolvedValueOnce(
			json({
				data: {
					version: { id: 'ver_test' },
					links: { finalize: 'https://foreign.test/finalize' },
				},
			})
		);
		await expect(
			client.publish(
				'spc_test',
				[],
				{ replace: false, deletePaths: [] },
				vi.fn()
			)
		).rejects.toThrow('another origin');
		expect(fetchMock).toHaveBeenCalledTimes(1);
	});

	it('does not report a ready but unpromoted version as a live save', async () => {
		const client = new SpacefastClient('');
		fetchMock.mockResolvedValueOnce(
			json({ data: { version: { id: 'ver_new' } } })
		);
		fetchMock.mockResolvedValueOnce(
			json({ data: { id: 'ver_new', status: 'ready' } })
		);
		fetchMock.mockResolvedValueOnce(
			json({
				data: {
					id: 'spc_test',
					channels: { live: { versionId: 'ver_old' } },
				},
			})
		);
		await expect(
			client.publish(
				'spc_test',
				[],
				{ replace: false, deletePaths: [] },
				vi.fn()
			)
		).rejects.toThrow('not live');
	});
});

function json(body: unknown) {
	return new Response(JSON.stringify(body), {
		headers: { 'Content-Type': 'application/json' },
	});
}
