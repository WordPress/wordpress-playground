const CHANNEL_NAME = 'personal-wp-app-update';

type UpdateChannelMessage = {
	type: 'update-available';
	deployedVersion: string;
	senderId: string;
};

export function openAppUpdateChannel(
	senderId: string,
	onUpdateAvailable: (deployedVersion: string) => void
): BroadcastChannel | null {
	if (typeof BroadcastChannel === 'undefined') {
		return null;
	}

	const channel = new BroadcastChannel(CHANNEL_NAME);
	channel.onmessage = (event: MessageEvent<UpdateChannelMessage>) => {
		const message = event.data;
		if (
			message?.type !== 'update-available' ||
			message.senderId === senderId
		) {
			return;
		}

		onUpdateAvailable(message.deployedVersion);
	};

	return channel;
}

export function broadcastAppUpdate(
	channel: BroadcastChannel | null,
	senderId: string,
	deployedVersion: string
) {
	channel?.postMessage({
		type: 'update-available',
		deployedVersion,
		senderId,
	} satisfies UpdateChannelMessage);
}
