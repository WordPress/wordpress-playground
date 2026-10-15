import { stringifyError } from '@wp-playground/mcp/client';
import {
	useEffect,
	useId,
	useRef,
	useState,
	useSyncExternalStore,
} from 'react';
import {
	Button,
	Notice,
	SearchControl,
	TextareaControl,
	ToggleControl,
	VisuallyHidden,
} from '@wordpress/components';
import { chevronDown, chevronRight } from '@wordpress/icons';
import type { AbilityDescriptor } from '@wp-playground/remote';
import {
	abilitiesController,
	groupAbilitiesByNamespace,
} from '../../../lib/abilities';
import { InlineProgress, PaneLoading } from '../../pane-loading';
import type { SiteToolPanelProps } from '../site-info-panel/site-tool-renderers';
import css from './style.module.css';

export function SiteAbilitiesPanel({
	isVisible,
	playground,
}: SiteToolPanelProps) {
	const state = useSyncExternalStore(
		abilitiesController.subscribe,
		abilitiesController.getSnapshot
	);
	const [query, setQuery] = useState('');
	// Groups the user expanded without a search, and groups the user collapsed
	// during the current search (search expands every matching group).
	const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
	const [searchCollapsed, setSearchCollapsed] = useState<Set<string>>(
		() => new Set()
	);
	const groupIdPrefix = useId();
	const [selected, setSelected] = useState<string>();
	const [input, setInput] = useState('');
	const [output, setOutput] = useState<string>();
	const [running, setRunning] = useState(false);
	const [error, setError] = useState<string>();
	const runId = useRef(0);
	const detailHeading = useRef<HTMLHeadingElement>(null);
	useEffect(() => {
		if (isVisible && playground) void abilitiesController.refresh();
	}, [isVisible, playground]);
	useEffect(() => {
		runId.current++;
		setOutput(undefined);
		setError(undefined);
		setRunning(false);
	}, [state.generation, selected]);
	useEffect(() => {
		if (selected) detailHeading.current?.focus({ preventScroll: true });
	}, [selected]);
	const ability = state.data?.abilities.find(
		(item) => item.name === selected
	);
	const needle = query.trim().toLowerCase();
	const matches = (item: AbilityDescriptor) =>
		`${item.name} ${item.label} ${item.description}`
			.toLowerCase()
			.includes(needle);
	const groups = groupAbilitiesByNamespace(state.data?.abilities ?? [])
		.map((group) => ({ ...group, shown: group.abilities.filter(matches) }))
		.filter((group) => group.shown.length > 0);
	function isExpanded(namespace: string) {
		return needle
			? !searchCollapsed.has(namespace)
			: expanded.has(namespace);
	}
	function toggleExpanded(namespace: string) {
		const update = (current: Set<string>) => {
			const next = new Set(current);
			if (next.has(namespace)) next.delete(namespace);
			else next.add(namespace);
			return next;
		};
		if (needle) setSearchCollapsed(update);
		else setExpanded(update);
	}
	const supported = abilitiesController.isSupported();
	const webMCPSupported = abilitiesController.isWebMCPSupported();
	// Only name WebMCP where this browser can actually register its tools.
	const channels = webMCPSupported ? 'WebMCP and MCP' : 'MCP';
	async function run() {
		if (!ability) return;
		const id = ++runId.current;
		setError(undefined);
		setOutput(undefined);
		try {
			const value = input.trim() ? JSON.parse(input) : undefined;
			setRunning(true);
			const result = await abilitiesController.execute(
				ability.name,
				value
			);
			if (id === runId.current)
				setOutput(JSON.stringify(result, null, 2));
		} catch (cause) {
			if (id === runId.current) setError(stringifyError(cause));
		} finally {
			if (id === runId.current) setRunning(false);
		}
	}
	if (!playground || (state.loading && !state.data))
		return <PaneLoading message="Loading abilities…" />;
	return (
		<div className={css.panel}>
			<div className={css.toolbar}>
				<span>
					{state.data
						? `Run as ${state.data.user.name}`
						: 'WordPress abilities'}
				</span>
				<Button
					variant="secondary"
					disabled={state.loading || running}
					onClick={() => void abilitiesController.refresh()}
				>
					Refresh
				</Button>
			</div>
			{state.error && (
				<Notice status="error" isDismissible={false}>
					{state.error}
				</Notice>
			)}
			{state.loading && (
				<InlineProgress message="Refreshing abilities…" />
			)}
			{state.data && !state.data.available && (
				<Notice status="info" isDismissible={false}>
					The Abilities API is unavailable. Use WordPress 6.9 or
					later, or install a plugin that provides it.
				</Notice>
			)}
			{state.data?.available && (
				<>
					{!supported && (
						<Notice status="info" isDismissible={false}>
							Connect the Playground MCP server to expose
							abilities to agents. You can still inspect and run
							abilities here.
						</Notice>
					)}
					<p className={css.intro}>
						Switch on an ability to expose it to agents for this
						session. Each switch registers the ability as{' '}
						{webMCPSupported &&
							'a WebMCP tool in this browser and as '}
						a <code>wp_ability_*</code> tool on the{' '}
						<a
							href="https://wordpress.github.io/wordpress-playground/guides/ai-assistants-mcp"
							target="_blank"
							rel="noreferrer"
						>
							Playground MCP server
						</a>
						, when one is connected. To connect the MCP server, add{' '}
						<code>npx -y @wp-playground/mcp</code> to your AI
						client’s MCP configuration and open the Playground URL
						it gives you.
					</p>
					{ability ? (
						<>
							<Button
								variant="tertiary"
								onClick={() => setSelected(undefined)}
							>
								Back to abilities
							</Button>
							<h3 ref={detailHeading} tabIndex={-1}>
								{ability.label || ability.name}
							</h3>
							<code>{ability.name}</code>
							<p>{ability.description}</p>
							<p>Category: {ability.category}</p>
							<ToggleControl
								label={`Expose to agents (${channels})`}
								checked={state.enabled.includes(ability.name)}
								disabled={!supported || state.loading}
								onChange={(value) =>
									abilitiesController.toggle(
										ability.name,
										value
									)
								}
							/>
							{state.registrationErrors[ability.name] && (
								<Notice status="error" isDismissible={false}>
									{state.registrationErrors[ability.name]}
								</Notice>
							)}
							<details>
								<summary>Schemas and metadata</summary>
								<pre>
									{JSON.stringify(
										{
											input_schema: ability.input_schema,
											output_schema:
												ability.output_schema,
											meta: ability.meta,
										},
										null,
										2
									)}
								</pre>
							</details>
							<TextareaControl
								label="JSON input"
								help="Leave empty to call without input. Running an ability may change this site."
								value={input}
								onChange={setInput}
								rows={8}
								disabled={running}
							/>
							<Button
								variant="primary"
								disabled={running || state.loading}
								onClick={() => void run()}
							>
								Run
							</Button>
							{running && (
								<InlineProgress message="Running ability…" />
							)}
							{error && (
								<Notice status="error" isDismissible={false}>
									{error}
								</Notice>
							)}
							{output !== undefined && (
								<div role="status">
									<h4>Result</h4>
									<pre>{output}</pre>
								</div>
							)}
						</>
					) : (
						<>
							<SearchControl
								label="Search abilities"
								value={query}
								onChange={(value) => {
									setQuery(value);
									setSearchCollapsed(new Set());
								}}
							/>
							{state.data.abilities.length === 0 && (
								<p>
									No abilities are registered. Activate a
									plugin that registers abilities, then
									refresh.
								</p>
							)}
							{state.data.abilities.length > 0 &&
								groups.length === 0 && (
									<p>No abilities match your search.</p>
								)}
							<ul className={css.groups}>
								{groups.map((group) => {
									const names = group.abilities.map(
										(item) => item.name
									);
									const exposed = names.filter((name) =>
										state.enabled.includes(name)
									).length;
									const open = isExpanded(group.namespace);
									const listId = `${groupIdPrefix}-${group.namespace}`;
									return (
										<li key={group.namespace}>
											<div className={css.groupHeader}>
												<Button
													variant="tertiary"
													className={css.groupName}
													icon={
														open
															? chevronDown
															: chevronRight
													}
													aria-expanded={open}
													aria-controls={listId}
													onClick={() =>
														toggleExpanded(
															group.namespace
														)
													}
												>
													{group.label}
												</Button>
												<ToggleControl
													className={css.exposure}
													__nextHasNoMarginBottom
													label={
														<>
															<span aria-hidden="true">
																Agents
															</span>
															<VisuallyHidden>{`Expose all ${group.label} abilities to agents through ${channels}`}</VisuallyHidden>
														</>
													}
													help={
														group.shown.length <
														names.length
															? `${exposed} of ${names.length} exposed. The switch affects all ${names.length}.`
															: `${exposed} of ${names.length} exposed`
													}
													checked={
														exposed === names.length
													}
													disabled={
														!supported ||
														state.loading
													}
													onChange={(value) =>
														abilitiesController.setEnabled(
															names,
															value
														)
													}
												/>
											</div>
											<ul
												id={listId}
												className={css.list}
												hidden={!open}
											>
												{group.shown.map((item) => (
													<AbilityRow
														key={item.name}
														ability={item}
														channels={channels}
														enabled={state.enabled.includes(
															item.name
														)}
														disabled={
															!supported ||
															state.loading
														}
														error={
															state
																.registrationErrors[
																item.name
															]
														}
														onSelect={() => {
															setSelected(
																item.name
															);
															setInput('');
														}}
													/>
												))}
											</ul>
										</li>
									);
								})}
							</ul>
						</>
					)}
				</>
			)}
		</div>
	);
}

function AbilityRow({
	ability,
	channels,
	enabled,
	disabled,
	error,
	onSelect,
}: {
	ability: AbilityDescriptor;
	/** How exposed abilities reach agents, e.g. "WebMCP and MCP". */
	channels: string;
	enabled: boolean;
	disabled: boolean;
	error?: string;
	onSelect: () => void;
}) {
	const label = ability.label || ability.name;
	return (
		<li>
			<Button
				variant="link"
				className={css.abilityName}
				onClick={onSelect}
			>
				{label}
			</Button>
			<code>{ability.name}</code>
			<p className={css.description}>{ability.description}</p>
			<ToggleControl
				className={css.exposure}
				__nextHasNoMarginBottom
				label={
					<>
						<span aria-hidden="true">Agents</span>
						<VisuallyHidden>{`Expose ${label} to agents through ${channels}`}</VisuallyHidden>
					</>
				}
				checked={enabled}
				disabled={disabled}
				onChange={(value) =>
					abilitiesController.toggle(ability.name, value)
				}
			/>
			{error && (
				<Notice status="error" isDismissible={false}>
					{error}
				</Notice>
			)}
		</li>
	);
}
