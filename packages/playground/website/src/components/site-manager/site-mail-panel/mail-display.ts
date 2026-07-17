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
