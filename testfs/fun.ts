import { configure, InMemory, fs, Overlay } from '@zenfs/core';
import { Zip } from '@zenfs/zip';
import nodefs from 'fs';
import EmscriptenFS from './EmscriptenFs';

const zipData = nodefs.readFileSync(__dirname + '/test.zip').buffer;
const zipfs = Zip.create({ zipData });
console.log(zipfs.readdirSync('/'));

const writableFs = InMemory.create({ name: 'yay' });
const originalCreateFileSync = writableFs.createFileSync;
writableFs.createFileSync = function (path, flag, mode, cred) {
	const parentDir = path.split('/').slice(0, -1).join('/');
	if (!writableFs.existsSync(parentDir, cred)) {
		writableFs.mkdirSync(parentDir, 0o777, cred);
	}
	return originalCreateFileSync.call(this, path, flag, mode, cred);
};

await configure({
	'/': Overlay.create({
		readable: zipfs,
		writable: writableFs,
	}).fs,
});
await zipfs.ready();

console.log(fs.readdirSync('/zipdir'));
fs.writeFileSync('/zipdir/newfile.txt', 'hello world');
console.log(fs.readdirSync('/zipdir'));
console.log(new TextDecoder().decode(fs.readFileSync('/zipdir/noop.ts')));
console.log(new TextDecoder().decode(fs.readFileSync('/zipdir/newfile.txt')));

// Grab the BrowserFS Emscripten FS plugin.
var BFS = new EmscriptenFS();
// FS.mount(BFS, { root: '/' }, '/data');
