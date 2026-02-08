import { describe, it, expect, beforeEach } from 'vitest';
import { createSABMemFSBuffers, SharedSABFS } from './sabmemfs';
import type { SABMemFSBuffers } from './sabmemfs';

/**
 * Create a minimal mock of Emscripten's FS object — just enough
 * for SharedSABFS to initialize and operate.
 */
function createMockFS() {
	let nodeIdCounter = 1000;
	const FS: any = {
		createNode(parent: any, name: string, mode: number, rdev: number) {
			return {
				id: nodeIdCounter++,
				parent: parent || null,
				name,
				mode,
				rdev,
				mount: parent?.mount || { opts: {} },
				node_ops: {},
				stream_ops: {},
			};
		},
		isFile(mode: number) {
			return (mode & 0o170000) === 0o100000;
		},
		isDir(mode: number) {
			return (mode & 0o170000) === 0o040000;
		},
		isLink(mode: number) {
			return (mode & 0o170000) === 0o120000;
		},
		isChrdev() {
			return false;
		},
		isBlkdev() {
			return false;
		},
		getDevice() {
			return { stream_ops: {} };
		},
		// eslint-disable-next-line @typescript-eslint/no-unused-vars
	mount(fsType: any, opts: any, _mountpoint: string) {
			return fsType.mount({ opts });
		},
		ErrnoError: class ErrnoError extends Error {
			errno: number;
			constructor(errno: number) {
				super(`ErrnoError: ${errno}`);
				this.errno = errno;
			}
		},
	};
	return FS;
}

/**
 * Helper to drive the SABMEMFS through Emscripten's FS-like operations.
 * Wraps the low-level node_ops/stream_ops into a friendlier API for testing.
 */
class FSDriver {
	rootNode: any;

	private FS: any;
	private buffers: SABMemFSBuffers;

	constructor(FS: any, buffers: SABMemFSBuffers) {
		this.FS = FS;
		this.buffers = buffers;
		const fsType = SharedSABFS(FS, buffers);
		this.rootNode = fsType.mount({ opts: {} });
	}

	lookup(path: string): any {
		const parts = path.split('/').filter(Boolean);
		let node = this.rootNode;
		for (const part of parts) {
			node = node.node_ops.lookup(node, part);
		}
		return node;
	}

	mkdir(path: string): any {
		const parts = path.split('/').filter(Boolean);
		let parent = this.rootNode;
		for (let i = 0; i < parts.length - 1; i++) {
			parent = parent.node_ops.lookup(parent, parts[i]);
		}
		return parent.node_ops.mknod(
			parent,
			parts[parts.length - 1],
			0o040000 | 0o777,
			0
		);
	}

	createFile(path: string, content = ''): any {
		const parts = path.split('/').filter(Boolean);
		let parent = this.rootNode;
		for (let i = 0; i < parts.length - 1; i++) {
			parent = parent.node_ops.lookup(parent, parts[i]);
		}
		const node = parent.node_ops.mknod(
			parent,
			parts[parts.length - 1],
			0o100000 | 0o666,
			0
		);
		if (content) {
			this.writeFile(node, content);
		}
		return node;
	}

	writeFile(node: any, content: string | Uint8Array) {
		const data =
			typeof content === 'string'
				? new TextEncoder().encode(content)
				: content;
		const stream = { node, flags: 0x2, position: 0 }; // O_RDWR
		node.stream_ops.open(stream);
		node.stream_ops.write(stream, data, 0, data.length, 0);
		node.stream_ops.close(stream);
	}

	readFile(node: any): Uint8Array {
		const attr = node.node_ops.getattr(node);
		const buf = new Uint8Array(attr.size);
		const stream = { node, flags: 0, position: 0 }; // O_RDONLY
		node.stream_ops.open(stream);
		node.stream_ops.read(stream, buf, 0, attr.size, 0);
		node.stream_ops.close(stream);
		return buf;
	}

	readFileAsText(node: any): string {
		return new TextDecoder().decode(this.readFile(node));
	}

	readdir(node: any): string[] {
		return node.node_ops.readdir(node);
	}

	unlink(parentPath: string, name: string) {
		const parent =
			parentPath === '/'
				? this.rootNode
				: this.lookup(parentPath);
		parent.node_ops.unlink(parent, name);
	}

	rmdir(parentPath: string, name: string) {
		const parent =
			parentPath === '/'
				? this.rootNode
				: this.lookup(parentPath);
		parent.node_ops.rmdir(parent, name);
	}

	stat(node: any) {
		return node.node_ops.getattr(node);
	}

	symlink(parentPath: string, name: string, target: string): any {
		const parent =
			parentPath === '/'
				? this.rootNode
				: this.lookup(parentPath);
		return parent.node_ops.symlink(parent, name, target);
	}

	readlink(node: any): string {
		return node.node_ops.readlink(node);
	}
}

describe('SABMEMFS', () => {
	let fs: any;
	let buffers: SABMemFSBuffers;
	let driver: FSDriver;

	beforeEach(() => {
		fs = createMockFS();
		buffers = createSABMemFSBuffers(1 << 20, 4 << 20); // 1MB meta, 4MB data
		driver = new FSDriver(fs, buffers);
	});

	describe('basic file operations', () => {
		it('should create and read a file', () => {
			const node = driver.createFile('/hello.txt', 'Hello, World!');
			expect(driver.readFileAsText(node)).toBe('Hello, World!');
		});

		it('should create an empty file', () => {
			const node = driver.createFile('/empty.txt');
			const attr = driver.stat(node);
			expect(attr.size).toBe(0);
		});

		it('should overwrite file content', () => {
			const node = driver.createFile('/file.txt', 'initial');
			driver.writeFile(node, 'overwritten');
			expect(driver.readFileAsText(node)).toBe('overwritten');
		});

		it('should delete a file', () => {
			driver.createFile('/doomed.txt', 'bye');
			driver.unlink('/', 'doomed.txt');
			expect(() => driver.lookup('/doomed.txt')).toThrow();
		});

		it('should handle file stat correctly', () => {
			const node = driver.createFile('/stat-test.txt', 'abcdef');
			const attr = driver.stat(node);
			expect(attr.size).toBe(6);
			expect(attr.ino).toBeGreaterThan(0);
			expect(fs.isFile(attr.mode)).toBe(true);
			expect(fs.isDir(attr.mode)).toBe(false);
		});
	});

	describe('directory operations', () => {
		it('should create a directory', () => {
			const dir = driver.mkdir('/mydir');
			const attr = driver.stat(dir);
			expect(fs.isDir(attr.mode)).toBe(true);
		});

		it('should list directory entries', () => {
			driver.mkdir('/parent');
			const parentNode = driver.lookup('/parent');
			parentNode.node_ops.mknod(
				parentNode,
				'child1',
				0o100000 | 0o666,
				0
			);
			parentNode.node_ops.mknod(
				parentNode,
				'child2',
				0o100000 | 0o666,
				0
			);

			const entries = driver.readdir(parentNode);
			expect(entries).toContain('.');
			expect(entries).toContain('..');
			expect(entries).toContain('child1');
			expect(entries).toContain('child2');
		});

		it('should create nested directories', () => {
			driver.mkdir('/a');
			// Now create /a/b by looking up /a and using mknod
			const aNode = driver.lookup('/a');
			aNode.node_ops.mknod(aNode, 'b', 0o040000 | 0o777, 0);
			const bNode = driver.lookup('/a/b');
			bNode.node_ops.mknod(bNode, 'c', 0o040000 | 0o777, 0);

			const cNode = driver.lookup('/a/b/c');
			expect(fs.isDir(driver.stat(cNode).mode)).toBe(true);
		});

		it('should remove an empty directory', () => {
			driver.mkdir('/removeme');
			driver.rmdir('/', 'removeme');
			expect(() => driver.lookup('/removeme')).toThrow();
		});

		it('should not remove a non-empty directory', () => {
			driver.mkdir('/notempty');
			const dirNode = driver.lookup('/notempty');
			dirNode.node_ops.mknod(
				dirNode,
				'file.txt',
				0o100000 | 0o666,
				0
			);

			expect(() => driver.rmdir('/', 'notempty')).toThrow();
		});
	});

	describe('symlink operations', () => {
		it('should create and read a symlink', () => {
			driver.createFile('/target.txt', 'target content');
			const sym = driver.symlink('/', 'link.txt', '/target.txt');
			expect(driver.readlink(sym)).toBe('/target.txt');
		});

		it('should store symlink target as data', () => {
			const sym = driver.symlink('/', 'mylink', '/some/long/path');
			expect(driver.readlink(sym)).toBe('/some/long/path');
			const attr = driver.stat(sym);
			expect(fs.isLink(attr.mode)).toBe(true);
		});
	});

	describe('file attributes', () => {
		it('should chmod a file', () => {
			const node = driver.createFile('/perm.txt', 'test');
			node.node_ops.setattr(node, { mode: 0o755 });
			const attr = driver.stat(node);
			// The file type bits should be preserved, only permission bits changed
			expect(attr.mode & 0o7777).toBe(0o755);
			expect(fs.isFile(attr.mode)).toBe(true);
		});

		it('should truncate a file via setattr', () => {
			const node = driver.createFile(
				'/truncate.txt',
				'hello world'
			);
			expect(driver.stat(node).size).toBe(11);

			node.node_ops.setattr(node, { size: 5 });
			expect(driver.stat(node).size).toBe(5);
			expect(driver.readFileAsText(node)).toBe('hello');
		});

		it('should extend a file via setattr', () => {
			const node = driver.createFile('/extend.txt', 'hi');
			node.node_ops.setattr(node, { size: 10 });
			expect(driver.stat(node).size).toBe(10);
			const data = driver.readFile(node);
			expect(data[0]).toBe(104); // 'h'
			expect(data[1]).toBe(105); // 'i'
			// Bytes 2-9 should be zero
			for (let i = 2; i < 10; i++) {
				expect(data[i]).toBe(0);
			}
		});
	});

	describe('large files', () => {
		it('should write and read a file larger than 1 MB', () => {
			const node = driver.createFile('/large.bin');
			const size = 1.5 * 1024 * 1024; // 1.5 MB
			const data = new Uint8Array(size);
			for (let i = 0; i < size; i++) {
				data[i] = i & 0xff;
			}
			driver.writeFile(node, data);

			const read = driver.readFile(node);
			expect(read.length).toBe(size);
			// Spot-check
			expect(read[0]).toBe(0);
			expect(read[255]).toBe(255);
			expect(read[256]).toBe(0);
			expect(read[1000]).toBe(1000 & 0xff);
		});
	});

	describe('concurrent access', () => {
		it('should allow two SharedSABFS instances on the same buffers to share data', () => {
			const fs2 = createMockFS();
			const driver2 = new FSDriver(fs2, buffers);

			// Write from driver1
			driver.createFile('/shared.txt', 'written by worker 1');

			// Read from driver2
			const node2 = driver2.lookup('/shared.txt');
			expect(driver2.readFileAsText(node2)).toBe('written by worker 1');
		});

		it('should see new files created by another instance', () => {
			const fs2 = createMockFS();
			const driver2 = new FSDriver(fs2, buffers);

			driver.mkdir('/common');
			driver.createFile('/common/a.txt', 'A');
			driver.createFile('/common/b.txt', 'B');

			const commonNode2 = driver2.lookup('/common');
			const entries = driver2.readdir(commonNode2);
			expect(entries).toContain('a.txt');
			expect(entries).toContain('b.txt');
		});

		it('should see modifications from another instance', () => {
			const node = driver.createFile('/mutable.txt', 'original');

			const fs2 = createMockFS();
			const driver2 = new FSDriver(fs2, buffers);
			const node2 = driver2.lookup('/mutable.txt');
			driver2.writeFile(node2, 'modified by worker 2');

			// driver1 should see the modification
			expect(driver.readFileAsText(node)).toBe('modified by worker 2');
		});
	});

	describe('edge cases', () => {
		it('should handle long filenames (up to 127 bytes)', () => {
			// Max is I_NAME_WORDS * 4 - 1 = 127 bytes
			const shortName = 'a'.repeat(120) + '.txt';
			const node = driver.createFile('/' + shortName, 'data');
			expect(driver.readFileAsText(node)).toBe('data');
		});

		it('should reject filenames that are too long', () => {
			const tooLong = 'x'.repeat(200);
			expect(() => driver.createFile('/' + tooLong, 'data')).toThrow(
				/Filename too long/
			);
		});

		it('should handle empty file reads correctly', () => {
			const node = driver.createFile('/empty.bin');
			const data = driver.readFile(node);
			expect(data.length).toBe(0);
		});

		it('should not find deleted entries during readdir', () => {
			driver.createFile('/keep.txt', 'keep');
			driver.createFile('/delete.txt', 'delete');
			driver.unlink('/', 'delete.txt');

			const entries = driver.readdir(driver.rootNode);
			expect(entries).toContain('keep.txt');
			expect(entries).not.toContain('delete.txt');
		});

		it('should allow writing past the end of a file (sparse write)', () => {
			const node = driver.createFile('/sparse.txt', 'AB');
			// Write at position 10
			const stream = { node, flags: 0x2, position: 0 };
			node.stream_ops.open(stream);
			const data = new TextEncoder().encode('CD');
			node.stream_ops.write(stream, data, 0, 2, 10);
			node.stream_ops.close(stream);

			expect(driver.stat(node).size).toBe(12);
			const read = driver.readFile(node);
			expect(read[0]).toBe(65); // 'A'
			expect(read[1]).toBe(66); // 'B'
			// Gap should be zeros
			for (let i = 2; i < 10; i++) {
				expect(read[i]).toBe(0);
			}
			expect(read[10]).toBe(67); // 'C'
			expect(read[11]).toBe(68); // 'D'
		});
	});

	describe('error cases', () => {
		it('should throw ENOENT when looking up non-existent file', () => {
			try {
				driver.lookup('/nonexistent');
				expect.fail('should have thrown');
			} catch (e: any) {
				expect(e.errno).toBe(44); // ENOENT
			}
		});

		it('should throw ENOTEMPTY when removing non-empty directory', () => {
			driver.mkdir('/dir');
			const dirNode = driver.lookup('/dir');
			dirNode.node_ops.mknod(dirNode, 'f', 0o100666, 0);

			try {
				driver.rmdir('/', 'dir');
				expect.fail('should have thrown');
			} catch (e: any) {
				expect(e.errno).toBe(55); // ENOTEMPTY
			}
		});
	});

	describe('stream operations', () => {
		it('should support llseek with SEEK_SET', () => {
			const node = driver.createFile('/seek.txt', 'Hello, World!');
			const stream: any = { node, flags: 0, position: 0 };
			node.stream_ops.open(stream);

			const pos = node.stream_ops.llseek(stream, 7, 0); // SEEK_SET
			expect(pos).toBe(7);
			expect(stream.position).toBe(7);

			node.stream_ops.close(stream);
		});

		it('should support llseek with SEEK_CUR', () => {
			const node = driver.createFile('/seek2.txt', 'Hello, World!');
			const stream: any = { node, flags: 0, position: 5 };
			node.stream_ops.open(stream);
			stream.position = 5; // Reset after open

			const pos = node.stream_ops.llseek(stream, 3, 1); // SEEK_CUR
			expect(pos).toBe(8);

			node.stream_ops.close(stream);
		});

		it('should support llseek with SEEK_END', () => {
			const node = driver.createFile('/seek3.txt', 'Hello, World!');
			const stream: any = { node, flags: 0, position: 0 };
			node.stream_ops.open(stream);

			const pos = node.stream_ops.llseek(stream, -6, 2); // SEEK_END
			expect(pos).toBe(7); // 13 - 6 = 7

			node.stream_ops.close(stream);
		});

		it('should throw on negative seek position', () => {
			const node = driver.createFile('/badseek.txt', 'data');
			const stream: any = { node, flags: 0, position: 0 };
			node.stream_ops.open(stream);

			try {
				node.stream_ops.llseek(stream, -100, 0); // SEEK_SET to -100
				expect.fail('should have thrown');
			} catch (e: any) {
				expect(e.errno).toBe(28); // EINVAL
			}

			node.stream_ops.close(stream);
		});
	});

	describe('POSIX unlink-while-open semantics', () => {
		it('should keep file accessible after unlink if still open', () => {
			const node = driver.createFile('/open-unlink.txt', 'still here');

			// Open the file
			const stream: any = { node, flags: 0, position: 0 };
			node.stream_ops.open(stream);

			// Unlink while open
			driver.unlink('/', 'open-unlink.txt');

			// File should no longer appear in directory listing
			const entries = driver.readdir(driver.rootNode);
			expect(entries).not.toContain('open-unlink.txt');

			// But we can still read from the open stream
			const buf = new Uint8Array(10);
			const bytesRead = node.stream_ops.read(stream, buf, 0, 10, 0);
			expect(bytesRead).toBe(10);
			expect(new TextDecoder().decode(buf)).toBe('still here');

			// Close the file
			node.stream_ops.close(stream);
		});
	});

	describe('rename', () => {
		it('should rename a file within the same directory', () => {
			driver.createFile('/old-name.txt', 'content');
			const node = driver.lookup('/old-name.txt');
			node.node_ops.rename(node, driver.rootNode, 'new-name.txt');

			const renamedNode = driver.lookup('/new-name.txt');
			expect(driver.readFileAsText(renamedNode)).toBe('content');
			expect(() => driver.lookup('/old-name.txt')).toThrow();
		});

		it('should move a file to a different directory', () => {
			driver.mkdir('/src');
			driver.mkdir('/dst');
			const srcDir = driver.lookup('/src');
			srcDir.node_ops.mknod(srcDir, 'file.txt', 0o100666, 0);
			const fileNode = driver.lookup('/src/file.txt');

			const dstDir = driver.lookup('/dst');
			fileNode.node_ops.rename(fileNode, dstDir, 'file.txt');

			const movedNode = driver.lookup('/dst/file.txt');
			expect(movedNode).toBeTruthy();
			expect(() => driver.lookup('/src/file.txt')).toThrow();
		});
	});

	describe('createSABMemFSBuffers', () => {
		it('should create buffers with default sizes', () => {
			const b = createSABMemFSBuffers();
			expect(b.metaBuf.byteLength).toBe(16 << 20); // 16 MB
			expect(b.dataBuf.byteLength).toBe(256 << 20); // 256 MB
		});

		it('should create buffers with custom sizes', () => {
			const b = createSABMemFSBuffers(1024, 2048);
			expect(b.metaBuf.byteLength).toBe(1024);
			expect(b.dataBuf.byteLength).toBe(2048);
		});

		it('should create SharedArrayBuffer instances', () => {
			const b = createSABMemFSBuffers(1024, 2048);
			expect(b.metaBuf).toBeInstanceOf(SharedArrayBuffer);
			expect(b.dataBuf).toBeInstanceOf(SharedArrayBuffer);
		});
	});
});
