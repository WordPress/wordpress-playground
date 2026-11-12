import { SiteAccessDialogContent } from '@wp-playground/components';
import {
	agentSiteAccessPrompt,
	usePendingSiteAccessRequest,
} from '../../lib/agent-site-access';
import { Modal } from '../modal';

/** Asks the user whether an AI agent may use a Playground. */
export function SiteAccessDialog() {
	const request = usePendingSiteAccessRequest();
	if (!request) {
		return null;
	}
	return (
		<Modal
			title="Allow an AI agent to use this Playground?"
			onRequestClose={() => agentSiteAccessPrompt.answer('deny')}
		>
			<SiteAccessDialogContent
				request={request}
				onAnswer={agentSiteAccessPrompt.answer}
			/>
		</Modal>
	);
}
