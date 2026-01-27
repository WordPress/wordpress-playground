import { Button } from '@wordpress/components';
import { Modal } from '../modal';
import css from './style.module.css';
import { useAppDispatch, useAppSelector } from '../../lib/state/redux/store';
import {
	clearPendingBlueprintConfirmation,
	confirmPendingBlueprint,
} from '../../lib/state/redux/slice-ui';
import type {
	BlueprintWarning,
	WarningSeverity,
} from '../../lib/blueprint-confirmation';

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
		dispatch(clearPendingBlueprintConfirmation());
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

	// Format blueprint JSON for display
	const blueprintJson = JSON.stringify(blueprint.blueprint, null, 2);

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
						<details className={css.blueprintDetails}>
							<summary className={css.blueprintSummary}>
								View blueprint contents
							</summary>
							<pre className={css.blueprintCode}>
								{blueprintJson}
							</pre>
						</details>
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

						{warnings.length === 0 && (
							<p className={css.noWarnings}>
								This blueprint does not contain any recognized
								operations.
							</p>
						)}
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
