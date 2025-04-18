import { PHP } from '@php-wasm/universal';

const // S_IFCHR = 0o020000,
	S_IFDIR = 0o040000,
	// S_IFREG = 0o100000,
	S_IFLNK = 0o120000;

const MODE_DIR = S_IFDIR | 0o777,
	// MODE_FILE = S_IFREG | 0o666,
	MODE_SYMLINK = S_IFLNK | 0o777;

const IDX_LOCK = 0,
	IDX_MAGIC = 1,
	IDX_NEXT_INODE = 2,
	IDX_NEXT_DATA = 3;
const HEADER_WORDS = 256;
const I_MODE = 0,
	I_UID = 1,
	I_GID = 2,
	I_NLINK = 3,
	I_SIZE_LO = 4,
	I_SIZE_HI = 5,
	I_PARENT = 6,
	I_DATA_OFF = 7,
	I_CAPACITY = 8,
	I_RDEV = 9,
	I_ATIME_LO = 10,
	I_ATIME_HI = 11,
	I_MTIME_LO = 12,
	I_MTIME_HI = 13,
	I_CTIME_LO = 14,
	I_CTIME_HI = 15,
	I_NAME_OFF = 16;

const INODE_WORDS = 16 + 32; // 32 words (128 bytes) for name
const NAME_BYTES = 128;
const MAGIC = 0x53414653; // “SAFS”
const TD = new TextDecoder();
const TE = new TextEncoder();
const now64 = () => BigInt(Date.now());

// ───────────────── backend factory ─────────────────
function SharedArrayBufferFS(
	FS: any,
	metaBuf: SharedArrayBuffer,
	dataBuf: SharedArrayBuffer,
	maxInodes = 4096
) {
	const meta = new Int32Array(metaBuf);
	const meta8 = new Uint8Array(metaBuf);
	const data8 = new Uint8Array(dataBuf);
	const inodeBase = HEADER_WORDS;

	// ── locking ──
	const lock = () => {
		while (Atomics.compareExchange(meta, IDX_LOCK, 0, 1) !== 0)
			Atomics.wait(meta, IDX_LOCK, 1);
	};
	const unlock = () => {
		Atomics.store(meta, IDX_LOCK, 0);
		Atomics.notify(meta, IDX_LOCK);
	};

	// ── init root once ──
	if (Atomics.load(meta, IDX_MAGIC) !== MAGIC) {
		lock();
		if (meta[IDX_MAGIC] !== MAGIC) {
			meta[IDX_MAGIC] = MAGIC;
			meta[IDX_NEXT_INODE] = 2; // inode 1 = /
			meta[IDX_NEXT_DATA] = 0;
			const off = inodeBase; // inode 1 offset
			meta[off + I_MODE] = MODE_DIR;
			meta[off + I_PARENT] = 1;
			meta[off + I_NLINK] = 1;
			writeSize(off, 0);
			writeName(off, '/');
			writeTimes(off, true, true, true);
		}
		unlock();
	}

	// ── helpers ──
	const ioff = (id: number) => inodeBase + (id - 1) * INODE_WORDS;
	/* helper — works for both regular and SAB‑backed views */
	const decode = (u8: Uint8Array) =>
		TD.decode(u8.buffer instanceof SharedArrayBuffer ? u8.slice() : u8);

	function writeSize(off: number, sz: number) {
		meta[off + I_SIZE_LO] = sz >>> 0;
		meta[off + I_SIZE_HI] = (sz / 0x100000000) >>> 0;
	}
	function readSize(off: number) {
		return meta[off + I_SIZE_LO] + meta[off + I_SIZE_HI] * 0x100000000;
	}
	function writeName(off: number, s: string) {
		const e = TE.encode(s);
		if (e.length >= NAME_BYTES) throw new FS.ErrnoError(63); // ENAMETOOLONG
		meta8.fill(
			0,
			(off + I_NAME_OFF) * 4,
			(off + I_NAME_OFF) * 4 + NAME_BYTES
		);
		meta8.set(e, (off + I_NAME_OFF) * 4);
	}
	function readName(off: number) {
		const base = (off + I_NAME_OFF) * 4;
		const view = meta8.subarray(base, base + NAME_BYTES);

		// find NUL
		let len = 0;
		while (len < view.length && view[len] !== 0) len++;
		return decode(view.subarray(0, len));
	}
	function writeTimes(off: number, at = false, mt = false, ct = false) {
		const t = now64();
		if (at) {
			meta[off + I_ATIME_LO] = Number(t & 0xffffffffn);
			meta[off + I_ATIME_HI] = Number(t >> 32n);
		}
		if (mt) {
			meta[off + I_MTIME_LO] = Number(t & 0xffffffffn);
			meta[off + I_MTIME_HI] = Number(t >> 32n);
		}
		if (ct) {
			meta[off + I_CTIME_LO] = Number(t & 0xffffffffn);
			meta[off + I_CTIME_HI] = Number(t >> 32n);
		}
	}
	function allocData(bytes: number) {
		const off = Atomics.add(meta, IDX_NEXT_DATA, bytes);
		if (off + bytes > data8.length) throw new FS.ErrnoError(28);
		return off;
	}

	// dir helpers
	const dirCount = (off: number) => meta[off + I_SIZE_LO];
	const dirVec = (off: number) =>
		new Int32Array(metaBuf, meta[off + I_DATA_OFF], dirCount(off));
	const dirPush = (off: number, id: number) => {
		const cnt = dirCount(off);
		let cap = meta[off + I_CAPACITY];
		let start = meta[off + I_DATA_OFF];
		if (cnt >= cap) {
			// grow vector
			const nc = Math.max(4, cap * 2);
			const n = allocData(nc * 4);
			if (cnt) meta8.copyWithin(n, start, start + cnt * 4);
			start = n;
			cap = nc;
			meta[off + I_DATA_OFF] = start;
			meta[off + I_CAPACITY] = cap;
		}
		new Int32Array(metaBuf, start, cap)[cnt] = id;
		meta[off + I_SIZE_LO] = cnt + 1;
	};
	const dirRemove = (off: number, id: number) => {
		const cnt = dirCount(off);
		const vec = dirVec(off);
		for (let i = 0; i < cnt; i++)
			if (vec[i] === id) {
				vec[i] = vec[cnt - 1];
				meta[off + I_SIZE_LO] = cnt - 1;
				return;
			}
		throw new FS.ErrnoError(44);
	};

	// inode alloc
	function allocInode(parent: number, mode: number, name: string, rdev = 0) {
		lock();
		const id = Atomics.add(meta, IDX_NEXT_INODE, 1);
		if (id > maxInodes) {
			unlock();
			throw new FS.ErrnoError(28);
		}
		const off = ioff(id);
		meta.fill(0, off, off + INODE_WORDS);
		meta[off + I_MODE] = mode;
		meta[off + I_PARENT] = parent;
		meta[off + I_NLINK] = 1;
		meta[off + I_RDEV] = rdev;
		writeSize(off, 0);
		writeName(off, name);
		writeTimes(off, true, true, true);
		if ((mode & S_IFDIR) === S_IFDIR) meta[off + I_CAPACITY] = 0; // dir vector lazily alloc
		dirPush(ioff(parent), id);
		writeTimes(ioff(parent), false, true, true);
		unlock();
		return id;
	}

	// raw I/O
	function readData(id: number, pos: number, len: number, out: Uint8Array) {
		const off = ioff(id);
		const size = readSize(off);
		if (pos >= size) return 0;
		const to = Math.min(len, size - pos);
		out.set(
			data8.subarray(
				meta[off + I_DATA_OFF] + pos,
				meta[off + I_DATA_OFF] + pos + to
			)
		);
		writeTimes(off, true, false, false);
		return to;
	}
	function writeData(id: number, pos: number, src: Uint8Array) {
		const off = ioff(id);
		let cap = meta[off + I_CAPACITY];
		let start = meta[off + I_DATA_OFF];
		const size = readSize(off);
		const end = pos + src.length;
		lock();
		if (end > cap) {
			// reallocate
			const newCap = Math.max(
				end,
				cap ? (cap < 1 << 20 ? cap * 2 : (cap * 9) >> 3) : 256
			);
			const newOff = allocData(newCap);
			if (size) data8.copyWithin(newOff, start, start + size);
			start = newOff;
			cap = newCap;
			meta[off + I_DATA_OFF] = start;
			meta[off + I_CAPACITY] = cap;
		}
		if (pos > size) data8.fill(0, start + size, start + pos);
		data8.set(src, start + pos);
		if (end > size) writeSize(off, end);
		writeTimes(off, false, true, true);
		unlock();
	}

	// mark deleted
	const markDel = (id: number) => {
		meta[ioff(id) + I_MODE] = 0;
	};

	// JS‑side node creator
	function makeNode(id: number, mount: any, parent: any) {
		const off = ioff(id);
		const mode = meta[off + I_MODE];
		const name = readName(off);
		const node = FS.createNode(parent, name, mode, meta[off + I_RDEV]);
		node.sabId = id;
		node.node_ops = node_ops;
		node.stream_ops = FS.isChrdev(mode)
			? FS.getDevice(node.rdev).stream_ops
			: stream_ops;
		return node;
	}

	// ── node_ops ──
	const node_ops = {
		getattr(node: any) {
			const o = ioff(node.sabId),
				mode = meta[o + I_MODE];
			const sz = mode & S_IFDIR ? 4096 : readSize(o);
			const ts = (i: number) =>
				new Date(meta[o + i + 1] * 0x100000000 + meta[o + i]);
			return {
				dev: 1,
				ino: node.sabId,
				mode,
				nlink: meta[o + I_NLINK],
				uid: meta[o + I_UID],
				gid: meta[o + I_GID],
				rdev: meta[o + I_RDEV],
				size: sz,
				atime: ts(I_ATIME_LO),
				mtime: ts(I_MTIME_LO),
				ctime: ts(I_CTIME_LO),
			};
		},
		setattr(node: any, a: any) {
			const o = ioff(node.sabId);
			lock();
			if (a.mode !== undefined)
				meta[o + I_MODE] =
					(meta[o + I_MODE] & 0o170000) | (a.mode & 0o777);
			if (a.uid !== undefined) meta[o + I_UID] = a.uid;
			if (a.gid !== undefined) meta[o + I_GID] = a.gid;
			if (a.size !== undefined) {
				const cur = readSize(o);
				if (a.size < cur) writeSize(o, a.size);
				else if (a.size > cur)
					writeData(node.sabId, cur, new Uint8Array(a.size - cur));
			}
			writeTimes(o, false, false, true);
			unlock();
		},
		lookup(parent: any, name: string) {
			const vec = dirVec(ioff(parent.sabId));
			for (let i = 0; i < vec.length; i++)
				if (readName(ioff(vec[i])) === name)
					return makeNode(vec[i], parent.mount, parent);
			throw new FS.ErrnoError(44);
		},
		mknod(p: any, n: string, m: number, d: number) {
			return makeNode(allocInode(p.sabId, m, n, d), p.mount, p);
		},
		rename(old: any, ndir: any, n: string) {
			lock();
			dirRemove(ioff(meta[ioff(old.sabId) + I_PARENT]), old.sabId);
			meta[ioff(old.sabId) + I_PARENT] = ndir.sabId;
			writeName(ioff(old.sabId), n);
			dirPush(ioff(ndir.sabId), old.sabId);
			writeTimes(ioff(old.sabId), false, false, true);
			unlock();
		},
		unlink(p: any, n: string) {
			const c = node_ops.lookup(p, n);
			lock();
			dirRemove(ioff(p.sabId), c.sabId);
			markDel(c.sabId);
			unlock();
		},
		rmdir(p: any, n: string) {
			const c = node_ops.lookup(p, n);
			if (dirCount(ioff(c.sabId))) throw new FS.ErrnoError(55);
			lock();
			dirRemove(ioff(p.sabId), c.sabId);
			markDel(c.sabId);
			unlock();
		},
		readdir(n: any) {
			const l = ['.', '..'],
				v = dirVec(ioff(n.sabId));
			for (let i = 0; i < v.length; i++) l.push(readName(ioff(v[i])));
			return l;
		},
		symlink(p: any, n: string, tgt: string) {
			const id = allocInode(p.sabId, MODE_SYMLINK, n);
			writeData(id, 0, TE.encode(tgt));
			return makeNode(id, p.mount, p);
		},
		readlink(n: any) {
			if (!(n.mode & S_IFLNK)) throw new FS.ErrnoError(28);
			const o = ioff(n.sabId);
			return TD.decode(
				data8.subarray(
					meta[o + I_DATA_OFF],
					meta[o + I_DATA_OFF] + readSize(o)
				)
			);
		},
		chmod(n: any, m: number) {
			node_ops.setattr(n, { mode: m });
		},
		chown(n: any, u: number, g: number) {
			node_ops.setattr(n, { uid: u, gid: g });
		},
	};

	// ── stream_ops ──
	const stream_ops = {
		open(s: any) {
			if (s.flags & 0x400 && FS.isFile(s.node.mode))
				node_ops.setattr(s.node, { size: 0 });
			s.position = s.flags & 0x800 ? readSize(ioff(s.node.sabId)) : 0;
		},
		close() {},
		read(s: any, b: Uint8Array, o: number, l: number, p: number) {
			const pos = p ?? s.position,
				tmp = new Uint8Array(l);
			const r = readData(s.node.sabId, pos, l, tmp);
			b.set(tmp.subarray(0, r), o);
			if (p === undefined) s.position += r;
			return r;
		},
		write(s: any, b: Uint8Array, o: number, l: number, p: number) {
			const pos = p ?? s.position;
			writeData(s.node.sabId, pos, b.subarray(o, o + l));
			if (p === undefined) s.position += l;
			return l;
		},
		llseek(s: any, off: number, w: number) {
			const pos =
				w === 0
					? off
					: w === 1
					? s.position + off
					: readSize(ioff(s.node.sabId)) + off;
			if (pos < 0) throw new FS.ErrnoError(28);
			s.position = pos;
			return pos;
		},
		flush() {
			return 0;
		},
		fsync() {
			return 0;
		},
		ioctl() {
			throw new FS.ErrnoError(59);
		},
		allocate(s: any, o: number, l: number) {
			node_ops.setattr(s.node, { size: o + l });
		},
		mmap(s: any, addr: number, len: number, pos: number) {
			const p = FS._malloc(len);
			new Uint8Array(FS.HEAPU8.buffer, p, len).set(new Uint8Array(len));
			stream_ops.read(
				s,
				new Uint8Array(FS.HEAPU8.buffer, p, len),
				0,
				len,
				pos
			);
			return { ptr: p, allocated: true };
		},
		msync() {
			return 0;
		},
	};

	// backend object
	return { mount: (m: any) => makeNode(1, m, null) };
}

// ───────────────── convenience helper ─────────────────
export type SharedFSBuffers = {
	metaBuf: SharedArrayBuffer;
	dataBuf: SharedArrayBuffer;
};
export const createSharedFSBuffers = (
	metaBytes = 8 << 20,
	dataBytes = 16 << 20
): SharedFSBuffers => ({
	metaBuf: new SharedArrayBuffer(metaBytes),
	dataBuf: new SharedArrayBuffer(dataBytes),
});

export function sharedArrayBufferMount(buffers: SharedFSBuffers) {
	return async function (php: PHP, FS: any, vfsMountPoint: string) {
		const sabfs = SharedArrayBufferFS(FS, buffers.metaBuf, buffers.dataBuf);
		FS.mount(sabfs, {}, '/experimental-sabfs');

		return () => {
			FS!.unmount(vfsMountPoint);
		};
	};
}
