import { Icon, Tooltip } from '@wordpress/components';
import { shield } from '@wordpress/icons';
import classNames from 'classnames';
import { useAgentSiteAccess } from '../../lib/agent-site-access';
import { useAppDispatch } from '../../lib/state/redux/store';
import {
	setDockPaneOpen,
	setDockPaneSection,
} from '../../lib/state/redux/slice-ui';
import indicatorCss from '../browser-chrome/save-status-indicator.module.css';

/** Shown in the Dock while an AI agent can use any site in this browser. */
export function AgentAccessIndicator({ disabled }: { disabled?: boolean }) {
	const { snapshot } = useAgentSiteAccess();
	const dispatch = useAppDispatch();
	if (!snapshot || (snapshot.grants.length === 0 && !snapshot.error)) {
		return null;
	}
	return (
		<Tooltip text="An AI agent can use sites in this browser. Review or revoke its access.">
			<button
				type="button"
				className={classNames(
					indicatorCss.indicator,
					indicatorCss.unsaved,
					indicatorCss.actionable
				)}
				disabled={disabled}
				onClick={() => {
					dispatch(setDockPaneSection('agent-access'));
					dispatch(setDockPaneOpen(true));
				}}
			>
				<Icon icon={shield} size={18} />
				<span>Agent access</span>
			</button>
		</Tooltip>
	);
}
