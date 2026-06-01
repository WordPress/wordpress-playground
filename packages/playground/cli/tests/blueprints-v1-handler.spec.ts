import { describe, expect, test, vi } from 'vitest';
import { BlueprintsV1Handler } from '../src/blueprints-v1/blueprints-v1-handler';
import type { CLIOutput } from '../src/cli-output';
import type { RunCLIArgs } from '../src/run-cli';

describe('BlueprintsV1Handler', () => {
	const cliOutput = {
		updateProgress: vi.fn(),
	} as unknown as CLIOutput;

	function getEffectiveBlueprint(args: RunCLIArgs) {
		const handler = new BlueprintsV1Handler(args, {
			siteUrl: 'http://127.0.0.1:9400',
			cliOutput,
		});
		return (handler as any).getEffectiveBlueprint();
	}

	test('does not treat parsed CLI defaults as explicit v1 overrides', () => {
		const blueprint = getEffectiveBlueprint({
			command: 'server',
			php: '8.3',
			wp: 'latest',
			login: true,
			cliProvidedOptions: {
				php: false,
				wp: false,
				login: false,
			},
			blueprint: {
				login: false,
				preferredVersions: {
					php: '7.4',
					wp: '6.4',
				},
			},
		} as RunCLIArgs);

		expect(blueprint).toMatchObject({
			login: false,
			preferredVersions: {
				php: '7.4',
				wp: '6.4',
			},
		});
	});

	test('applies explicit CLI overrides to v1 declarations', () => {
		const blueprint = getEffectiveBlueprint({
			command: 'server',
			php: '8.2',
			wp: '6.8',
			login: true,
			cliProvidedOptions: {
				php: true,
				wp: true,
				login: true,
			},
			blueprint: {
				login: false,
				preferredVersions: {
					php: '7.4',
					wp: '6.4',
				},
			},
		} as RunCLIArgs);

		expect(blueprint).toMatchObject({
			login: true,
			preferredVersions: {
				php: '8.2',
				wp: '6.8',
			},
		});
	});

	test('applies explicit --no-login to v1 declarations', () => {
		const blueprint = getEffectiveBlueprint({
			command: 'server',
			login: false,
			cliProvidedOptions: {
				login: true,
			},
			blueprint: {
				login: true,
			},
		} as RunCLIArgs);

		expect(blueprint.login).toBe(false);
	});
});
