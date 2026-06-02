import {
	BlueprintFetchError,
	resolveRemoteBlueprint,
} from '../../lib/resolve-remote-blueprint';

describe('resolveRemoteBlueprint', () => {
	it('redacts sensitive URLs in fetch errors', async () => {
		const fetch = vi.fn().mockResolvedValue({
			ok: false,
			status: 403,
			statusText: 'Forbidden',
		});

		let caughtError: unknown;
		try {
			await resolveRemoteBlueprint(
				'https://user:pass@example.com/blueprint.json?token=secret',
				{ fetch }
			);
		} catch (error) {
			caughtError = error;
		}

		expect(caughtError).toBeInstanceOf(BlueprintFetchError);
		expect((caughtError as Error).message).toContain(
			'https://REDACTED:REDACTED@example.com/blueprint.json?token=REDACTED'
		);
		expect((caughtError as Error).message).not.toContain('user:pass');
		expect((caughtError as BlueprintFetchError).url).not.toContain(
			'user:pass'
		);
		expect((caughtError as BlueprintFetchError).url).not.toContain(
			'token=secret'
		);
	});
});
