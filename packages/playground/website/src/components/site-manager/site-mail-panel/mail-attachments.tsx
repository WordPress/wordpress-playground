import {
	Button,
	Card,
	CardBody,
	CardMedia,
	Icon,
	__experimentalGrid as Grid,
	__experimentalHeading as Heading,
	__experimentalText as Text,
	__experimentalVStack as VStack,
} from '@wordpress/components';
import { download, page } from '@wordpress/icons';
import type { Attachment } from 'postal-mime';
import { useEffect, useState } from 'react';
import css from './style.module.css';

export type AttachmentResource = {
	url: string;
	size: number;
};

export type AttachmentResources = ReadonlyMap<Attachment, AttachmentResource>;

export function useAttachmentResources(
	attachments: Attachment[]
): AttachmentResources {
	const [resources, setResources] = useState<AttachmentResources>(
		() => new Map()
	);

	useEffect(() => {
		const nextResources = new Map<Attachment, AttachmentResource>();
		for (const attachment of attachments) {
			nextResources.set(attachment, createAttachmentResource(attachment));
		}
		setResources(nextResources);

		return () => {
			for (const resource of nextResources.values()) {
				URL.revokeObjectURL(resource.url);
			}
		};
	}, [attachments]);

	return resources;
}

export function MailAttachments({
	attachments,
	resources,
}: {
	attachments: Attachment[];
	resources: AttachmentResources;
}) {
	return (
		<VStack className={css.attachments} spacing={2}>
			<Heading level={3}>
				{attachments.length === 1
					? '1 attachment'
					: `${attachments.length} attachments`}
			</Heading>
			<Grid
				as="ul"
				alignment="stretch"
				gap={3}
				templateColumns="repeat(auto-fit, minmax(min(100%, 180px), 1fr))"
				className={css.attachmentList}
				aria-label="Attachments"
			>
				{attachments.map((attachment, index) => {
					const filename =
						attachment.filename || 'Unnamed attachment';
					const resource = resources.get(attachment);

					return (
						<li
							key={`${filename}-${index}`}
							className={css.attachmentItem}
						>
							<Card
								className={css.attachmentCard}
								elevation={0}
								size="small"
							>
								<CardMedia className={css.attachmentMedia}>
									<div className={css.attachmentPreview}>
										<AttachmentPreview
											attachment={attachment}
											url={resource?.url}
											filename={filename}
										/>
									</div>
									<VStack
										className={css.attachmentActions}
										spacing={2}
										justify="center"
									>
										{resource && (
											<>
												<Text
													size={12}
													lineHeight="16px"
													variant="muted"
												>
													Size:{' '}
													{formatFileSize(
														resource.size
													)}
												</Text>
												<Button
													className={
														css.attachmentDownload
													}
													variant="link"
													href={resource.url}
													download={filename}
													label={`Download ${filename}`}
												>
													<Icon
														icon={download}
														size={16}
													/>
													<span>Download</span>
												</Button>
											</>
										)}
									</VStack>
								</CardMedia>
								<CardBody
									className={css.attachmentDetails}
									size="xSmall"
								>
									<Text
										className={css.attachmentFilename}
										weight={600}
										truncate
										numberOfLines={1}
										title={filename}
									>
										{filename}
									</Text>
								</CardBody>
							</Card>
						</li>
					);
				})}
			</Grid>
		</VStack>
	);
}

function createAttachmentResource(attachment: Attachment): AttachmentResource {
	const blob = new Blob([getAttachmentBlobPart(attachment)], {
		type: attachment.mimeType,
	});
	return {
		url: URL.createObjectURL(blob),
		size: blob.size,
	};
}

function getAttachmentBlobPart(attachment: Attachment): BlobPart {
	if (attachment.content instanceof ArrayBuffer) {
		return attachment.content;
	}
	if (attachment.content instanceof Uint8Array) {
		return Uint8Array.from(attachment.content).buffer;
	}
	if (attachment.encoding === 'base64') {
		return decodeBase64(attachment.content);
	}
	return attachment.content;
}

function decodeBase64(content: string): ArrayBuffer {
	const decoded = atob(content);
	const bytes = new Uint8Array(decoded.length);
	for (let index = 0; index < decoded.length; index++) {
		bytes[index] = decoded.charCodeAt(index);
	}
	return bytes.buffer;
}

function AttachmentPreview({
	attachment,
	url,
	filename,
}: {
	attachment: Attachment;
	url: string | undefined;
	filename: string;
}) {
	if (url && attachment.mimeType.startsWith('image/')) {
		return (
			<img
				className={css.attachmentImage}
				src={url}
				alt={filename}
				loading="lazy"
			/>
		);
	}

	if (url && attachment.mimeType.startsWith('video/')) {
		return (
			<video className={css.attachmentVideo} controls preload="metadata">
				<source src={url} type={attachment.mimeType} />
			</video>
		);
	}

	if (url && attachment.mimeType.startsWith('audio/')) {
		return (
			<audio className={css.attachmentAudio} controls preload="metadata">
				<source src={url} type={attachment.mimeType} />
			</audio>
		);
	}

	return (
		<div className={css.attachmentPlaceholder} aria-hidden="true">
			<Icon icon={page} size={32} />
		</div>
	);
}

function formatFileSize(bytes: number): string {
	if (bytes < 1024) {
		return `${bytes} B`;
	}
	if (bytes < 1024 * 1024) {
		return `${(bytes / 1024).toFixed(1)} KB`;
	}
	return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
