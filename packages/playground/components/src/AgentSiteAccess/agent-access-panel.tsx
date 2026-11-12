import { useState } from 'react';
import {
	Button,
	Notice,
	__experimentalText as Text,
} from '@wordpress/components';
import type { AgentSiteAccessActions, AgentSiteAccessSnapshot } from './types';
import { formatAgentSite } from './format';
import css from './style.module.css';

/**
 * Lists what AI agents can do in this browser and lets the user revoke it.
 * Grants and the site history are shared by every tab; the call log is this
 * tab's.
 */
export function AgentAccessPanel({
	access,
	snapshot,
}: {
	access: AgentSiteAccessActions | undefined;
	snapshot: AgentSiteAccessSnapshot | undefined;
}) {
	const [error, setError] = useState<string>();
	if (!access || !snapshot) {
		return <Text>AI agent access is not available in this browser.</Text>;
	}
	const run = (action: () => Promise<void>) => {
		setError(undefined);
		action().catch((e: unknown) =>
			setError(e instanceof Error ? e.message : String(e))
		);
	};
	const isEmpty =
		snapshot.grants.length === 0 &&
		snapshot.earlierSites.length === 0 &&
		snapshot.calls.length === 0;

	return (
		<div className={css.panel}>
			{(snapshot.error || error) && (
				<Notice status="error" isDismissible={false}>
					{snapshot.error ?? error}
				</Notice>
			)}
			{isEmpty && !snapshot.error && (
				<Text>No AI agent has used a site in this session.</Text>
			)}
			{snapshot.grants.length > 0 && (
				<section className={css.section}>
					<h3>Sites an agent can use</h3>
					<ul className={css.list}>
						{snapshot.grants.map((grant) => (
							<li key={grant.grantId} className={css.item}>
								<div className={css.details}>
									<span>{formatAgentSite(grant.site)}</span>
									<span className={css.meta}>
										{grant.inThisTab
											? 'This tab'
											: 'Another tab'}
										{' · expires '}
										{formatTime(grant.expiresAt)}
										{grant.crossSiteWith.length > 0 &&
											` · shared with ${grant.crossSiteWith
												.map(formatAgentSite)
												.join(', ')}`}
									</span>
								</div>
								<Button
									variant="secondary"
									size="compact"
									onClick={() =>
										run(() => access.revoke(grant.grantId))
									}
								>
									Revoke
								</Button>
							</li>
						))}
					</ul>
				</section>
			)}
			{snapshot.earlierSites.length > 0 && (
				<section className={css.section}>
					<h3>Used in this session</h3>
					<ul className={css.list}>
						{snapshot.earlierSites.map((site) => (
							<li key={site.siteId} className={css.details}>
								<span>{formatAgentSite(site)}</span>
								<span className={css.meta}>
									Last used {formatTime(site.lastUsedAt)}
								</span>
							</li>
						))}
					</ul>
				</section>
			)}
			{snapshot.calls.length > 0 && (
				<section className={css.section}>
					<h3>Recent agent actions in this tab</h3>
					<ul className={css.list}>
						{snapshot.calls.map((call, index) => (
							<li key={index} className={css.details}>
								<span>
									{call.tool} · {call.siteId}
								</span>
								<span className={css.meta}>
									{formatTime(call.at)}
									{call.summary && ` · ${call.summary}`}
								</span>
							</li>
						))}
					</ul>
				</section>
			)}
			{(!isEmpty || snapshot.error) && (
				<div>
					<Button
						variant="secondary"
						isDestructive
						onClick={() => run(() => access.endSession())}
					>
						End agent session
					</Button>
				</div>
			)}
		</div>
	);
}

function formatTime(time: number) {
	return new Date(time).toLocaleTimeString([], {
		hour: '2-digit',
		minute: '2-digit',
	});
}
