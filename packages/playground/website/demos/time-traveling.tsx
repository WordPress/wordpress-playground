import React from 'react';
import { createRoot } from 'react-dom/client';

import { startPlaygroundWeb } from '@wp-playground/client';
import { login } from '@wp-playground/blueprints';
import {
	setupPlaygroundSync,
	NoopTransport,
	loggerMiddleware,
} from '@wp-playground/sync';
import type { TransportEnvelope, SyncMiddleware } from '@wp-playground/sync';
import { getRemoteUrl } from '../src/lib/config';

const clientId = 'time-traveling';

export async function restartDemo(initialJournal: TransportEnvelope[] = []) {
	const autoincrementOffset = Math.round((1 + Math.random()) * 1_000_000);
	console.log({ autoincrementOffset });
	const iframe = document.getElementById('wp') as HTMLIFrameElement;
	const playground = await startPlaygroundWeb({
		iframe,
		remoteUrl: getRemoteUrl().toString(),
	});
	const transport = new NoopTransport();
	await setupPlaygroundSync(playground, {
		autoincrementOffset,
		transport,
		middlewares: [loggerMiddleware(clientId), timeTravellingMiddleware],
	});
	initialJournal.forEach((envelope) => transport.injectChanges(envelope));

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
		restartDemo(checkedEnvelopes);
	}
	return (
		<>
			<button type="button" onClick={replay}>
				Replay selected
			</button>
			<ul>
				{[...envelopes].reverse().map((envelope) => (
					<li key={envelope.id}>
						<label>
							<div>
								<h4>
									<input
										type="checkbox"
										checked={
											!uncheckedEnvelopes.has(envelope.id)
										}
										onChange={() =>
											toggleEnvelope(envelope.id)
										}
									/>
									&nbsp; Batch of changes #${envelope.id}
								</h4>
							</div>
							<h5>SQL changes</h5>
							<ul>
								{envelope.sql.map((sql, idx) => (
									<li key={idx}>{JSON.stringify(sql)}</li>
								))}
							</ul>
							<h5>FS changes</h5>
							<ul>
								{envelope.fs.map((fs, idx) => (
									<li key={idx}>{JSON.stringify(fs)}</li>
								))}
							</ul>
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
function storeEnvelopes(envelope: TransportEnvelope) {
	if (!envelope.sql.length && !envelope.fs.length) return;
	storedEnvelopes.push({ ...envelope, id: storedEnvelopes.length });
	root.render(<EnvelopeList envelopes={storedEnvelopes} />);
}
