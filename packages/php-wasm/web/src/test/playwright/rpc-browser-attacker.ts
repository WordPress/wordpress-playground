/**
 * SPDX-License-Identifier: GPL-2.0-or-later
 */

const targetId = new URL(location.href).searchParams.get('target-id')!;
const target = parent.document.getElementById(targetId) as HTMLIFrameElement;
const channel = new MessageChannel();
let acknowledged = false;
channel.port1.addEventListener(
	'message',
	() => {
		acknowledged = true;
	},
	{ once: true }
);
channel.port1.start();
target.contentWindow!.postMessage(
	{
		protocol: 'wordpress-playground-rpc-bootstrap',
		version: 1,
		kind: 'connect',
		session: 'hostile-source-session',
	},
	location.origin,
	[channel.port2]
);
setTimeout(() => {
	channel.port1.close();
	parent.postMessage(
		{
			protocol: 'rpc-hostile-source-result',
			acknowledged,
		},
		location.origin
	);
}, 60);
