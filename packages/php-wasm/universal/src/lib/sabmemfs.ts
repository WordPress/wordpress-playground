/**
 * SharedArrayBuffer-backed Memory File System (SABMEMFS)
 *
 * A custom Emscripten filesystem backend that stores all file metadata and
 * content in SharedArrayBuffer instances. Because SharedArrayBuffer memory
 * is visible to every worker that holds a reference to the same buffers,
 * multiple PHP-WASM instances can mount the identical filesystem and
 * see each other's reads/writes instantly.
 *
 * Thread safety uses a single global spin-lock mutex backed by
 * Atomics.compareExchange / Atomics.wait / Atomics.notify, plus
 * Atomics.load/store for individual field access.
 *
 * Memory layout
 * =============
 *
 * Two SharedArrayBuffers:
 *
 * 1. **Metadata buffer** (default 16 MiB) — viewed as Int32Array
 *    ┌──────────────────────────── Header (HEADER_WORDS = 256 int32s) ─┐
 *    │  [0] lock word                                                  │
 *    │  [1] magic  0x53414246 ("SABF")                                 │
 *    │  [2] next_inode   — monotonically increasing inode counter      │
 *    │  [3] next_data    — bump pointer into the data buffer (bytes)   │
 *    │  [4..255] reserved / future use                                 │
 *    └─────────────────────────────────────────────────────────────────┘
 *    ┌──────────── Inode table (one inode = INODE_WORDS = 48 int32s) ──┐
 *    │  Per-inode fields — see I_* constants below                     │
 *    │  Name stored inline: 128 bytes = 32 int32s                     │
 *    └─────────────────────────────────────────────────────────────────┘
 *
 * 2. **Data buffer** (default 256 MiB) — viewed as Uint8Array
 *    Linear bump allocator. Once allocated, a region is never freed
 *    (files that grow get a new, larger allocation; the old region is
 *    abandoned). This is acceptable because Playground sessions are
 *    short-lived and the 256 MiB ceiling is generous for a WordPress
 *    install (~60 MiB typical).
 */

// ────────────────────────────── Constants ──────────────────────────────

/** Number of int32 words reserved for the global header. */
const HEADER_WORDS = 256;

/** Number of int32 words per inode. */
const INODE_WORDS = 48;

// Header field offsets (int32 index into the metadata buffer)
const H_LOCK = 0;
const H_MAGIC = 1;
const H_NEXT_INODE = 2;
const H_NEXT_DATA = 3;

const MAGIC = 0x53414246; // "SABF"

// Per-inode field offsets (relative to the start of the inode)
const I_MODE = 0;
const I_UID = 1;
const I_GID = 2;
const I_NLINK = 3;
// Size is stored as a single 32-bit value. For files up to 2 GiB
// this is fine; WordPress installs don't exceed that.
const I_SIZEL = 4;
const I_PARENT = 5;
const I_DATA_OFF = 6; // byte offset into the data buffer
const I_CAP = 7; // allocated capacity in data buffer (bytes)
const I_RDEV = 8;
const I_OPENREFS = 9;
// Name: 128 bytes = 32 int32 words starting at offset 10
const I_NAME = 10;
const I_NAME_WORDS = 32; // 128 bytes

// POSIX mode bits
const S_IFMT = 0o170000;
const S_IFDIR = 0o040000;
const S_IFREG = 0o100000;
const S_IFLNK = 0o120000;

const MODE_DIR = S_IFDIR | 0o777;
const MODE_FILE = S_IFREG | 0o666;
const MODE_SYMLINK = S_IFLNK | 0o777;

const TE = new TextEncoder();
const TD = new TextDecoder();

// Scratch buffer for name comparisons (avoids allocations in lookup).
// 127 bytes is the max name length.
const _nameScratch = new Uint8Array(128);

// ─────────────────────── Exported types / helpers ──────────────────────

export type SABMemFSBuffers = {
	metaBuf: SharedArrayBuffer;
	dataBuf: SharedArrayBuffer;
};

/**
 * Allocate a fresh pair of SharedArrayBuffers for a new SABMEMFS.
 *
 * @param metaBytes Size of the metadata buffer in bytes (default 16 MiB).
 * @param dataBytes Size of the data buffer in bytes (default 256 MiB).
 */
export function createSABMemFSBuffers(
	metaBytes = 16 << 20,
	dataBytes = 256 << 20
): SABMemFSBuffers {
	return {
		metaBuf: new SharedArrayBuffer(metaBytes),
		dataBuf: new SharedArrayBuffer(dataBytes),
	};
}

// ─────────────────────── Core filesystem factory ──────────────────────

/**
 * Create an Emscripten-compatible filesystem type backed by the given
 * SharedArrayBuffer pair. Multiple calls with the **same** buffers
 * produce FS types that share state — that's the whole point.
 *
 * @param FS  The Emscripten FS object (e.g. `Module.FS`).
 * @param buffers  The shared metadata + data buffers.
 */
export function SharedSABFS(FS: any, buffers: SABMemFSBuffers) {
	const { metaBuf, dataBuf } = buffers;
	const meta = new Int32Array(metaBuf);
	const data8 = new Uint8Array(dataBuf);

	// Persistent typed-array view of the metadata buffer for byte-level
	// access (name reads, name writes). Created once and reused.
	const metaU8 = new Uint8Array(metaBuf);

	// ────────────── Lock / unlock (global spin-lock) ──────────────
	// When multiWorker is false (default), locking is a no-op and
	// load/store use plain array access for maximum speed. Call
	// enableMultiWorkerLocking() to switch to Atomics-based
	// synchronization when multiple workers share the buffers.

	let multiWorker = false;

	function lock() {
		if (!multiWorker) return;
		// Fast path: CAS succeeds immediately (single-threaded case).
		if (Atomics.compareExchange(meta, H_LOCK, 0, 1) === 0) return;

		// Slow path: spin with back-off for the multi-worker case.
		let spins = 0;
		do {
			spins++;
			if (spins > 10000) {
				// Force-break to avoid permanent hang.
				Atomics.store(meta, H_LOCK, 0);
			}
			Atomics.wait(meta, H_LOCK, 1, 1);
		} while (Atomics.compareExchange(meta, H_LOCK, 0, 1) !== 0);
	}

	function unlock() {
		if (!multiWorker) return;
		Atomics.store(meta, H_LOCK, 0);
		Atomics.notify(meta, H_LOCK, 1);
	}

	// Load / store helpers. In single-worker mode these are plain
	// array access (no memory barriers). In multi-worker mode they
	// use Atomics for visibility across threads.
	function L(arr: Int32Array, idx: number) {
		return multiWorker ? Atomics.load(arr, idx) : arr[idx];
	}
	function S(arr: Int32Array, idx: number, val: number) {
		if (multiWorker) {
			Atomics.store(arr, idx, val);
		} else {
			arr[idx] = val;
		}
	}

	// ────────────── Init header (idempotent) ──────────────

	// Initialisation only runs once (the first worker to touch the buffer).
	// We use the magic word as a sentinel.
	if (L(meta, H_MAGIC) !== MAGIC) {
		lock();
		try {
			if (L(meta, H_MAGIC) !== MAGIC) {
				// Inode 0 is unused; inode 1 is the root directory.
				S(meta, H_NEXT_INODE, 2);
				S(meta, H_NEXT_DATA, 0);

				// Create root inode (id = 1) at offset HEADER_WORDS
				const rootOff = HEADER_WORDS;
				S(meta, rootOff + I_MODE, MODE_DIR);
				S(meta, rootOff + I_NLINK, 1);
				S(meta, rootOff + I_PARENT, 0); // root's parent is itself (handled in mkNode)
				putName(rootOff, '');

				// Publish the magic last so other workers see a fully
				// initialised header.
				S(meta, H_MAGIC, MAGIC);
			}
		} finally {
			unlock();
		}
	}

	// ────────────── Inode helpers ──────────────

	/** Metadata offset (int32 index) for inode `id`. */
	function ioff(id: number): number {
		return HEADER_WORDS + (id - 1) * INODE_WORDS;
	}

	/** Read the size of the file/directory at metadata offset `off`. */
	function sz(off: number): number {
		return L(meta, off + I_SIZEL);
	}

	function setSize(off: number, size: number) {
		S(meta, off + I_SIZEL, size);
	}

	/** Write a UTF-8 name into the inode's inline name field. */
	function putName(off: number, name: string) {
		const encoded = TE.encode(name);
		if (encoded.length > I_NAME_WORDS * 4 - 1) {
			throw new Error(
				`Filename too long (${encoded.length} bytes, max ${I_NAME_WORDS * 4 - 1})`
			);
		}
		const nameByteOffset = (off + I_NAME) * 4;
		metaU8.fill(0, nameByteOffset, nameByteOffset + I_NAME_WORDS * 4);
		metaU8.set(encoded, nameByteOffset);
	}

	/** Read the UTF-8 name from the inode's inline name field. */
	function getName(off: number): string {
		const nameByteOffset = (off + I_NAME) * 4;
		let end = nameByteOffset;
		const limit = nameByteOffset + I_NAME_WORDS * 4;
		while (end < limit && metaU8[end] !== 0) {
			end++;
		}
		// TextDecoder rejects SharedArrayBuffer-backed views, so we
		// must copy the bytes into a regular ArrayBuffer first.
		// Use the module-level scratch buffer for short names.
		const len = end - nameByteOffset;
		if (len <= _nameScratch.length) {
			for (let i = 0; i < len; i++) {
				_nameScratch[i] = metaU8[nameByteOffset + i];
			}
			return TD.decode(_nameScratch.subarray(0, len));
		}
		const copy = new Uint8Array(len);
		for (let i = 0; i < len; i++) {
			copy[i] = metaU8[nameByteOffset + i];
		}
		return TD.decode(copy);
	}

	/**
	 * Compare the inode's inline name against a pre-encoded needle
	 * without decoding to a string. Returns true on match.
	 */
	function nameEquals(off: number, needle: Uint8Array): boolean {
		const base = (off + I_NAME) * 4;
		for (let j = 0; j < needle.length; j++) {
			if (metaU8[base + j] !== needle[j]) return false;
		}
		// Ensure null terminator follows (exact match, not prefix)
		return metaU8[base + needle.length] === 0;
	}

	// ────────────── Data buffer allocator ──────────────

	/**
	 * Bump-allocate `bytes` in the data buffer. Must be called while
	 * holding the lock.
	 */
	function allocData(bytes: number): number {
		// Round up the current pointer to a 4-byte boundary so that
		// Int32Array views (used for directory child vectors) are
		// always aligned.
		const cur = (L(meta, H_NEXT_DATA) + 3) & ~3;
		const next = cur + bytes;
		if (next > dataBuf.byteLength) {
			throw new FS.ErrnoError(51); // ENOSPC
		}
		S(meta, H_NEXT_DATA, next);
		return cur;
	}

	// ────────────── Directory child vector helpers ──────────────

	// Directory "contents" is an array of child inode IDs stored in the
	// data buffer as consecutive int32 values. I_DATA_OFF points to the
	// byte offset, I_SIZEL stores the child count, I_CAP stores the
	// allocated capacity (in number of children).

	/** Get the data-buffer Int32Array view for a directory's children. */
	function dVec(off: number): Int32Array {
		const start = L(meta, off + I_DATA_OFF);
		const cnt = L(meta, off + I_SIZEL);
		if (cnt === 0 || start < 0) return new Int32Array(0);
		return new Int32Array(dataBuf, start, cnt);
	}

	/** Number of *active* children (skip tombstones where id <= 0). */
	function dCount(off: number): number {
		const vec = dVec(off);
		let n = 0;
		for (let i = 0; i < vec.length; i++) {
			if (vec[i] > 0) n++;
		}
		return n;
	}

	/** Add child `childId` to directory at metadata offset `dirOff`. Must hold lock. */
	function pushChild(dirOff: number, childId: number) {
		let cnt = L(meta, dirOff + I_SIZEL);
		let cap = L(meta, dirOff + I_CAP);
		let start = L(meta, dirOff + I_DATA_OFF);

		if (cnt >= cap) {
			// Grow: allocate a new vector
			const newCap = Math.max(cap ? cap * 2 : 8, cnt + 1);
			const newStart = allocData(newCap * 4);
			// Copy old entries
			if (cnt > 0 && start >= 0) {
				const src = new Int32Array(dataBuf, start, cnt);
				const dst = new Int32Array(dataBuf, newStart, newCap);
				dst.set(src);
			}
			start = newStart;
			cap = newCap;
			S(meta, dirOff + I_DATA_OFF, start);
			S(meta, dirOff + I_CAP, cap);
		}

		// Append
		const arr = new Int32Array(dataBuf);
		const slot = (start >> 2) + cnt;
		if (multiWorker) {
			Atomics.store(arr, slot, childId);
		} else {
			arr[slot] = childId;
		}
		S(meta, dirOff + I_SIZEL, cnt + 1);
	}

	/** Remove `childId` from directory at metadata offset `dirOff`. Must hold lock. */
	function removeChild(dirOff: number, childId: number) {
		const cnt = L(meta, dirOff + I_SIZEL);
		const start = L(meta, dirOff + I_DATA_OFF);
		if (cnt <= 0 || start < 0) return;
		const arr = new Int32Array(dataBuf);
		const base = start >> 2;
		for (let i = 0; i < cnt; i++) {
			const val = multiWorker ? Atomics.load(arr, base + i) : arr[base + i];
			if (val === childId) {
				// Swap with last entry and shrink
				const lastIdx = cnt - 1;
				if (i !== lastIdx) {
					const last = multiWorker ? Atomics.load(arr, base + lastIdx) : arr[base + lastIdx];
					if (multiWorker) {
						Atomics.store(arr, base + i, last);
					} else {
						arr[base + i] = last;
					}
				}
				S(meta, dirOff + I_SIZEL, cnt - 1);
				return;
			}
		}
	}

	// ────────────── Inode creation ──────────────

	/**
	 * Allocate a new inode. Must be called while holding the lock (or the
	 * caller must acquire it).
	 */
	function newInode(
		parentId: number,
		mode: number,
		name: string,
		rdev = 0,
		alreadyLocked = false
	): number {
		if (!alreadyLocked) lock();
		try {
			const id = L(meta, H_NEXT_INODE);
			S(meta, H_NEXT_INODE, id + 1);

			const off = ioff(id);
			// Bounds check
			if (off + INODE_WORDS > meta.length) {
				throw new FS.ErrnoError(51); // ENOSPC
			}

			S(meta, off + I_MODE, mode);
			S(meta, off + I_UID, 0);
			S(meta, off + I_GID, 0);
			S(meta, off + I_NLINK, 1);
			S(meta, off + I_SIZEL, 0);
			S(meta, off + I_PARENT, parentId);
			S(meta, off + I_DATA_OFF, -1);
			S(meta, off + I_CAP, 0);
			S(meta, off + I_RDEV, rdev);
			S(meta, off + I_OPENREFS, 0);
			putName(off, name);

			// Add to parent directory
			if (parentId > 0) {
				pushChild(ioff(parentId), id);
			}

			return id;
		} finally {
			if (!alreadyLocked) unlock();
		}
	}

	// ────────────── Data read / write ──────────────

	function readBytes(
		id: number,
		pos: number,
		len: number,
		dst: Uint8Array
	): number {
		const off = ioff(id);
		const size = sz(off);
		if (pos >= size) return 0;
		const avail = Math.min(len, size - pos);
		const start = L(meta, off + I_DATA_OFF);
		if (start < 0 || avail <= 0) return 0;
		dst.set(data8.subarray(start + pos, start + pos + avail));
		return avail;
	}

	function writeBytes(id: number, pos: number, src: Uint8Array) {
		const off = ioff(id);

		lock();
		try {
			if (L(meta, off + I_MODE) === 0) {
				throw new FS.ErrnoError(8); // EBADF
			}

			let cap = L(meta, off + I_CAP);
			let start = L(meta, off + I_DATA_OFF);
			const end = pos + src.length;
			const size = sz(off);

			if (end > cap || start < 0) {
				// Need to (re)allocate
				const ncap = Math.max(
					end,
					cap ? (cap < 1 << 20 ? cap * 2 : (cap * 9) >> 3) : 256
				);
				const nOff = allocData(ncap);
				// Copy old data if any
				if (size > 0 && start >= 0) {
					data8.set(data8.slice(start, start + size), nOff);
				}
				start = nOff;
				cap = ncap;
				S(meta, off + I_DATA_OFF, start);
				S(meta, off + I_CAP, cap);
			}

			// Zero-fill gap if writing past current end
			if (pos > size) {
				data8.fill(0, start + size, start + pos);
			}

			data8.set(src, start + pos);

			if (end > size) {
				setSize(off, end);
			}
		} finally {
			unlock();
		}
	}

	// ────────────── Emscripten FS node constructor ──────────────

	// Cache FS nodes by inode ID so that repeated lookups return the
	// same object. Without this cache, every lookup creates a new FS
	// node via FS.createNode which adds it to Emscripten's internal
	// name-hash table. When FS.unlink later calls FS.destroyNode it
	// only removes one of these duplicate entries, leaving stale
	// nodes that make the file appear to still exist.
	const nodeCache = new Map<number, any>();

	function mkNode(id: number, mount: any, parent: any) {
		const cached = nodeCache.get(id);
		if (cached) return cached;

		const off = ioff(id);
		const mode = L(meta, off + I_MODE);
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
		nodeCache.set(id, node);
		return node;
	}

	// ────────────── node_ops ──────────────

	const node_ops: any = {
		getattr(n: any) {
			const o = ioff(n.sabId);
			const mode = L(meta, o + I_MODE);
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
				blksize: 4096,
				blocks: Math.ceil(
					(mode & S_IFDIR ? 4096 : sz(o)) / 512
				),
			};
		},

		setattr(n: any, a: any) {
			const o = ioff(n.sabId);
			lock();
			try {
				if (a.mode !== undefined) {
					S(
						meta,
						o + I_MODE,
						(L(meta, o + I_MODE) & S_IFMT) | (a.mode & 0o7777)
					);
				}
				if (a.size !== undefined) {
					const cur = sz(o);
					if (a.size < cur) {
						// Truncate: just reduce the size field. The
						// allocated capacity stays the same (bump allocator).
						setSize(o, a.size);
					} else if (a.size > cur) {
						// Extend with zeros — writeBytes handles gap-fill.
						// We need to release the lock first since writeBytes acquires it.
						unlock();
						try {
							writeBytes(
								n.sabId,
								cur,
								new Uint8Array(a.size - cur)
							);
						} finally {
							lock();
						}
					}
				}
			} finally {
				unlock();
			}
		},

		lookup(p: any, name: string) {
			const poff = ioff(p.sabId);
			const cnt = L(meta, poff + I_SIZEL);
			const start = L(meta, poff + I_DATA_OFF);

			if (cnt > 0 && start >= 0) {
				// Encode the search name once. Use the module-level
				// scratch buffer for short names to avoid allocation.
				const enc = TE.encodeInto(name, _nameScratch);
				const needle =
					enc.read === name.length
						? _nameScratch.subarray(0, enc.written!)
						: TE.encode(name);

				const baseArr = new Int32Array(dataBuf);
				const base = start >> 2;
				for (let i = 0; i < cnt; i++) {
					const id = multiWorker ? Atomics.load(baseArr, base + i) : baseArr[base + i];
					if (id <= 0) continue;
					const childOff = ioff(id);
					if (
						L(meta, childOff + I_MODE) === 0 ||
						L(meta, childOff + I_NLINK) === 0
					)
						continue;
					if (nameEquals(childOff, needle)) {
						return mkNode(id, p.mount, p);
					}
				}
			}

			throw new FS.ErrnoError(44); // ENOENT
		},

		mknod(
			p: any,
			n: string,
			m: number,
			d: number,
			alreadyLocked = false
		) {
			const id = newInode(p.sabId, m, n, d, alreadyLocked);
			return mkNode(id, p.mount, p);
		},

		rename(o: any, nd: any, nn: string) {
			lock();
			try {
				removeChild(ioff(L(meta, ioff(o.sabId) + I_PARENT)), o.sabId);
				S(meta, ioff(o.sabId) + I_PARENT, nd.sabId);
				putName(ioff(o.sabId), nn);
				pushChild(ioff(nd.sabId), o.sabId);
			} finally {
				unlock();
			}
		},

		unlink(p: any, nm: string) {
			let c;
			try {
				c = node_ops.lookup(p, nm);
			} catch (e: any) {
				if (e.errno === 44) return; // ENOENT — already gone
				throw e;
			}
			const off = ioff(c.sabId);
			lock();
			try {
				removeChild(ioff(p.sabId), c.sabId);
				S(meta, off + I_NLINK, 0);

				// Deferred deletion: if no open references, delete now.
				// Otherwise the file stays accessible until the last fd
				// is closed (correct POSIX unlink semantics).
				const openRefs = L(meta, off + I_OPENREFS);
				if (openRefs === 0) {
					S(meta, off + I_MODE, 0);
				}
				nodeCache.delete(c.sabId);
			} finally {
				unlock();
			}
		},

		rmdir(p: any, nm: string) {
			const c = node_ops.lookup(p, nm);
			if (dCount(ioff(c.sabId)) > 0) {
				throw new FS.ErrnoError(55); // ENOTEMPTY
			}
			lock();
			try {
				removeChild(ioff(p.sabId), c.sabId);
				const off = ioff(c.sabId);
				S(meta, off + I_NLINK, 0);
				if (L(meta, off + I_OPENREFS) === 0) {
					S(meta, off + I_MODE, 0);
				}
				nodeCache.delete(c.sabId);
			} finally {
				unlock();
			}
		},

		readdir(n: any) {
			const out = ['.', '..'];
			const off = ioff(n.sabId);
			const cnt = L(meta, off + I_SIZEL);
			const start = L(meta, off + I_DATA_OFF);
			if (cnt > 0 && start >= 0) {
				const baseArr = new Int32Array(dataBuf);
				const base = start >> 2;
				for (let i = 0; i < cnt; i++) {
					const id = multiWorker ? Atomics.load(baseArr, base + i) : baseArr[base + i];
					if (id > 0 && L(meta, ioff(id) + I_MODE) !== 0) {
						out.push(getName(ioff(id)));
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
			const dataOffset = L(meta, off + I_DATA_OFF);
			if (dataOffset < 0 || len === 0) return '';
			return TD.decode(data8.slice(dataOffset, dataOffset + len));
		},

		chmod(n: any, mode: number) {
			node_ops.setattr(n, { mode });
		},

		chown() {
			// no-op: we don't track ownership changes
		},
	};

	// ────────────── stream_ops ──────────────

	const stream_ops: any = {
		open(s: any) {
			const id = s.node.sabId;
			const off = ioff(id);

			if (L(meta, off + I_MODE) === 0) {
				throw new FS.ErrnoError(8); // EBADF
			}

			lock();
			try {
				if (L(meta, off + I_MODE) === 0) {
					throw new FS.ErrnoError(8); // EBADF
				}

				// Handle O_TRUNC
				if (s.flags & 0x200 && FS.isFile(s.node.mode)) {
					setSize(off, 0);
				}

				s.position = s.flags & 0x400 ? sz(off) : 0; // O_APPEND

				// Increment open reference count
				if (multiWorker) {
					Atomics.add(meta, off + I_OPENREFS, 1);
				} else {
					meta[off + I_OPENREFS]++;
				}
			} finally {
				unlock();
			}
		},

		close(s: any) {
			lock();
			try {
				const off = ioff(s.node.sabId);
				if (L(meta, off + I_MODE) === 0) return;

				let openRefs: number;
				if (multiWorker) {
					openRefs = Atomics.sub(meta, off + I_OPENREFS, 1);
				} else {
					openRefs = meta[off + I_OPENREFS];
					meta[off + I_OPENREFS] = openRefs - 1;
				}
				const newRefs = openRefs - 1;
				const nlink = L(meta, off + I_NLINK);

				// If unlinked and last reference closed, fully delete
				if (newRefs === 0 && nlink === 0) {
					S(meta, off + I_MODE, 0);
				}
			} finally {
				unlock();
			}
		},

		read(
			s: any,
			buf: Uint8Array,
			off: number,
			len: number,
			pos: number
		) {
			const p = pos ?? s.position;
			// Read directly into the destination buffer to avoid a
			// temporary allocation + double copy.
			const dst = off === 0 && buf.length === len
				? buf
				: buf.subarray(off, off + len);
			const r = readBytes(s.node.sabId, p, len, dst);
			if (pos === undefined) s.position += r;
			return r;
		},

		write(
			s: any,
			buf: Uint8Array,
			off: number,
			len: number,
			pos: number
		) {
			const p = pos ?? s.position;
			writeBytes(s.node.sabId, p, buf.subarray(off, off + len));
			if (pos === undefined) s.position += len;
			return len;
		},

		llseek(s: any, ofs: number, wh: number) {
			const size = sz(ioff(s.node.sabId));
			let p: number;
			if (wh === 0) {
				p = ofs; // SEEK_SET
			} else if (wh === 1) {
				p = s.position + ofs; // SEEK_CUR
			} else if (wh === 2) {
				p = size + ofs; // SEEK_END
			} else {
				throw new FS.ErrnoError(28); // EINVAL
			}
			if (p < 0) throw new FS.ErrnoError(28); // EINVAL
			s.position = p;
			return p;
		},

		/**
		 * mmap: allocate memory on the Emscripten heap and copy the file
		 * content into it. This is required for SQLite WAL mode and any
		 * library that calls mmap (e.g. ICU loading data files).
		 */
		mmap(
			stream: any,
			length: number,
			position: number,
			prot: number,
			_flags: number
		) {
			if (!FS.isFile(stream.node.mode)) {
				throw new FS.ErrnoError(43); // ENODEV
			}

			// We need the Emscripten runtime to allocate heap memory.
			// FS.createNode is patched by Emscripten and the mount
			// object carries a reference to the Emscripten module.
			const runtime = stream.node.mount.opts.__runtime;
			if (!runtime || !runtime._malloc) {
				throw new FS.ErrnoError(28); // EINVAL — no runtime available
			}

			const ptr = runtime._malloc(length);
			if (!ptr) {
				throw new FS.ErrnoError(48); // ENOMEM
			}

			const heap = runtime.HEAPU8.subarray(ptr, ptr + length);
			const r = readBytes(stream.node.sabId, position, length, heap);
			// Zero-fill any remaining bytes beyond EOF
			if (r < length) {
				heap.fill(0, r, length);
			}

			return { ptr, allocated: true };
		},

		/**
		 * allocate: extend the file to cover [offset, offset+length).
		 * Used by posix_fallocate / fallocate.
		 */
		allocate(stream: any, offset: number, length: number) {
			const off = ioff(stream.node.sabId);
			const curSize = sz(off);
			const needed = offset + length;
			if (needed > curSize) {
				writeBytes(
					stream.node.sabId,
					curSize,
					new Uint8Array(needed - curSize)
				);
			}
		},

		/**
		 * msync: write memory-mapped changes back to the file.
		 */
		msync(
			stream: any,
			buffer: Uint8Array,
			offset: number,
			length: number,
			mmapFlags: number
		) {
			// MAP_PRIVATE (flag bit 2) means changes stay in memory only
			if (!(mmapFlags & 2)) {
				writeBytes(
					stream.node.sabId,
					offset,
					buffer.subarray(offset, offset + length)
				);
			}
			return 0;
		},

		flush() {
			return 0;
		},

		ioctl() {
			throw new FS.ErrnoError(59); // ENOTTY
		},

		/**
		 * fsync — a no-op since all writes go directly to the
		 * SharedArrayBuffer (which is always "flushed").
		 */
		fsync() {
			return 0;
		},
	};

	// ────────────── Return the Emscripten FileSystemType ──────────────

	return {
		mount(m: any) {
			return mkNode(1, m, null);
		},
		syncfs(
			_mount: any,
			_populate: boolean,
			callback: (err: any) => void
		) {
			// No-op — everything is already in shared memory.
			// We must call the callback so that Emscripten's
			// _fd_sync (which wraps this in Asyncify.handleSleep)
			// can call wakeUp() and resolve the JSPI Promise.
			callback(null);
		},
	};
}
