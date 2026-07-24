import type { Attachment } from 'postal-mime';
import { useEffect, useState } from 'react';
import attachmentStylesheetUrl from './mail-attachments.css?url';

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
	if (attachments.length === 0) {
		return null;
	}

	const heading =
		attachments.length === 1
			? '1 attachment'
			: `${attachments.length} attachments`;

	return (
		<div id="mail-attachments-host">
			<template {...{ shadowrootmode: 'open' }}>
				<link rel="stylesheet" href={attachmentStylesheetUrl} />
				<section
					className="attachments"
					aria-labelledby="mail-attachments-heading"
				>
					<hr />
					<h2 id="mail-attachments-heading">{heading}</h2>
					<ul aria-label="Attachments">
						{attachments.map((attachment, index) => (
							<MailAttachment
								key={`${attachment.filename}-${index}`}
								attachment={attachment}
								resource={resources.get(attachment)}
							/>
						))}
					</ul>
				</section>
			</template>
		</div>
	);
}

function MailAttachment({
	attachment,
	resource,
}: {
	attachment: Attachment;
	resource: AttachmentResource | undefined;
}) {
	const filename = attachment.filename || 'Unnamed attachment';

	return (
		<li>
			<article className="card">
				<div className="media">
					<div className="preview">
						<AttachmentPreview
							attachment={attachment}
							url={resource?.url}
							filename={filename}
						/>
					</div>
					{resource && (
						<div className="actions">
							<span>Size: {formatFileSize(resource.size)}</span>
							<a
								href={resource.url}
								download={filename}
								aria-label={`Download ${filename}`}
							>
								<span aria-hidden="true">&#8595;</span> Download
							</a>
						</div>
					)}
				</div>
				<div className="details" title={filename}>
					{filename}
				</div>
			</article>
		</li>
	);
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
		return <img src={url} alt={filename} loading="lazy" />;
	}

	if (url && attachment.mimeType.startsWith('video/')) {
		return (
			<video controls preload="metadata">
				<source src={url} type={attachment.mimeType} />
			</video>
		);
	}

	if (url && attachment.mimeType.startsWith('audio/')) {
		return (
			<audio controls preload="metadata">
				<source src={url} type={attachment.mimeType} />
			</audio>
		);
	}

	return (
		<svg className="placeholder" viewBox="0 0 24 24" aria-hidden="true">
			<path d="M6 2h8l4 4v16H6V2zm8 1.5V7h3.5L14 3.5zM8 10v1.5h8V10H8zm0 4v1.5h8V14H8z" />
		</svg>
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

function formatFileSize(bytes: number): string {
	if (bytes < 1024) {
		return `${bytes} B`;
	}
	if (bytes < 1024 * 1024) {
		return `${(bytes / 1024).toFixed(1)} KB`;
	}
	return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
