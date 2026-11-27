import { __, _n, sprintf } from '@wordpress/i18n';
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
			const blob = new Blob([attachment.content], {
				type: attachment.mimeType,
			});
			nextResources.set(attachment, {
				url: URL.createObjectURL(blob),
				size: blob.size,
			});
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

	const heading = sprintf(
		/* translators: %d: Number of email attachments. */
		_n(
			'%d attachment',
			'%d attachments',
			attachments.length,
			'playground-website'
		),
		attachments.length
	);

	return (
		<div id="mail-attachments-host" className="mail-attachments">
			<template {...{ shadowrootmode: 'open' }}>
				<link rel="stylesheet" href={attachmentStylesheetUrl} />
				<section
					className="mail-attachments__content"
					aria-labelledby="mail-attachments-heading"
				>
					<hr className="mail-attachments__separator" />
					<h2
						id="mail-attachments-heading"
						className="mail-attachments__heading"
					>
						{heading}
					</h2>
					<ul
						className="mail-attachments__list"
						aria-label={__('Attachments', 'playground-website')}
					>
						{attachments.map((attachment, index) => {
							const filename =
								attachment.filename ||
								__('Unnamed attachment', 'playground-website');
							const resource = resources.get(attachment);

							let preview = (
								<svg
									className="mail-attachments__placeholder"
									viewBox="0 0 24 24"
									aria-hidden="true"
								>
									<path d="M6 2h8l4 4v16H6V2zm8 1.5V7h3.5L14 3.5zM8 10v1.5h8V10H8zm0 4v1.5h8V14H8z" />
								</svg>
							);
							if (
								resource &&
								attachment.mimeType.startsWith('image/')
							) {
								preview = (
									<img
										className="mail-attachments__preview-content mail-attachments__preview-content--visual"
										src={resource.url}
										alt={filename}
										loading="lazy"
									/>
								);
							} else if (
								resource &&
								attachment.mimeType.startsWith('video/')
							) {
								preview = (
									<video
										className="mail-attachments__preview-content mail-attachments__preview-content--visual"
										controls
										preload="metadata"
									>
										<source
											src={resource.url}
											type={attachment.mimeType}
										/>
									</video>
								);
							} else if (
								resource &&
								attachment.mimeType.startsWith('audio/')
							) {
								preview = (
									<audio
										className="mail-attachments__preview-content mail-attachments__preview-content--audio"
										controls
										preload="metadata"
									>
										<source
											src={resource.url}
											type={attachment.mimeType}
										/>
									</audio>
								);
							}

							let formattedSize: string | undefined;
							if (resource) {
								if (resource.size < 1024) {
									formattedSize = `${resource.size} B`;
								} else if (resource.size < 1024 * 1024) {
									formattedSize = `${(
										resource.size / 1024
									).toFixed(1)} KB`;
								} else {
									formattedSize = `${(
										resource.size /
										(1024 * 1024)
									).toFixed(1)} MB`;
								}
							}

							return (
								<li
									key={`${attachment.filename}-${index}`}
									className="mail-attachments__item"
								>
									<article className="mail-attachments__card">
										<div className="mail-attachments__media">
											<div className="mail-attachments__preview">
												{preview}
											</div>
											{resource && (
												<div className="mail-attachments__actions">
													<span className="mail-attachments__size">
														{sprintf(
															/* translators: %s: Formatted file size, e.g. "12.4 KB". */
															__(
																'Size: %s',
																'playground-website'
															),
															formattedSize
														)}
													</span>
													<a
														className="mail-attachments__download-link"
														href={resource.url}
														download={filename}
														aria-label={sprintf(
															/* translators: %s: Attachment filename. */
															__(
																'Download %s',
																'playground-website'
															),
															filename
														)}
													>
														<span
															className="mail-attachments__download-icon"
															aria-hidden="true"
														>
															&#8595;
														</span>{' '}
														{__(
															'Download',
															'playground-website'
														)}
													</a>
												</div>
											)}
										</div>
										<div
											className="mail-attachments__details"
											title={filename}
										>
											{filename}
										</div>
									</article>
								</li>
							);
						})}
					</ul>
				</section>
			</template>
		</div>
	);
}
