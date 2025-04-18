// SharedSABFS — SharedArrayBuffer‑backed MEMFS replacement
// Complete, self‑contained and debug‑instrumented.  Plug‑and‑play:
//   import { createBuffers, SharedSABFS } from './shared-sabfs.ts';
//   const { metaBuf, dataBuf } = createBuffers();
//   FS.mount(SharedSABFS(FS, metaBuf, dataBuf), {}, '/');
//   worker.postMessage({ metaBuf, dataBuf }, [metaBuf, dataBuf]);

/* Enable or disable verbose console output */
const DEBUG = false;
const log = (...a: any[]) => DEBUG && console.log('[SABFS]', ...a);

/* ─── POSIX mode and type bits ───────────────────────────────────────────── */
const S_IFMT = 0o170000,
	// S_IFCHR = 0o020000, // Character device - unused for now
	S_IFDIR = 0o040000,
	// S_IFREG = 0o100000, // Regular file type - unused for now
	S_IFLNK = 0o120000;
const MODE_DIR = S_IFDIR | 0o777,
	// MODE_FILE = S_IFREG | 0o666, // Regular file mode - unused for now
	MODE_SYMLINK = S_IFLNK | 0o777;

/* ─── shared‑memory layout ───────────────────────────────────────────────── */
const IDX_LOCK = 0, // global mutex (int32)
	IDX_MAGIC = 1, // magic word "SAFS"
	IDX_NEXT_INODE = 2, // next inode id
	IDX_NEXT_DATA = 3; // next free byte in data buffer
const HEADER_WORDS = 256; // leave ample header space (1kB)

// inode fields (Int32 offsets relative to inode start)
const I_MODE = 0,
	I_UID = 1,
	I_GID = 2,
	I_NLINK = 3,
	I_SIZEL = 4,
	I_SIZEH = 5,
	I_PARENT = 6,
	I_DATA_OFF = 7,
	I_CAP = 8,
	I_RDEV = 9,
	I_ATIME_L = 10,
	I_ATIME_H = 11,
	I_MTIME_L = 12,
	I_MTIME_H = 13,
	I_CTIME_L = 14,
	I_CTIME_H = 15,
	I_NAME = 16; // 16..47 (128 bytes) for UTF-8 name
const INODE_WORDS = 16 + 32; // 192 bytes per inode
const NAME_BYTES = 128;
const MAGIC = 0x53414653; // "SAFS"

const TD = new TextDecoder();
const TE = new TextEncoder();
const now64 = () => BigInt(Date.now());

/* ─── exported factory ───────────────────────────────────────────────────── */
export function SharedSABFS(
	FS: any,
	metaBuf: SharedArrayBuffer,
	dataBuf: SharedArrayBuffer,
	maxInodes = 4096
) {
	/* typed views on metadata buffer */
	const meta = new Int32Array(metaBuf);
	const meta8 = new Uint8Array(metaBuf);
	const data8 = new Uint8Array(dataBuf);

	/* atomics helpers (short names) */
	const L = Atomics.load,
		S = Atomics.store;

	/* mutex helpers */
	const lock = () => {
		while (Atomics.compareExchange(meta, IDX_LOCK, 0, 1) !== 0)
			Atomics.wait(meta, IDX_LOCK, 1);
	};
	const unlock = () => {
		S(meta, IDX_LOCK, 0);
		Atomics.notify(meta, IDX_LOCK, 1);
	};

	/* inode helpers */
	const ioff = (id: number) => HEADER_WORDS + (id - 1) * INODE_WORDS;
	const sz = (off: number) =>
		L(meta, off + I_SIZEL) + L(meta, off + I_SIZEH) * 0x100000000;
	const setSize = (off: number, bytes: number) => {
		S(meta, off + I_SIZEL, bytes >>> 0);
		S(meta, off + I_SIZEH, (bytes / 0x100000000) >>> 0);
	};
	const setTimes = (off: number, a = false, m = false, c = false) => {
		const t = now64();
		const lo = Number(t & 0xffffffffn),
			hi = Number(t >> 32n);
		if (a) {
			S(meta, off + I_ATIME_L, lo);
			S(meta, off + I_ATIME_H, hi);
		}
		if (m) {
			S(meta, off + I_MTIME_L, lo);
			S(meta, off + I_MTIME_H, hi);
		}
		if (c) {
			S(meta, off + I_CTIME_L, lo);
			S(meta, off + I_CTIME_H, hi);
		}
	};
	const putName = (off: number, name: string) => {
		const enc = TE.encode(name);
		if (enc.length >= NAME_BYTES) throw new FS.ErrnoError(63);
		meta8.fill(0, (off + I_NAME) * 4, (off + I_NAME) * 4 + NAME_BYTES);
		meta8.set(enc, (off + I_NAME) * 4);
	};
	const getName = (off: number) => {
		const slice = meta8.subarray(
			(off + I_NAME) * 4,
			(off + I_NAME) * 4 + NAME_BYTES
		);
		const end = slice.indexOf(0);
		return TD.decode(
			new Uint8Array(slice.slice(0, end < 0 ? NAME_BYTES : end))
		);
	};

	/* root init (only once) */
	if (L(meta, IDX_MAGIC) !== MAGIC) {
		lock();
		if (L(meta, IDX_MAGIC) !== MAGIC) {
			S(meta, IDX_MAGIC, MAGIC);
			S(meta, IDX_NEXT_INODE, 2);
			S(meta, IDX_NEXT_DATA, 0);
			const off = ioff(1);
			S(meta, off + I_MODE, MODE_DIR);
			S(meta, off + I_PARENT, 1);
			S(meta, off + I_NLINK, 1);
			setSize(off, 0);
			putName(off, '/');
			setTimes(off, true, true, true);
			log('root initialized');
		}
		unlock();
	}

	/* directory helpers */
	const dCount = (off: number) => L(meta, off + I_SIZEL);
	const dVec = (off: number) =>
		new Int32Array(dataBuf, L(meta, off + I_DATA_OFF), dCount(off));
	const pushChild = (off: number, id: number) => {
		let cnt = dCount(off);
		let cap = L(meta, off + I_CAP);
		let start = L(meta, off + I_DATA_OFF);
		if (cnt >= cap) {
			const ncap = Math.max(4, cap ? cap * 2 : 4);
			const nOff = allocData(ncap * 4);
			const m32 = new Int32Array(dataBuf); // Get view on the whole data buffer
			if (cnt) {
				// Copy old ids from old location (start) to new location (nOff)
				m32.set(
					m32.subarray(start >> 2, (start >> 2) + cnt),
					nOff >> 2
				);
			}
			// Update start and cap to new values *before* using them
			start = nOff;
			cap = ncap;
			S(meta, off + I_DATA_OFF, start);
			S(meta, off + I_CAP, cap);
			// Store new id at the correct offset in the *new* buffer location
			Atomics.store(m32, (start >> 2) + cnt, id);
		} else {
			// If not reallocating, just store the new id at the end
			const vec = new Int32Array(dataBuf, start, cap);
			Atomics.store(vec, cnt, id);
		}
		S(meta, off + I_SIZEL, cnt + 1); // Increment count
		Atomics.notify(meta, (off + I_SIZEL) >> 2, 1); // Use meta index, not offset
		log('dir+', (off - HEADER_WORDS) / INODE_WORDS + 1, 'add', id);
	};
	const removeChild = (off: number, id: number) => {
		const cnt = dCount(off),
			vec = dVec(off);
		for (let i = 0; i < cnt; i++)
			if (Atomics.load(vec, i) === id) {
				Atomics.store(vec, i, Atomics.load(vec, cnt - 1));
				S(meta, off + I_SIZEL, cnt - 1);
				Atomics.notify(meta, (off + I_SIZEL) >> 2, 1);
				log('dir-', (off - HEADER_WORDS) / INODE_WORDS + 1, 'del', id);
				return;
			}
		throw new FS.ErrnoError(44);
	};

	/* data allocation */
	const allocData = (bytes: number) => {
		const off = Atomics.add(meta, IDX_NEXT_DATA, bytes);
		if (off + bytes > data8.length) throw new FS.ErrnoError(28);
		return off;
	};

	/* inode allocation */
	const newInode = (parent: number, mode: number, name: string, rdev = 0) => {
		lock();
		const id = Atomics.add(meta, IDX_NEXT_INODE, 1);
		if (id > maxInodes) {
			unlock();
			throw new FS.ErrnoError(28);
		}
		const off = ioff(id);
		meta.fill(0, off, off + INODE_WORDS);
		S(meta, off + I_MODE, mode);
		S(meta, off + I_PARENT, parent);
		S(meta, off + I_NLINK, 1);
		S(meta, off + I_RDEV, rdev);
		setSize(off, 0);
		putName(off, name);
		setTimes(off, true, true, true);
		if ((mode & S_IFMT) === S_IFDIR) S(meta, off + I_CAP, 0);
		pushChild(ioff(parent), id);
		setTimes(ioff(parent), false, true, true);
		unlock();
		log('inode', id, '"' + name + '"');
		return id;
	};

	/* raw data read/write */
	const readBytes = (
		id: number,
		pos: number,
		len: number,
		out: Uint8Array
	) => {
		const off = ioff(id),
			size = sz(off);
		if (pos >= size) return 0;
		const to = Math.min(len, size - pos),
			src = L(meta, off + I_DATA_OFF) + pos;
		out.set(data8.subarray(src, src + to));
		setTimes(off, true, false, false);
		return to;
	};
	const writeBytes = (id: number, pos: number, src: Uint8Array) => {
		const off = ioff(id);
		let cap = L(meta, off + I_CAP),
			start = L(meta, off + I_DATA_OFF);
		const end = pos + src.length,
			size = sz(off);
		lock();
		if (end > cap) {
			const ncap = Math.max(
				end,
				cap ? (cap < 1 << 20 ? cap * 2 : (cap * 9) >> 3) : 256
			);
			const nOff = allocData(ncap);
			if (size) data8.copyWithin(nOff, start, start + size);
			start = nOff;
			cap = ncap;
			S(meta, off + I_DATA_OFF, start);
			S(meta, off + I_CAP, cap);
		}
		if (pos > size) data8.fill(0, start + size, start + pos);
		data8.set(src, start + pos);
		if (end > size) setSize(off, end);
		setTimes(off, false, true, true);
		unlock();
	};

	/* JS node constructor */
	const mkNode = (id: number, mount: any, parent: any) => {
		const off = ioff(id),
			mode = L(meta, off + I_MODE);
		const node = FS.createNode(
			parent,
			getName(off),
			mode,
			L(meta, off + I_RDEV)
		);
		node.sabId = id;
		node.node_ops = node_ops;
		node.stream_ops = FS.isChrdev(mode)
			? FS.getDevice(node.rdev).stream_ops
			: stream_ops;
		return node;
	};

	/* node_ops with robust lookup (retry + wait) */
	const node_ops: any = {
		getattr(n: any) {
			const o = ioff(n.sabId),
				mode = L(meta, o + I_MODE);
			return {
				dev: 1,
				ino: n.sabId,
				mode,
				nlink: L(meta, o + I_NLINK),
				uid: L(meta, o + I_UID),
				gid: L(meta, o + I_GID),
				rdev: L(meta, o + I_RDEV),
				size: mode & S_IFDIR ? 4096 : sz(o),
				atime: new Date(),
				mtime: new Date(),
				ctime: new Date(),
			};
		},
		setattr(n: any, a: any) {
			const o = ioff(n.sabId);
			lock();
			if (a.mode !== undefined)
				S(
					meta,
					o + I_MODE,
					(L(meta, o + I_MODE) & S_IFMT) | (a.mode & 0o777)
				);
			if (a.size !== undefined) {
				const cur = sz(o);
				if (a.size < cur) setSize(o, a.size);
				else if (a.size > cur)
					writeBytes(n.sabId, cur, new Uint8Array(a.size - cur));
			}
			setTimes(o, false, false, true);
			unlock();
		},
		lookup(p: any, name: string) {
			const poff = ioff(p.sabId);
			const parentId = p.sabId;
			const cnt = L(meta, poff + I_SIZEL);
			const start = L(meta, poff + I_DATA_OFF);
			log(
				`lookup("${name}") dir ${parentId} cnt=${cnt} dataStart=${start}`
			);
			if (cnt > 0 && start >= 0) {
				const baseArr = new Int32Array(dataBuf);
				for (let i = 0; i < cnt; i++) {
					const id = L(baseArr, (start >> 2) + i);
					// Basic sanity check for valid inode ID
					if (id <= 0) {
						log(
							`  lookup dir ${parentId}: invalid child ID ${id} at index ${i}`
						);
						continue;
					}
					const childOff = ioff(id);
					// Check if mode is non-zero (inode potentially active)
					if (L(meta, childOff + I_MODE) === 0) {
						log(
							`  lookup dir ${parentId}: child ID ${id} at index ${i} has mode 0 (deleted?)`
						);
						continue;
					}
					const childName = getName(childOff);
					log(
						`  lookup dir ${parentId}: checking child ${i} id=${id} name="${childName}"`
					);
					if (childName === name) {
						log(
							`  lookup dir ${parentId}: found "${name}" as id ${id}`
						);
						return mkNode(id, p.mount, p);
					}
				}
			}
			log(`lookup failed for "${name}" in dir ${parentId}`);
			throw new FS.ErrnoError(44); // ENOENT
		},
		mknod(p: any, n: string, m: number, d: number) {
			return mkNode(newInode(p.sabId, m, n, d), p.mount, p);
		},
		rename(o: any, nd: any, nn: string) {
			lock();
			removeChild(ioff(L(meta, ioff(o.sabId) + I_PARENT)), o.sabId);
			S(meta, ioff(o.sabId) + I_PARENT, nd.sabId);
			putName(ioff(o.sabId), nn);
			pushChild(ioff(nd.sabId), o.sabId);
			unlock();
		},
		unlink(p: any, nm: string) {
			const c = node_ops.lookup(p, nm);
			lock();
			removeChild(ioff(p.sabId), c.sabId);
			S(meta, ioff(c.sabId) + I_MODE, 0);
			unlock();
		},
		rmdir(p: any, nm: string) {
			const c = node_ops.lookup(p, nm);
			if (dCount(ioff(c.sabId)) > 0) throw new FS.ErrnoError(55);
			lock();
			removeChild(ioff(p.sabId), c.sabId);
			S(meta, ioff(c.sabId) + I_MODE, 0);
			unlock();
		},
		readdir(n: any) {
			const out = ['.', '..'];
			const parentId = n.sabId;
			const off = ioff(parentId);
			const cnt = dCount(off);
			const start = L(meta, off + I_DATA_OFF);
			log(`readdir dir ${parentId} cnt=${cnt} dataStart=${start}`);
			if (cnt > 0 && start >= 0) {
				const vec = dVec(off); // Uses dCount internally
				for (let i = 0; i < vec.length; i++) {
					const id = vec[i]; // Use view directly
					log(`  readdir dir ${parentId}: index ${i} id=${id}`);
					if (id > 0 && L(meta, ioff(id) + I_MODE) !== 0) {
						out.push(getName(ioff(id)));
					} else {
						log(
							`  readdir dir ${parentId}: skipping invalid id ${id} at index ${i}`
						);
					}
				}
			}
			return out;
		},
		symlink(p: any, nm: string, tgt: string) {
			const id = newInode(p.sabId, MODE_SYMLINK, nm);
			writeBytes(id, 0, TE.encode(tgt));
			return mkNode(id, p.mount, p);
		},
		readlink(n: any) {
			const off = ioff(n.sabId);
			const len = sz(off);
			return TD.decode(
				data8.slice(
					L(meta, off + I_DATA_OFF),
					L(meta, off + I_DATA_OFF) + len
				)
			);
		},
		chmod(n: any, mode: number) {
			node_ops.setattr(n, { mode });
		},
		chown() {},
	};

	/* stream_ops */
	const stream_ops: any = {
		open(s: any) {
			if (s.flags & 0x400 && FS.isFile(s.node.mode))
				node_ops.setattr(s.node, { size: 0 });
			s.position = s.flags & 0x800 ? sz(ioff(s.node.sabId)) : 0;
		},
		close() {},
		read(s: any, buf: Uint8Array, off: number, len: number, pos: number) {
			const p = pos ?? s.position,
				tmp = new Uint8Array(len);
			const r = readBytes(s.node.sabId, p, len, tmp);
			buf.set(tmp.subarray(0, r), off);
			if (pos === undefined) s.position += r;
			return r;
		},
		write(s: any, buf: Uint8Array, off: number, len: number, pos: number) {
			const p = pos ?? s.position;
			writeBytes(s.node.sabId, p, buf.subarray(off, off + len));
			if (pos === undefined) s.position += len;
			return len;
		},
		llseek(s: any, ofs: number, wh: number) {
			const size = sz(ioff(s.node.sabId)); // Cache size
			let p: number;
			if (wh === 0) {
				// SEEK_SET
				p = ofs;
			} else if (wh === 1) {
				// SEEK_CUR
				p = s.position + ofs;
			} else if (wh === 2) {
				// SEEK_END
				p = size + ofs;
			} else {
				throw new FS.ErrnoError(28); // EINVAL
			}

			if (p < 0) throw new FS.ErrnoError(28); // EINVAL
			s.position = p;
			return p;
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
	};

	/* backend object for FS.mount */
	return { mount: (m: any) => mkNode(1, m, null) };
}

/* ─── helper to allocate buffers ─────────────────────────────────────────── */
export const createBuffers = (metaBytes = 4 << 20, dataBytes = 8 << 20) => ({
	metaBuf: new SharedArrayBuffer(metaBytes),
	dataBuf: new SharedArrayBuffer(dataBytes),
});
