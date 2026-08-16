import type { Address, Email } from 'postal-mime';

export function getMailSubject(mail: Email): string {
	return mail.subject || '(No subject)';
}

export function formatAddressList(addresses: Address[] | undefined): string {
	return addresses?.map(formatAddress).join(', ') || '';
}

export function formatAddress(address: Address): string {
	if (address.group) {
		const members = address.group.map(formatAddress).join(', ');
		return members ? `${address.name}: ${members}` : address.name;
	}
	if (address.name && address.address) {
		return `${address.name} <${address.address}>`;
	}
	return address.address || address.name;
}

export function replaceCidReferences(
	html: string,
	references: Array<{ contentId?: string; url?: string }>
): string {
	const resolvedReferences: Array<{ contentId: string; url: string }> = [];
	for (const { contentId, url } of references) {
		const normalizedContentId = contentId?.trim().replace(/^<|>$/g, '');
		if (!normalizedContentId || !url) continue;
		resolvedReferences.push({ contentId: normalizedContentId, url });
	}
	resolvedReferences.sort((a, b) => b.contentId.length - a.contentId.length);

	let result = html;
	for (const { contentId, url } of resolvedReferences) {
		result = result.split(`cid:${contentId}`).join(url);
	}
	return result;
}
