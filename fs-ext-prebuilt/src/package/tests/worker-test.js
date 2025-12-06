'use strict';

const { Worker, isMainThread, parentPort } = require('node:worker_threads');
const assert = require('node:assert');
const fs = require('node:fs');
const fsExt = require('../fs-ext');

class Mutex {
	constructor(filename) {
		this.filename = filename;
	}
	lock() {
		this.fd = fs.openSync(this.filename, 'w+');
		fsExt.flockSync(this.fd, 'ex');
	}
	unlock() {
		fsExt.flockSync(this.fd, 'un');
		fs.closeSync(this.fd);
		fs.rmSync(this.filename, { force: true });
		this.fd = null;
	}
}

const m = new Mutex('worker-test.lock');
const write = function (msg) {
	// Use explicit open/write/fsync/close to ensure the write is fully
	// persisted before returning. This prevents race conditions where
	// another process reads the file before filesystem caches are flushed.
	const fd = fs.openSync('worker-test.log', 'a');
	fs.writeSync(fd, `${msg}\n`);
	fs.fsyncSync(fd);
	fs.closeSync(fd);
};

fs.rmSync('worker-test.log', { force: true });

if (isMainThread) {
	m.lock();
	setTimeout(() => {
		write('releasing main lock');
		m.unlock();
	}, 100);
	const worker = new Worker(__filename);
	worker.on('message', () => {
		assert.deepEqual(
			fs
				.readFileSync('worker-test.log', 'utf-8')
				.split('\n')
				.map((line) => line.trim())
				.filter((a) => a),
			['releasing main lock', 'worker lock acquired']
		);
		worker.terminate();
		fs.rmSync('worker-test.log');
	});
} else {
	m.lock();
	write('worker lock acquired');
	m.unlock();
	parentPort.postMessage('complete');
}
