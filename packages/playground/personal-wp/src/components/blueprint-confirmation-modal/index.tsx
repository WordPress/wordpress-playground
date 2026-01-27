import { useState } from 'react';
import { Button } from '@wordpress/components';
import { Modal } from '../modal';
import css from './style.module.css';
import { useAppDispatch, useAppSelector } from '../../lib/state/redux/store';
import {
	rejectPendingBlueprint,
	confirmPendingBlueprint,
} from '../../lib/state/redux/slice-ui';
import type {
	BlueprintWarning,
	WarningSeverity,
} from '../../lib/blueprint-confirmation';
import type {
	StepDefinition,
	BlueprintV1Declaration,
} from '@wp-playground/blueprints';

const severityLabels: Record<WarningSeverity, string> = {
	danger: 'High risk',
	warning: 'Caution',
	info: 'Info',
};

const severityDescriptions: Record<WarningSeverity, string> = {
	danger: 'These operations could compromise your site',
	warning: 'These operations will modify your site',
	info: 'These operations are generally safe',
};

function WarningGroup({
	severity,
	warnings,
}: {
	severity: WarningSeverity;
	warnings: BlueprintWarning[];
}) {
	if (warnings.length === 0) {
		return null;
	}

	return (
		<div className={`${css.warningGroup} ${css[`severity-${severity}`]}`}>
			<div className={css.warningGroupHeader}>
				<span
					className={`${css.severityBadge} ${css[`badge-${severity}`]}`}
				>
					{severityLabels[severity]}
				</span>
				<span className={css.severityDescription}>
					{severityDescriptions[severity]}
				</span>
			</div>
			<ul className={css.warningList}>
				{warnings.map((warning, index) => (
					<li key={index} className={css.warningItem}>
						<span className={css.warningTitle}>
							{warning.title}
						</span>
						<span className={css.warningDescription}>
							{warning.description}
						</span>
					</li>
				))}
			</ul>
		</div>
	);
}

function truncate(str: string, max: number): string {
	if (str.length <= max) return str;
	return str.slice(0, max) + '...';
}

function getResourceInfo(resource: unknown): string {
	if (!resource || typeof resource !== 'object') {
		return '';
	}
	const r = resource as Record<string, unknown>;

	if (r.resource === 'wordpress.org/plugins' && r.slug) {
		return `wordpress.org: ${r.slug}`;
	}
	if (r.resource === 'wordpress.org/themes' && r.slug) {
		return `wordpress.org: ${r.slug}`;
	}
	if (r.resource === 'url' && r.url) {
		return truncate(String(r.url), 60);
	}
	if (r.url) {
		return truncate(String(r.url), 60);
	}
	if (r.slug) {
		return String(r.slug);
	}
	if (r.resource === 'literal') {
		return 'inline content';
	}
	return '';
}

function getStepSummary(step: StepDefinition): string {
	if (typeof step === 'string') {
		return step;
	}
	if (!step || typeof step !== 'object') {
		return 'Unknown step';
	}

	const s = step as Record<string, unknown>;
	const stepType = s.step as string;

	switch (stepType) {
		case 'installPlugin': {
			const info =
				getResourceInfo(s.pluginData) ||
				getResourceInfo(s.pluginZipFile);
			return info || 'Install plugin';
		}
		case 'installTheme': {
			const info =
				getResourceInfo(s.themeData) || getResourceInfo(s.themeZipFile);
			return info || 'Install theme';
		}
		case 'activatePlugin':
			return s.pluginPath ? String(s.pluginPath) : 'Activate plugin';
		case 'activateTheme':
			return s.themeFolderName
				? String(s.themeFolderName)
				: 'Activate theme';
		case 'login':
			return s.username ? `as ${s.username}` : 'as admin';
		case 'runPHP':
		case 'runPHPWithOptions': {
			const code = (s.code as string) || '';
			const clean = code
				.replace(/^<\?php\s*/i, '')
				.replace(/\s+/g, ' ')
				.trim();
			return truncate(clean, 80) || 'Execute PHP code';
		}
		case 'wp-cli': {
			const cmd = s.command;
			if (Array.isArray(cmd)) return `wp ${cmd.join(' ')}`;
			if (typeof cmd === 'string') return `wp ${truncate(cmd, 60)}`;
			return 'Execute command';
		}
		case 'writeFile':
			return s.path ? String(s.path) : 'Write file';
		case 'mkdir':
			return s.path ? String(s.path) : 'Create directory';
		case 'rm':
			return s.path ? String(s.path) : 'Delete file';
		case 'rmdir':
			return s.path ? String(s.path) : 'Delete directory';
		case 'cp':
			return `${s.fromPath || '?'} → ${s.toPath || '?'}`;
		case 'mv':
			return `${s.fromPath || '?'} → ${s.toPath || '?'}`;
		case 'request': {
			const method = s.method || 'GET';
			const url = s.url ? truncate(String(s.url), 50) : 'unknown URL';
			return `${method} ${url}`;
		}
		case 'setSiteOptions': {
			const options = s.options as Record<string, unknown> | undefined;
			if (options && typeof options === 'object') {
				const keys = Object.keys(options);
				return keys.length > 0 ? keys.join(', ') : 'Update options';
			}
			return 'Update options';
		}
		case 'defineWpConfigConsts': {
			const consts = s.consts as Record<string, unknown> | undefined;
			if (consts && typeof consts === 'object') {
				const keys = Object.keys(consts);
				return keys.length > 0 ? keys.join(', ') : 'Set constants';
			}
			return 'Set constants';
		}
		case 'importWxr': {
			const info = getResourceInfo(s.file);
			return info || 'Import XML content';
		}
		case 'importWordPressFiles': {
			const info = getResourceInfo(s.wordPressFilesZip);
			return info || 'Import files';
		}
		case 'enableMultisite':
			return 'Enable WordPress multisite';
		case 'runSql': {
			const sql = s.sql as string | undefined;
			if (sql) return truncate(sql.replace(/\s+/g, ' '), 60);
			return 'Execute query';
		}
		case 'unzip': {
			const to = s.extractToPath ? ` to ${s.extractToPath}` : '';
			return `Extract archive${to}`;
		}
		case 'setPhpIniEntry':
			return s.key ? `${s.key} = ${s.value}` : 'Set PHP ini';
		case 'resetData':
			return 'Reset WordPress data';
		case 'setSiteLanguage':
			return s.language ? String(s.language) : 'Set language';
		default:
			return stepType || 'Unknown step';
	}
}

interface BlueprintMeta {
	title?: string;
	description?: string;
	author?: string;
}

interface BlueprintOverviewProps {
	steps: StepDefinition[];
	landingPage?: string;
	plugins?: string[];
	themes?: string[];
	warnings?: BlueprintWarning[];
}

function getStepSeverity(
	stepIndex: number,
	warnings: BlueprintWarning[]
): WarningSeverity | null {
	const stepWarnings = warnings.filter((w) => w.stepIndex === stepIndex);
	if (stepWarnings.some((w) => w.severity === 'danger')) return 'danger';
	if (stepWarnings.some((w) => w.severity === 'warning')) return 'warning';
	if (stepWarnings.some((w) => w.severity === 'info')) return 'info';
	return null;
}

function SeverityIcon({ severity }: { severity: WarningSeverity }) {
	if (severity === 'danger') {
		return (
			<span className={css['severity-icon']} title="High risk">
				⚠
			</span>
		);
	}
	if (severity === 'warning') {
		return (
			<span className={css['severity-icon']} title="Caution">
				⚠
			</span>
		);
	}
	return (
		<span className={css['severity-icon']} title="Info">
			ℹ
		</span>
	);
}

function BlueprintOverview({
	steps,
	landingPage,
	plugins,
	themes,
	warnings = [],
}: BlueprintOverviewProps) {
	const hasSteps = steps && steps.length > 0;
	const hasPlugins = plugins && plugins.length > 0;
	const hasThemes = themes && themes.length > 0;
	const hasContent = hasSteps || landingPage || hasPlugins || hasThemes;

	if (!hasContent) {
		return <p className={css.noSteps}>No actions in this blueprint.</p>;
	}

	return (
		<div className={css.blueprintOverview}>
			{hasPlugins && (
				<div className={css.blueprintProperty}>
					<span className={css.stepType}>plugins</span>
					<span className={css.stepSummary}>
						{plugins.join(', ')}
					</span>
				</div>
			)}
			{hasThemes && (
				<div className={css.blueprintProperty}>
					<span className={css.stepType}>themes</span>
					<span className={css.stepSummary}>{themes.join(', ')}</span>
				</div>
			)}
			{landingPage && (
				<div className={css.blueprintProperty}>
					<span className={css.stepType}>landingPage</span>
					<span className={css.stepSummary}>{landingPage}</span>
				</div>
			)}
			{hasSteps && (
				<>
					<h4
						className={`${css.stepsHeading} ${!hasPlugins && !hasThemes && !landingPage ? css.stepsHeadingFirst : ''}`}
					>
						Steps
					</h4>
					<ol className={css.stepsTree}>
						{steps.map((step, index) => {
							if (!step) return null;
							const stepObj =
								typeof step === 'object'
									? (step as Record<string, unknown>)
									: null;
							const stepType = stepObj?.step as
								| string
								| undefined;
							const severity = getStepSeverity(index, warnings);

							return (
								<li
									key={index}
									className={`${css.stepItem} ${severity ? css[`step-severity-${severity}`] : ''}`}
								>
									{severity && (
										<SeverityIcon severity={severity} />
									)}
									<span className={css.stepType}>
										{stepType || 'step'}
									</span>
									<span className={css.stepSummary}>
										{getStepSummary(step)}
									</span>
								</li>
							);
						})}
					</ol>
				</>
			)}
		</div>
	);
}

function BlueprintContents({
	blueprint,
	warnings = [],
}: {
	blueprint: BlueprintV1Declaration;
	warnings?: BlueprintWarning[];
}) {
	const [showRaw, setShowRaw] = useState(false);
	const blueprintJson = JSON.stringify(blueprint, null, 2);
	const meta = blueprint.meta as BlueprintMeta | undefined;

	return (
		<div className={css.blueprintContents}>
			{meta && (meta.title || meta.description || meta.author) && (
				<div className={css.blueprintMeta}>
					<div className={css.metaHeader}>
						{meta.title && (
							<h3 className={css.metaTitle}>{meta.title}</h3>
						)}
						{meta.author && (
							<span className={css.metaAuthor}>
								by {meta.author}
							</span>
						)}
					</div>
					{meta.description && (
						<p className={css.metaDescription}>
							{meta.description}
						</p>
					)}
				</div>
			)}
			<div
				className={`${css.blueprintPanel} ${showRaw ? css.blueprintPanelJson : ''}`}
			>
				{showRaw ? (
					<pre className={css.blueprintCode}>{blueprintJson}</pre>
				) : (
					<BlueprintOverview
						steps={(blueprint.steps as StepDefinition[]) || []}
						landingPage={
							blueprint.landingPage as string | undefined
						}
						plugins={blueprint.plugins as string[] | undefined}
						themes={undefined}
						warnings={warnings}
					/>
				)}
			</div>
			<div className={css.blueprintFooter}>
				<div className={css.viewTabs}>
					<button
						type="button"
						className={`${css.viewTab} ${!showRaw ? css.viewTabActive : ''}`}
						onClick={() => setShowRaw(false)}
					>
						Overview
					</button>
					<button
						type="button"
						className={`${css.viewTab} ${showRaw ? css.viewTabActive : ''}`}
						onClick={() => setShowRaw(true)}
					>
						JSON
					</button>
				</div>
				<a
					href="https://wordpress.github.io/wordpress-playground/blueprints/"
					target="_blank"
					rel="noopener noreferrer"
					className={css.docsLink}
				>
					What is a blueprint?
				</a>
			</div>
		</div>
	);
}

export function BlueprintConfirmationModal() {
	const dispatch = useAppDispatch();
	const pendingConfirmation = useAppSelector(
		(state) => state.ui.pendingBlueprintConfirmation
	);

	if (!pendingConfirmation) {
		return null;
	}

	const { analysisResult, blueprint } = pendingConfirmation;
	const { warnings } = analysisResult;

	// Group warnings by severity
	const dangerWarnings = warnings.filter((w) => w.severity === 'danger');
	const warningWarnings = warnings.filter((w) => w.severity === 'warning');
	const infoWarnings = warnings.filter((w) => w.severity === 'info');

	const handleCancel = () => {
		dispatch(rejectPendingBlueprint());
	};

	const handleConfirm = () => {
		dispatch(confirmPendingBlueprint());
	};

	// Get source URL for display (only for remote URLs, not data: URLs)
	let sourceUrl = '';
	let isInlineBlueprint = false;
	if (
		blueprint.source.type === 'remote-url' ||
		blueprint.source.type === 'personal-blueprint'
	) {
		const url = blueprint.source.url;
		if (url.startsWith('data:')) {
			isInlineBlueprint = true;
		} else {
			sourceUrl = url;
		}
	} else if (blueprint.source.type === 'inline-string') {
		isInlineBlueprint = true;
	}

	const hasDanger = dangerWarnings.length > 0;

	return (
		<Modal
			title="Apply Blueprint?"
			onRequestClose={handleCancel}
			className={css.confirmationModal}
		>
			<div className={css.modalContent}>
				<div className={css.modalBody}>
					<p className={css.leadText}>
						An external blueprint wants to modify your WordPress
						installation. Please review the following actions before
						proceeding.
					</p>

					{sourceUrl && (
						<div className={css.sourceInfo}>
							<span className={css.sourceLabel}>Source:</span>
							<span className={css.sourceUrl}>{sourceUrl}</span>
						</div>
					)}

					{isInlineBlueprint && (
						<BlueprintContents
							blueprint={
								blueprint.blueprint as BlueprintV1Declaration
							}
							warnings={warnings}
						/>
					)}

					<div className={css.warningsContainer}>
						<WarningGroup
							severity="danger"
							warnings={dangerWarnings}
						/>
						<WarningGroup
							severity="warning"
							warnings={warningWarnings}
						/>
						<WarningGroup severity="info" warnings={infoWarnings} />
					</div>
				</div>

				<div className={css.modalFooter}>
					<Button variant="secondary" onClick={handleCancel}>
						Cancel
					</Button>
					<Button
						variant="primary"
						onClick={handleConfirm}
						className={hasDanger ? css.dangerButton : ''}
					>
						{hasDanger ? 'Apply Anyway' : 'Apply Blueprint'}
					</Button>
				</div>
			</div>
		</Modal>
	);
}
