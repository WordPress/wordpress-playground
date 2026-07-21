import {
	__experimentalDivider as Divider,
	__experimentalHeading as Heading,
	__experimentalText as Text,
	__experimentalVStack as VStack,
} from '@wordpress/components';
import type { Attachment, Email } from 'postal-mime';
import { useEffect, useRef } from 'react';
import {
	type AttachmentResources,
	MailAttachments,
	useAttachmentResources,
} from './mail-attachments';
import {
	formatAddress,
	formatAddressList,
	getMailSubject,
} from './mail-display';
import css from './style.module.css';

export function MailPreview({ mail }: { mail: Email }) {
	const htmlPreviewRef = useRef<HTMLIFrameElement>(null);
	const attachmentResources = useAttachmentResources(mail.attachments);
	const subject = getMailSubject(mail);

	useEffect(() => {
		const iframe = htmlPreviewRef.current;
		if (!iframe) {
			return;
		}
		const htmlPreview = iframe;

		let contentResizeObserver: ResizeObserver | undefined;
		let animationFrame: number | undefined;

		function observeIframeContents() {
			contentResizeObserver?.disconnect();
			const documentElement =
				htmlPreview.contentDocument?.documentElement;
			if (documentElement) {
				const observer = new ResizeObserver(resizeIframe);
				observer.observe(documentElement);
				contentResizeObserver = observer;
			}
			resizeIframe();
		}

		function resizeIframe() {
			if (animationFrame !== undefined) {
				return;
			}

			animationFrame = window.requestAnimationFrame(() => {
				animationFrame = undefined;
				const documentElement =
					htmlPreview.contentDocument?.documentElement;
				if (!documentElement) {
					return;
				}

				const contentHeight = Math.ceil(
					Math.max(
						documentElement.scrollHeight,
						documentElement.offsetHeight,
						documentElement.getBoundingClientRect().height
					)
				);
				const height = `${Math.max(1, contentHeight)}px`;
				if (htmlPreview.style.height !== height) {
					htmlPreview.style.height = height;
				}
			});
		}

		htmlPreview.addEventListener('load', observeIframeContents);
		observeIframeContents();

		return () => {
			htmlPreview.removeEventListener('load', observeIframeContents);
			contentResizeObserver?.disconnect();
			if (animationFrame !== undefined) {
				window.cancelAnimationFrame(animationFrame);
			}
		};
	}, [mail]);

	return (
		<VStack className={css.mailPreview} spacing={4} justify="flex-start">
			<VStack spacing={2}>
				<Heading level={2}>{subject}</Heading>
				<div className={css.mailMetadata}>
					<VStack spacing={1}>
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
					<VStack spacing={1}>
						{mail.date && (
							<Text>
								<strong>Sent:</strong> {formatDate(mail.date)}
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
			<Divider />
			{mail.html ? (
				/* Same-origin enables content-driven sizing. Popups escape the
				 * sandbox so linked sites work normally. */
				<iframe
					ref={htmlPreviewRef}
					className={
						mail.attachments.length > 0
							? `${css.htmlPreview} ${css.htmlPreviewWithAttachments}`
							: css.htmlPreview
					}
					title={`Contents of ${subject}`}
					sandbox="allow-same-origin allow-popups allow-popups-to-escape-sandbox"
					srcDoc={createEmailPreviewDocument(
						embedRelatedAttachments(
							mail.html,
							mail.attachments,
							attachmentResources
						)
					)}
				/>
			) : mail.text ? (
				<pre className={css.textBody}>{mail.text}</pre>
			) : (
				<Text>This message has no body.</Text>
			)}
			{mail.attachments.length > 0 && (
				<>
					<Divider />
					<MailAttachments
						attachments={mail.attachments}
						resources={attachmentResources}
					/>
				</>
			)}
		</VStack>
	);
}

function formatDate(value: string): string {
	const date = new Date(value);
	if (Number.isNaN(date.getTime())) {
		return value;
	}
	return new Intl.DateTimeFormat(undefined, {
		dateStyle: 'medium',
		timeStyle: 'short',
	}).format(date);
}

function embedRelatedAttachments(
	html: string,
	attachments: Attachment[],
	resources: AttachmentResources
): string {
	const relatedAttachments = attachments
		.map((attachment) => ({
			attachment,
			contentId: attachment.contentId?.trim().replace(/^<|>$/g, ''),
		}))
		.filter(({ contentId }) => contentId)
		.sort((a, b) => b.contentId!.length - a.contentId!.length);

	for (const { attachment, contentId } of relatedAttachments) {
		const resource = resources.get(attachment);
		if (resource) {
			html = html.split(`cid:${contentId}`).join(resource.url);
		}
	}
	return html;
}

function createEmailPreviewDocument(html: string): string {
	/*
	 * Email bodies are untrusted fragments and may not include document metadata.
	 * UTF-8 and standards mode keep parsing consistent across messages. CSP blocks
	 * active content while retaining the assets and inline styles emails commonly
	 * use. The base target opens links outside the preview instead of replacing
	 * its contents.
	 */
	return `<!doctype html>
<meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src http: https: data: blob:; media-src http: https: data: blob:; style-src 'unsafe-inline' http: https: data:; font-src http: https: data: blob:; script-src 'none'; form-action 'none'; base-uri 'none'">
<base target="_blank">
<style>
	html { overflow: hidden !important; }
	body { color: #1e1e1e; font: 14px/1.5 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; margin: 0; overflow-wrap: anywhere; }
	img { height: auto; max-width: 100%; }
	pre { white-space: pre-wrap; }
</style>
${html}`;
}
