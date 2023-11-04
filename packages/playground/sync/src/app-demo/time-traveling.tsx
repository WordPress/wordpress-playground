import React from 'react';
import { createRoot } from 'react-dom/client';

import { startPlaygroundWeb } from '@wp-playground/client';
import { login } from '@wp-playground/blueprints';
import { setupPlaygroundSync } from '..';
import { NoopTransport, TransportEnvelope } from '../transports';
import { SyncMiddleware, loggerMiddleware } from '../middleware';

const clientId = 'time-traveling';

export async function restartAndReplay(initialJournal: TransportEnvelope[] = []) {
    const autoincrementOffset = Math.round((1 + Math.random()) * 1_000_000);
    console.log({autoincrementOffset})
	const iframe = document.getElementById('wp') as HTMLIFrameElement;
	const playground = await startPlaygroundWeb({
		iframe,
		remoteUrl: 'http://localhost:4400/remote.html',
	});
	const transport = new NoopTransport();
	await setupPlaygroundSync(playground, {
		autoincrementOffset,
		transport,
		middlewares: [loggerMiddleware(clientId), timeTravellingMiddleware],
	});
	transport.injectChanges(initialJournal);

	await login(playground, { username: 'admin', password: 'password' });
	await playground.goTo('/');
}

const timeTravellingMiddleware: SyncMiddleware = {
	beforeSend(envelopes) {
		storeEnvelopes(envelopes);
		return envelopes;
	},
	afterReceive(envelopes) {
		// We're in the solo mode and not receiving anything from the server.
		return envelopes;
	},
};

type EnvelopeListProps = {
	envelopes: EnvelopeWithId[];
};
const EnvelopeList: React.FC<EnvelopeListProps> = ({
	envelopes,
}: EnvelopeListProps) => {
	const [uncheckedEnvelopes, setUncheckedEnvelopes] = React.useState<
		Set<number>
	>(new Set());
	function toggleEnvelope(id: number) {
		setUncheckedEnvelopes((uncheckedEnvelopes) => {
			const newSet = new Set(uncheckedEnvelopes);
			if (newSet.has(id)) {
				newSet.delete(id);
			} else {
				newSet.add(id);
			}
			return newSet;
		});
	}
	function replay() {
		const checkedEnvelopes = envelopes.filter(
			(envelope) => !uncheckedEnvelopes.has(envelope.id)
		);
		console.log('Replaying');
		restartAndReplay(checkedEnvelopes);
	}
	return (
		<>
			<h2>The list</h2>
			<button type="button" onClick={replay}>
				Replay selected
			</button>
			<ul>
				{[...envelopes].reverse().map((envelope) => (
					<li key={envelope.id}>
						<label>
							<input
								type="checkbox"
								checked={!uncheckedEnvelopes.has(envelope.id)}
								onChange={() => toggleEnvelope(envelope.id)}
							/>
							&nbsp;
							{JSON.stringify(envelope.contents)}
						</label>
					</li>
				))}
			</ul>
		</>
	);
};

const domNode = document.getElementById('logs') as any;
const root = createRoot(domNode);
root.render(<EnvelopeList envelopes={[]} />);

type EnvelopeWithId = TransportEnvelope & { id: number };
const storedEnvelopes: EnvelopeWithId[] = [];
function storeEnvelopes(envelopes: TransportEnvelope[]) {
	for (const envelope of envelopes) {
		storedEnvelopes.push({ ...envelope, id: storedEnvelopes.length });
	}
	root.render(<EnvelopeList envelopes={storedEnvelopes} />);
}
