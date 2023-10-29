import { PlaygroundClient, startPlaygroundWeb } from '@wp-playground/client';
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

class Counter extends Map<string, number> {
    increment(key: string) {
        this.set(key, (this.get(key) ?? 0) + 1);
    }
    get(key: string): number {
        return super.get(key) || 0;
    }
    decrement(key: string) {
        const newValue = (this.get(key) ?? 0) - 1;
        if (newValue > 0) {
            this.set(key, newValue);
        } else {
            this.delete(key);
        }
    }
}

const lastClient1ToClient2Sql = new Counter();
const lastClient2ToClient1Sql = new Counter();

client1.onMessage(async (messageString) => {
	const { type, ...data } = JSON.parse(messageString) as any;
	if (type !== 'sql') {
		return;
	}
	const firstKeyword = data.query.trim().split(/\s/)[0].toLowerCase();
	if (firstKeyword === 'select') {
		return;
	}
	if (lastClient2ToClient1Sql.get(data.query) > 0) {
		return;
	}
	console.log('[SQL][Client 1]', data.query);
	lastClient1ToClient2Sql.increment(data.query);
    client2.runSqlQueries([data.query]).then(() => {
        lastClient1ToClient2Sql.decrement(data.query);
    });
});

client2.onMessage(async (messageString) => {
	const { type, ...data } = JSON.parse(messageString) as any;
	if (type !== 'sql') {
		return;
	}
	const firstKeyword = data.query.trim().split(/\s/)[0].toLowerCase();
	if (firstKeyword === 'select') {
		return;
	}
	if (lastClient1ToClient2Sql.get(data.query) > 0) {
		return;
	}
	console.log('[SQL][Client 2]', data.query);
	lastClient2ToClient1Sql.increment(data.query);
    client1.runSqlQueries([data.query]).then(() => {
        lastClient2ToClient1Sql.decrement(data.query);
    });
});

let lastClient1ToClient2Op = '';
let lastClient2ToClient1Op = '';
client1.journalMemfs(async (op: FilesystemOperation) => {
	if (
		op.path.endsWith('/.ht.sqlite') ||
		op.path.endsWith('/.ht.sqlite-journal')
	) {
		return;
	}
	const opString = JSON.stringify(op.path);
	if (lastClient2ToClient1Op === opString) {
		return;
	}
	lastClient1ToClient2Op = opString;
	if (op.operation === 'CREATE_DIRECTORY') {
		await client2.mkdirTree(op.path);
	} else if (op.operation === 'DELETE') {
		if (op.nodeType === 'file') {
			await client2.unlink(op.path);
		} else {
			await client2.rmdir(op.path, {
				recursive: true,
			});
		}
	} else if (op.operation === 'UPDATE_FILE') {
		await client1
			.readFileAsBuffer(op.path)
			.then((data) => client2.writeFile(op.path, data));
	} else if (op.operation === 'RENAME') {
		await client2.mv(op.path, op.toPath);
	}
});
client2.journalMemfs(async (op: FilesystemOperation) => {
	if (
		op.path.endsWith('/.ht.sqlite') ||
		op.path.endsWith('/.ht.sqlite-journal')
	) {
		return;
	}
	const opString = JSON.stringify(op.path);
	if (lastClient1ToClient2Op === opString) {
		return;
	}
	lastClient2ToClient1Op = opString;
	if (op.operation === 'CREATE_DIRECTORY') {
		await client1.mkdirTree(op.path);
	} else if (op.operation === 'DELETE') {
		if (op.nodeType === 'file') {
			await client1.unlink(op.path);
		} else {
			await client1.rmdir(op.path, {
				recursive: true,
			});
		}
	} else if (op.operation === 'UPDATE_FILE') {
		await client1
			.readFileAsBuffer(op.path)
			.then((data) => client1.writeFile(op.path, data));
	} else if (op.operation === 'RENAME') {
		await client1.mv(op.path, op.toPath);
	}
});

// let refreshTimeout: any = null;
// if (refreshTimeout) {
//     clearTimeout(refreshTimeout);
// }
// refreshTimeout = setTimeout(() => {
//     client2.getCurrentURL().then((url) => {
//         client2.goTo(url);
//     });
// }, 150);
