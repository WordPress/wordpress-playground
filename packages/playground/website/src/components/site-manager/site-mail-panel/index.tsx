import {
	Notice,
	__experimentalHStack as HStack,
	__experimentalHeading as Heading,
	__experimentalItem as Item,
	__experimentalItemGroup as ItemGroup,
	__experimentalText as Text,
	__experimentalVStack as VStack,
} from '@wordpress/components';
import type { Email } from 'postal-mime';
import { useState } from 'react';
import {
	getActiveClientInfo,
	useAppSelector,
} from '../../../lib/state/redux/store';
import { formatAddress, getMailSubject } from './mail-display';
import { MailPreview } from './mail-preview';
import css from './style.module.css';

export function SiteMailPanel() {
	const emails = useAppSelector(getActiveClientInfo)?.emails ?? [];
	const [selectedEmail, setSelectedEmail] = useState<Email>();
	const selectedMail =
		selectedEmail && emails.includes(selectedEmail)
			? selectedEmail
			: emails[0];

	if (!selectedMail) {
		return (
			<section className={css.mailEmptyState} aria-label="Email">
				<Notice
					className={css.mailEmptyStateNotice}
					status="info"
					isDismissible={false}
				>
					<VStack spacing={2}>
						<Heading level={2}>No emails yet</Heading>
						<Text>
							Emails sent by this Playground will appear here.
						</Text>
					</VStack>
				</Notice>
			</section>
		);
	}

	return (
		<section className={css.mailPanel} aria-label="Email">
			<aside className={css.mailPanelList} aria-label="Sent emails">
				<HStack className={css.mailPanelListHeader}>
					<Text as="h2" weight={600}>
						Sent
					</Text>
					<Text variant="muted">{emails.length}</Text>
				</HStack>
				<ItemGroup isSeparated isRounded={false} size="large">
					{emails.map((message, index) => {
						const isSelected = message === selectedMail;
						const subject = getMailSubject(message);

						return (
							<Item
								key={message.messageId || `${subject}-${index}`}
								onClick={() => setSelectedEmail(message)}
								aria-pressed={isSelected}
								className={css.mailPanelListItem}
							>
								<VStack spacing={1}>
									<Text weight={600} truncate>
										{subject}
									</Text>
									<HStack spacing={2}>
										<Text variant="muted" truncate>
											{message.from
												? formatAddress(message.from)
												: 'Unknown sender'}
										</Text>
										{message.date && (
											<Text
												as="time"
												dateTime={message.date}
												variant="muted"
											>
												{formatSentTime(message.date)}
											</Text>
										)}
									</HStack>
								</VStack>
							</Item>
						);
					})}
				</ItemGroup>
			</aside>
			<MailPreview mail={selectedMail} />
		</section>
	);
}

function formatSentTime(date: string): string {
	const parsedDate = new Date(date);
	if (Number.isNaN(parsedDate.getTime())) {
		return date;
	}
	return new Intl.DateTimeFormat(undefined, {
		hour: 'numeric',
		minute: '2-digit',
	}).format(parsedDate);
}
