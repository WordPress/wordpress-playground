import { test, expect } from './fixtures/playground-fixtures';

function buildLeftLeaningOrPhp(depth: number): string {
	const terms = Array.from(
		{ length: depth },
		(_, i) => `'tok${i}' === $needle`
	);
	return `<?php
$needle = 'nope';
$r = (
${terms.join(' ||\n')}
);
echo "iter-or ok: PHP=" . PHP_VERSION . " depth=${depth} r=" . var_export($r, true);
`;
}

const DEPTH = 100;

test(`left-leaning ||-chain depth=${DEPTH} compiles without V8 stack overflow`, async ({
	website,
	wordpress,
}) => {
	const blueprint = {
		preferredVersions: { wp: false as const, php: '8.3' },
		landingPage: '/or-probe.php',
		steps: [
			{
				step: 'writeFile' as const,
				path: '/wordpress/or-probe.php',
				data: buildLeftLeaningOrPhp(DEPTH),
			},
		],
	};
	await website.goto(`/#${JSON.stringify(blueprint)}`);

	await expect(wordpress.locator('body')).toContainText('iter-or ok:', {
		timeout: 60000,
	});
});
