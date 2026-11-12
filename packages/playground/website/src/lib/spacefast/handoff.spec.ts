import { extractSpacefastHandoffUrl } from './handoff';

describe('Spacefast handoff extraction', () => {
	const url = 'https://api.spacefast.com/handoffs/testHandoff1234567890';

	it.each([
		url,
		`Use Spacefast:\n${url}\nContinue with my project.`,
		`Read https://spacefast.com/docs first, then [connect](${url}).`,
		`Connect using <${url}>`,
		`Use \`${url}\`.`,
	])('extracts only the handoff URL from %s', (prompt) => {
		expect(extractSpacefastHandoffUrl(prompt)).toBe(url);
	});

	it.each(['https://api.spacefast.com', 'https://spacefast.com'])(
		'accepts URL-safe handoff tokens on %s',
		(origin) => {
			const handoff = `${origin}/handoffs/test_Handoff-1234567890`;
			expect(
				extractSpacefastHandoffUrl(`Connect using ${handoff}.`)
			).toBe(handoff);
		}
	);

	it.each([
		'https://api.spacefast.com.evil.test/handoffs/testHandoff1234567890',
		'https://evil.test/https://api.spacefast.com/handoffs/testHandoff1234567890',
		'https://user@api.spacefast.com/handoffs/testHandoff1234567890',
		'https://api.spacefast.com/handoffs/testHandoff1234567890/extra',
		'https://api.spacefast.com/handoffs/testHandoff1234567890?redirect=other',
		'https://api.spacefast.com/handoffs/short',
		'https://spacefast.com/docs',
		'no URL here',
	])('rejects %s', (prompt) => {
		expect(extractSpacefastHandoffUrl(prompt)).toBeUndefined();
	});
});
