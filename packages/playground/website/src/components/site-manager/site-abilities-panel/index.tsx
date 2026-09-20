import { stringifyError } from '@wp-playground/mcp/client';
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import {
	Button,
	Notice,
	SearchControl,
	TextareaControl,
	ToggleControl,
} from '@wordpress/components';
import { abilitiesController } from '../../../lib/abilities';
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
	const supported = abilitiesController.isSupported();
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
							This browser does not support WebMCP. You can still
							inspect and run abilities here.
						</Notice>
					)}
					<p>
						Expose selected abilities to browser agents for this
						session. These switches control Playground’s native
						registrations.
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
								label="Expose through WebMCP"
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
								onChange={setQuery}
							/>
							{state.data.abilities.length === 0 && (
								<p>
									No abilities are registered. Activate a
									plugin that registers abilities, then
									refresh.
								</p>
							)}
							{state.data.abilities.length > 0 &&
								!state.data.abilities.some((item) =>
									`${item.name} ${item.label} ${item.description}`
										.toLowerCase()
										.includes(query.toLowerCase())
								) && <p>No abilities match your search.</p>}
							<ul className={css.list}>
								{state.data.abilities
									.filter((item) =>
										`${item.name} ${item.label} ${item.description}`
											.toLowerCase()
											.includes(query.toLowerCase())
									)
									.map((item) => (
										<li key={item.name}>
											<Button
												variant="link"
												onClick={() => {
													setSelected(item.name);
													setInput('');
												}}
											>
												{item.label || item.name}
											</Button>
											<code>{item.name}</code>
											<p>{item.description}</p>
											<ToggleControl
												label={`Expose ${item.label || item.name} through WebMCP`}
												checked={state.enabled.includes(
													item.name
												)}
												disabled={
													!supported || state.loading
												}
												onChange={(value) =>
													abilitiesController.toggle(
														item.name,
														value
													)
												}
											/>
											{state.registrationErrors[
												item.name
											] && (
												<Notice
													status="error"
													isDismissible={false}
												>
													{
														state
															.registrationErrors[
															item.name
														]
													}
												</Notice>
											)}
										</li>
									))}
							</ul>
						</>
					)}
				</>
			)}
		</div>
	);
}
