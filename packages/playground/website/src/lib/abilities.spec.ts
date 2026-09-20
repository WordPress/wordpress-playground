import { describe, expect, it, vi } from 'vitest';
import type { AbilitiesList, PlaygroundClient } from '@wp-playground/remote';
import { AbilitiesController } from './abilities';

// Contract: registrations belong to the active site's explicit selections.
// Async discovery and browser callbacks can otherwise resurrect revoked tools.
function setup() {
	const tools = new Map<
		string,
		{ execute: (input: Record<string, unknown>) => Promise<unknown> }
	>();
	const model = {
		tools: [],
		provideContext: vi.fn(),
		registerTool: vi.fn(async (tool, { signal }) => {
			if (signal.aborted) return;
			if (!/^[a-zA-Z0-9_.-]{1,128}$/.test(tool.name)) {
				throw new Error('Invalid WebMCP tool name');
			}
			if (tools.has(tool.name)) throw new Error('Name collision');
			tools.set(tool.name, tool);
			signal.addEventListener('abort', () => tools.delete(tool.name));
		}),
	};
	const data: AbilitiesList = {
		available: true,
		user: { id: 1, name: 'admin' },
		abilities: [
			{
				name: 'test/echo',
				label: 'Echo',
				description: 'Echo input',
				category: 'test',
				input_schema: { type: 'string' },
				output_schema: null,
				meta: {},
			},
		],
	};
	let navigate = () => {};
	const client = {
		listAbilities: vi.fn(async () => data),
		executeAbility: vi.fn(async (_name, input) => ({
			success: true,
			data: input,
		})),
		onNavigation: vi.fn(async (callback) => {
			navigate = callback;
		}),
	} as unknown as PlaygroundClient;
	const controller = new AbilitiesController(() => model);
	controller.setSite('one', client, ['one', 'two']);
	return {
		controller,
		client,
		tools,
		model,
		data,
		navigate: () => navigate(),
	};
}

describe('ability exposure lifecycle', () => {
	it('starts off and rejects retained callbacks after disable', async () => {
		const { controller, tools, client } = setup();
		await controller.refresh();
		expect(tools.size).toBe(0);
		controller.toggle('test/echo', true);
		const tool = tools.get('wp_ability_test.echo')!;
		expect(await tool.execute({ input: 'hello' })).toEqual({
			success: true,
			data: 'hello',
		});
		controller.toggle('test/echo', false);
		expect(tools.size).toBe(0);
		await expect(tool.execute({ input: 'late' })).rejects.toThrow(
			'no longer exposed'
		);
		expect(client.executeAbility).toHaveBeenCalledTimes(1);
	});
	it('isolates sites, restores session selections, and removes deleted site choices', async () => {
		const { controller, client, tools } = setup();
		await controller.refresh();
		controller.toggle('test/echo', true);
		const oldTool = tools.get('wp_ability_test.echo')!;
		controller.setSite('two', undefined, ['one', 'two']);
		expect(tools.size).toBe(0);
		await expect(oldTool.execute({})).rejects.toThrow();
		controller.setSite('one', client, ['one', 'two']);
		await vi.waitFor(() => expect(tools.size).toBe(1));
		controller.setSite('two', undefined, ['two']);
		controller.setSite('one', client, ['one', 'two']);
		await controller.refresh();
		expect(controller.getSnapshot().enabled).toEqual([]);
	});
	it('ignores discovery from a previous site', async () => {
		const { controller, client, data } = setup();
		let resolve!: (value: AbilitiesList) => void;
		vi.mocked(client.listAbilities).mockImplementationOnce(
			() =>
				new Promise((done) => {
					resolve = done;
				})
		);
		const pending = controller.refresh();
		controller.setSite('two', undefined, ['one', 'two']);
		resolve(data);
		await pending;
		expect(controller.getSnapshot().data).toBeUndefined();
	});
	it('revokes on navigation and removes abilities that disappear', async () => {
		const { controller, client, tools, data, navigate } = setup();
		await controller.refresh();
		controller.toggle('test/echo', true);
		const tool = tools.get('wp_ability_test.echo')!;
		vi.mocked(client.listAbilities).mockResolvedValue({
			...data,
			abilities: [],
		});
		navigate();
		expect(tools.size).toBe(0);
		await expect(tool.execute({})).rejects.toThrow();
		await vi.waitFor(() =>
			expect(controller.getSnapshot().loading).toBe(false)
		);
		expect(controller.getSnapshot().enabled).toEqual([]);
	});
	it('reports registration failures and permits manual execution without WebMCP', async () => {
		const { controller, model, client } = setup();
		await controller.refresh();
		model.registerTool.mockRejectedValueOnce({
			code: 'duplicate_tool',
			message: 'Name collision',
		});
		controller.toggle('test/echo', true);
		await vi.waitFor(() =>
			expect(
				controller.getSnapshot().registrationErrors['test/echo']
			).toContain('Name collision')
		);
		const unsupported = new AbilitiesController(() => undefined);
		unsupported.setSite('one', client, ['one']);
		await unsupported.refresh();
		expect(await unsupported.execute('test/echo', false)).toEqual({
			success: true,
			data: false,
		});
	});
});

// WordPress identifiers must remain intact when the browser calls the renamed tool.
it.each(['core/get-user-info', 'core/get-environment-info'])(
	'registers %s with a valid WebMCP name and calls the original ability',
	async (name) => {
		const { controller, model, client, data, tools } = setup();
		data.abilities[0].name = name;
		await controller.refresh();
		controller.toggle(name, true);
		await vi.waitFor(() =>
			expect(model.registerTool).toHaveBeenCalledOnce()
		);
		expect(controller.getSnapshot().registrationErrors).toEqual({});
		const [toolName, tool] = [...tools.entries()][0];
		expect(toolName).toMatch(/^[a-zA-Z0-9_.-]{1,128}$/);
		await tool.execute({ input: { fields: ['name'] } });
		expect(client.executeAbility).toHaveBeenCalledWith(name, {
			fields: ['name'],
		});
	}
);
