import {
	Button,
	Flex,
	Notice,
	__experimentalText as Text,
} from '@wordpress/components';
import type { AgentSiteAccessDecision, AgentSiteAccessRequest } from './types';
import { formatAgentSite, formatAgentSites } from './format';
import css from './style.module.css';

/**
 * The body of the dialog asking whether an AI agent may use a site. Everything
 * shown is Playground's text except the agent's reason, which is labeled.
 * Apps wrap it in their own modal and treat closing the modal as a denial.
 */
export function SiteAccessDialogContent({
	request,
	onAnswer,
}: {
	request: AgentSiteAccessRequest;
	onAnswer: (decision: AgentSiteAccessDecision) => void;
}) {
	const hasOtherAccess = request.sitesWithAccess.length > 0;
	return (
		<div className={css.dialog}>
			<Text>
				An AI agent using this browser tab wants to use{' '}
				<b>{formatAgentSite(request.site)}</b>. If you allow it, the
				agent can read and change the site&rsquo;s files and database,
				run PHP, and use the tools the site provides.
			</Text>
			{request.earlierSites.length > 0 && (
				<Notice status="warning" isDismissible={false}>
					Earlier in this session the agent used{' '}
					{formatAgentSites(request.earlierSites)}. Information it got
					there could be sent to this site, and this site&rsquo;s
					content could try to steer what the agent does with it.
				</Notice>
			)}
			{hasOtherAccess && (
				<Text>
					The agent can currently use{' '}
					{formatAgentSites(request.sitesWithAccess)}. It can keep
					access to more than one site only if it explains why.
				</Text>
			)}
			{request.reason && (
				<Text>
					The agent says: &ldquo;{request.reason}&rdquo;
					<br />
					<small>
						This explanation comes from the agent, not from
						Playground.
					</small>
				</Text>
			)}
			<Flex gap={4} justify="end" className={css.dialogButtons}>
				<Button variant="link" onClick={() => onAnswer('deny')}>
					Deny
				</Button>
				{hasOtherAccess && request.reason && (
					<Button
						variant="secondary"
						onClick={() => onAnswer('allow-cross-site')}
					>
						Allow access to all of them
					</Button>
				)}
				<Button
					variant="primary"
					onClick={() =>
						onAnswer(
							hasOtherAccess ? 'allow-revoke-others' : 'allow'
						)
					}
				>
					{hasOtherAccess
						? 'Allow and revoke access to the other sites'
						: 'Allow'}
				</Button>
			</Flex>
		</div>
	);
}
