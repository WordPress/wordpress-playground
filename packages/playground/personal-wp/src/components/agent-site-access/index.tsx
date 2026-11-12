import { Button } from '@wordpress/components';
import { shield } from '@wordpress/icons';
import {
	SiteAccessDialogContent,
	SiteInteractionNotice,
} from '@wp-playground/components';
import {
	agentSiteAccessPrompt,
	useAgentSiteAccess,
	usePendingSiteAccessRequest,
} from '../../lib/agent-site-access';
import { Modal } from '../modal';

/** Asks the user whether an AI agent may use this WordPress. */
export function SiteAccessDialog() {
	const request = usePendingSiteAccessRequest();
	if (!request) {
		return null;
	}
	return (
		<Modal
			title="Allow an AI agent to use your WordPress?"
			onRequestClose={() => agentSiteAccessPrompt.answer('deny')}
		>
			<SiteAccessDialogContent
				request={request}
				onAnswer={agentSiteAccessPrompt.answer}
			/>
		</Modal>
	);
}

/** States which site is asking for input while a site tool does so. */
export function SiteInteractionBanner() {
	const { snapshot } = useAgentSiteAccess();
	return snapshot?.interactingSite ? (
		<SiteInteractionNotice site={snapshot.interactingSite} />
	) : null;
}

/** Shown while an AI agent can use this WordPress; opens its access details. */
export function AgentAccessIndicator({ onOpen }: { onOpen: () => void }) {
	const { snapshot } = useAgentSiteAccess();
	if (!snapshot || (snapshot.grants.length === 0 && !snapshot.error)) {
		return null;
	}
	return (
		<Button
			variant="secondary"
			size="compact"
			icon={shield}
			onClick={onOpen}
			label="An AI agent can use this WordPress. Review or revoke its access."
			showTooltip
		>
			Agent access
		</Button>
	);
}
