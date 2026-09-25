import type {
	AbilitiesList,
	AbilityInput,
	PlaygroundClient,
} from '@wp-playground/remote';
import { getModelContext, stringifyError } from '@wp-playground/mcp/client';

type Snapshot = {
	data?: AbilitiesList;
	loading: boolean;
	error?: string;
	enabled: string[];
	registrationErrors: Record<string, string>;
	generation: number;
};

/** Session-owned state: closing a pane must not revoke its selected tools. */
export class AbilitiesController {
	private listeners = new Set<() => void>();
	private selections = new Map<string, Set<string>>();
	private observed = new WeakSet<PlaygroundClient>();
	private client?: PlaygroundClient;
	private slug?: string;
	private registration?: AbortController;
	private requestId = 0;
	private snapshot: Snapshot = {
		loading: false,
		enabled: [],
		registrationErrors: {},
		generation: 0,
	};

	private modelContext: typeof getModelContext;

	constructor(modelContext = getModelContext) {
		this.modelContext = modelContext;
	}

	getSnapshot = () => this.snapshot;
	subscribe = (listener: () => void) => {
		this.listeners.add(listener);
		return () => {
			this.listeners.delete(listener);
		};
	};
	isSupported = () => Boolean(this.modelContext());

	setSite(
		slug: string | undefined,
		client: PlaygroundClient | undefined,
		existingSlugs: string[]
	) {
		for (const key of this.selections.keys()) {
			if (!existingSlugs.includes(key)) this.selections.delete(key);
		}
		if (this.slug === slug && this.client === client) return;
		this.registration?.abort();
		this.requestId++;
		this.slug = slug;
		this.client = client;
		this.update({
			data: undefined,
			error: undefined,
			loading: false,
			enabled: [...(this.selections.get(slug ?? '') ?? [])],
			registrationErrors: {},
			generation: this.snapshot.generation + 1,
		});
		if (!client) return;
		if (!this.observed.has(client)) {
			this.observed.add(client);
			void client
				.onNavigation(
					() => {
						if (this.client !== client) return;
						this.requestId++;
						this.registration?.abort();
						this.update({
							data: undefined,
							generation: this.snapshot.generation + 1,
						});
						if (this.slug && this.selections.has(this.slug))
							void this.refresh();
					},
					{ includeReloads: true }
				)
				.catch((error) => {
					if (this.client === client)
						this.update({ error: stringifyError(error) });
				});
		}
		if (slug && this.selections.has(slug)) void this.refresh();
	}

	refresh = async () => {
		const client = this.client;
		if (!client || !this.slug) return;
		if (!this.selections.has(this.slug))
			this.selections.set(this.slug, new Set());
		const id = ++this.requestId;
		this.registration?.abort();
		this.update({
			loading: true,
			error: undefined,
			registrationErrors: {},
			generation: this.snapshot.generation + 1,
		});
		try {
			const data = await client.listAbilities();
			if (id !== this.requestId) return;
			const enabled = this.selections.get(this.slug!)!;
			for (const name of enabled) {
				if (!data.abilities.some((ability) => ability.name === name))
					enabled.delete(name);
			}
			this.update({ data, loading: false, enabled: [...enabled] });
			void this.register();
		} catch (error) {
			if (id === this.requestId)
				this.update({
					data: undefined,
					loading: false,
					error: stringifyError(error),
				});
		}
	};

	toggle(name: string, enabled: boolean) {
		if (
			!this.slug ||
			!this.snapshot.data?.abilities.some(
				(ability) => ability.name === name
			)
		)
			return;
		const selected = this.selections.get(this.slug)!;
		if (enabled) selected.add(name);
		else selected.delete(name);
		this.registration?.abort();
		this.update({ enabled: [...selected], registrationErrors: {} });
		void this.register();
	}

	async execute(name: string, input?: AbilityInput) {
		const client = this.client;
		const generation = this.snapshot.generation;
		if (!client) throw new Error('The Playground is still loading.');
		const result = await client.executeAbility(name, input);
		if (client !== this.client || generation !== this.snapshot.generation) {
			throw new Error(
				'The site changed while the ability ran. The operation may have completed.'
			);
		}
		return result;
	}

	private async register() {
		this.registration?.abort();
		const registration = new AbortController();
		this.registration = registration;
		const modelContext = this.modelContext();
		const client = this.client;
		const generation = this.snapshot.generation;
		if (!modelContext || !client || this.snapshot.loading) return;
		for (const ability of this.snapshot.data?.abilities ?? []) {
			if (!this.snapshot.enabled.includes(ability.name)) continue;
			try {
				await modelContext.registerTool(
					{
						// WordPress restricts names to namespace/slug; dots cannot collide.
						name: `wp_ability_${ability.name.replace('/', '.')}`,
						description:
							ability.description ||
							ability.label ||
							ability.name,
						inputSchema: {
							type: 'object',
							properties: { input: ability.input_schema ?? {} },
							additionalProperties: false,
						},
						execute: async (args) => {
							if (
								registration.signal.aborted ||
								client !== this.client ||
								generation !== this.snapshot.generation ||
								!this.snapshot.enabled.includes(ability.name)
							) {
								throw new Error(
									'This ability is no longer exposed by the active Playground.'
								);
							}
							return await this.execute(
								ability.name,
								args.input as AbilityInput | undefined
							);
						},
					},
					{ signal: registration.signal }
				);
			} catch (error) {
				if (!registration.signal.aborted)
					this.update({
						registrationErrors: {
							...this.snapshot.registrationErrors,
							[ability.name]: stringifyError(error),
						},
					});
			}
			if (registration.signal.aborted) return;
		}
	}

	private update(changes: Partial<Snapshot>) {
		this.snapshot = { ...this.snapshot, ...changes };
		for (const listener of this.listeners) listener();
	}
}

export const abilitiesController = new AbilitiesController();
