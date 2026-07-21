import type { Attachment } from 'postal-mime';
import { useEffect, useState } from 'react';

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
		<div
			id="mail-attachments-host"
			style={{ all: 'initial', display: 'block' }}
		>
			<template {...{ shadowrootmode: 'open' }}>
				<style>{attachmentStyles}</style>
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

const attachmentStyles = `
	* { box-sizing: border-box; }
	.attachments {
		display: block;
		min-width: 0;
		padding: 16px 16px 0;
		color: #1e1e1e;
		font: 14px/1.5 -apple-system, BlinkMacSystemFont, Segoe UI, Roboto,
			Oxygen-Sans, Ubuntu, Cantarell, Helvetica Neue, sans-serif;
	}
	hr { height: 0; margin: 0 0 16px; border: 0; border-top: 1px solid #dddddd; }
	h2 { margin: 0 0 8px; font-size: 15px; line-height: 20px; }
	ul {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(min(100%, 180px), 1fr));
		gap: 12px;
		width: 100%;
		margin: 0;
		padding: 2px 2px 8px;
		list-style: none;
	}
	li { min-width: 0; }
	.card {
		height: 100%;
		overflow: hidden;
		border: 1px solid #dddddd;
		border-radius: 2px;
		background: #ffffff;
	}
	.media {
		position: relative;
		display: flex;
		align-items: center;
		justify-content: center;
		height: 80px;
		overflow: hidden;
		background: #f0f0f0;
	}
	.preview {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 100%;
		height: 100%;
	}
	.preview img, .preview video {
		display: block;
		width: 100%;
		height: 100%;
		object-fit: contain;
	}
	.preview audio { display: block; width: calc(100% - 24px); }
	.placeholder { width: 32px; height: 32px; fill: #757575; }
	.actions {
		position: absolute;
		inset: 0;
		display: flex;
		flex-direction: column;
		gap: 8px;
		align-items: center;
		justify-content: center;
		padding: 8px;
		opacity: 0;
		pointer-events: none;
		color: #757575;
		font-size: 12px;
		background: #f0f0f0;
	}
	.card:hover .preview, .card:focus-within .preview { opacity: 0; }
	.card:hover .actions, .card:focus-within .actions {
		opacity: 1;
		pointer-events: auto;
	}
	.actions a {
		display: inline-flex;
		gap: 4px;
		align-items: center;
		color: #3858e9;
		font-size: 13px;
		text-decoration: none;
		pointer-events: auto;
	}
	.actions a:hover { text-decoration: underline; }
	.details {
		min-width: 0;
		padding: 8px 12px;
		overflow: hidden;
		font-weight: 600;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	@media (prefers-reduced-motion: no-preference) {
		.preview, .actions { transition: opacity 120ms ease-out; }
	}
`;
