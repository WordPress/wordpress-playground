import { startPlaygroundWeb } from '@wp-playground/client';
import { login } from '@wp-playground/blueprints';
import { FilesystemOperation } from '@php-wasm/universal';

const [client1, client2] = await Promise.all([
	startPlaygroundWeb({
		iframe: document.getElementById('wp1') as HTMLIFrameElement,
		remoteUrl: 'http://localhost:4400/remote.html',
	}),
	startPlaygroundWeb({
		iframe: document.getElementById('wp2') as HTMLIFrameElement,
		remoteUrl: 'http://localhost:4400/remote.html',
	}),
]);
await Promise.all([
	login(client1, { username: 'admin', password: 'password' }),
	login(client2, { username: 'admin', password: 'password' }),
]);
await client1.goTo('/');
await client2.goTo('/');

console.log({ client1, client2 });

let refreshTimeout: any = null;
client1.onMessage((messageString) => {
	const { type, ...data } = JSON.parse(messageString) as any;
	if (type === 'sql') {
		const firstKeyword = data.query.trim().split(/\s/)[0].toLowerCase();
		if (firstKeyword !== 'select') {
			console.log('SQL', data.query);
			client2.runSqlQueries([data.query]);
			if (refreshTimeout) {
				clearTimeout(refreshTimeout);
			}
			refreshTimeout = setTimeout(() => {
				client2.getCurrentURL().then((url) => {
					client2.goTo(url);
				});
			}, 150);
		}
	}
});

client1.journalMemfs((op: FilesystemOperation) => {
	if (
		op.path.endsWith('/.ht.sqlite') ||
		op.path.endsWith('/.ht.sqlite-journal')
	) {
		return;
	}
	if (op.operation === 'CREATE_DIRECTORY') {
		client2.mkdirTree(op.path);
	} else if (op.operation === 'DELETE') {
		if (op.nodeType === 'file') {
			client2.unlink(op.path);
		} else {
			client2.rmdir(op.path, {
				recursive: true,
			});
		}
	} else if (op.operation === 'UPDATE_FILE') {
		client1
			.readFileAsBuffer(op.path)
			.then((data) => client2.writeFile(op.path, data));
	} else if (op.operation === 'RENAME') {
		client2.mv(op.path, op.toPath);
	}
});
