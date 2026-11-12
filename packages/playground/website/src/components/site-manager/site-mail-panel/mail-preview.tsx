import {
	__experimentalDivider as Divider,
	__experimentalHeading as Heading,
	__experimentalText as Text,
	__experimentalVStack as VStack,
} from '@wordpress/components';
import type { Email } from 'postal-mime';
import { renderToStaticMarkup } from 'react-dom/server';
import { MailAttachments, useAttachmentResources } from './mail-attachments';
import {
	formatAddress,
	formatAddressList,
	getMailSubject,
	replaceCidReferences,
} from './mail-display';
import css from './style.module.css';

export function MailPreview({ mail }: { mail: Email }) {
	const attachmentResources = useAttachmentResources(mail.attachments);
	const subject = getMailSubject(mail);
	const renderBodyInIframe = Boolean(
		mail.html || mail.attachments.length > 0
	);

	let sentDate = mail.date;
	if (sentDate) {
		const date = new Date(sentDate);
		if (!Number.isNaN(date.getTime())) {
			sentDate = new Intl.DateTimeFormat(undefined, {
				dateStyle: 'medium',
				timeStyle: 'short',
			}).format(date);
		}
	}

	let emailBody: string;
	if (mail.html) {
		emailBody = replaceCidReferences(
			mail.html,
			mail.attachments.map((attachment) => ({
				contentId: attachment.contentId,
				url: attachmentResources.get(attachment)?.url,
			}))
		);
	} else if (mail.text) {
		emailBody = renderToStaticMarkup(<pre>{mail.text}</pre>);
	} else {
		emailBody = renderToStaticMarkup(<p>This message has no body.</p>);
	}

	const attachmentsHtml = renderToStaticMarkup(
		<MailAttachments
			attachments={mail.attachments}
			resources={attachmentResources}
		/>
	);
	/*
	 * Email bodies are untrusted fragments and may not include document metadata.
	 * UTF-8 and standards mode keep parsing consistent across messages. CSP blocks
	 * active content while retaining the assets and inline styles emails commonly
	 * use. The base target opens links outside the preview instead of replacing
	 * its contents.
	 */
	const previewDocument = `<!doctype html>
<meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src http: https: data: blob:; media-src http: https: data: blob:; style-src 'unsafe-inline' http: https: data:; font-src http: https: data: blob:; script-src 'none'; form-action 'none'; base-uri 'none'">
<base target="_blank">
<style>
	html { overflow: auto !important; }
	body { color: #1e1e1e; font: 14px/1.5 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; margin: 0; overflow-wrap: anywhere; }
	img { height: auto; max-width: 100%; }
	pre { white-space: pre-wrap; }
</style>
${emailBody}
${attachmentsHtml}`;

	return (
		<VStack
			className={
				renderBodyInIframe
					? `${css.mailPanelPreview} ${css.mailPanelPreviewWithIframe}`
					: css.mailPanelPreview
			}
			spacing={4}
			justify="flex-start"
		>
			<VStack className={css.mailPanelPreviewHeader} spacing={2}>
				<Heading level={2}>{subject}</Heading>
				<div className={css.mailPanelMetadata}>
					<VStack className={css.mailPanelMetadataColumn} spacing={1}>
						{mail.from && (
							<Text>
								<strong>From:</strong>{' '}
								{formatAddress(mail.from)}
							</Text>
						)}
						{mail.to && mail.to.length > 0 && (
							<Text>
								<strong>To:</strong>{' '}
								{formatAddressList(mail.to)}
							</Text>
						)}
						{mail.cc && mail.cc.length > 0 && (
							<Text>
								<strong>Cc:</strong>{' '}
								{formatAddressList(mail.cc)}
							</Text>
						)}
					</VStack>
					<VStack className={css.mailPanelMetadataColumn} spacing={1}>
						{mail.date && (
							<Text>
								<strong>Sent:</strong> {sentDate}
							</Text>
						)}
						{mail.attachments.length > 0 && (
							<Text>
								<strong>Attachments:</strong>{' '}
								{mail.attachments.length}
							</Text>
						)}
					</VStack>
				</div>
			</VStack>
			<Divider className={css.mailPanelPreviewDivider} />
			{renderBodyInIframe ? (
				/* Popups and downloads escape the sandbox so links and attachment
				 * actions work normally. */
				<iframe
					className={css.mailPanelHtmlPreview}
					title={`Contents of ${subject}`}
					referrerPolicy="no-referrer"
					sandbox="allow-same-origin allow-popups allow-popups-to-escape-sandbox allow-downloads"
					srcDoc={previewDocument}
				/>
			) : mail.text ? (
				<pre className={css.mailPanelTextBody}>{mail.text}</pre>
			) : (
				<Text className={css.mailPanelEmptyBody}>
					This message has no body.
				</Text>
			)}
		</VStack>
	);
}
