// SharedSABFS — SharedArrayBuffer‑backed MEMFS replacement
// Complete, self‑contained and debug‑instrumented.  Plug‑and‑play:
//   import { createBuffers, SharedSABFS } from './shared-sabfs.ts';
//   const { metaBuf, dataBuf } = createBuffers();
//   FS.mount(SharedSABFS(FS, metaBuf, dataBuf), {}, '/');
//   worker.postMessage({ metaBuf, dataBuf }, [metaBuf, dataBuf]);

/* Enable or disable verbose console output */
const DEBUG = true;
const log = (...a: any[]) => DEBUG && console.log('[SABFS]', ...a);

/* ─── POSIX mode and type bits ───────────────────────────────────────────── */
const S_IFMT = 0o170000,
	// S_IFCHR = 0o020000, // Character device - unused for now
	S_IFDIR = 0o040000,
	S_IFLNK = 0o120000;
const MODE_DIR = S_IFDIR | 0o777,
	MODE_SYMLINK = S_IFLNK | 0o777;

/* ─── shared‑memory layout ───────────────────────────────────────────────── */
const IDX_LOCK = 0, // global mutex (int32)
	IDX_MAGIC = 1, // magic word "SAFS"
	IDX_NEXT_INODE = 2, // next inode id
	IDX_NEXT_DATA = 3; // next free byte in data buffer
const HEADER_WORDS = 256; // leave ample header space (1kB)

// === Header indices for recently unlinked inode ring buffer ===
const UNLINKED_RING_SIZE = 16;
const IDX_UNLINKED_RING_POS = 4; // Current position in the ring (0 to SIZE-1)
const IDX_UNLINKED_RING_START = 5; // Start index of ring buffer slots
// Ensure HEADER_WORDS is large enough for header + ring buffer
if (IDX_UNLINKED_RING_START + UNLINKED_RING_SIZE > HEADER_WORDS) {
	throw new Error('HEADER_WORDS too small for unlinked ring buffer');
}
// ==============================================================

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
	I_NAME = 16, // 16..47 (128 bytes) for UTF-8 name
	I_OPENREFS = 48,
	I_PERSIST = 49; // Flag to indicate this file should persist even when unlinked
const INODE_WORDS = 16 + 32 + 2; // 200 bytes per inode (added 2 for I_OPENREFS + I_PERSIST)
const NAME_BYTES = 128;
const MAGIC = 0x53414653; // "SAFS"

const TD = new TextDecoder();
const TE = new TextEncoder();
const now64 = () => BigInt(Date.now());

/* SQLite specific constants */
// SQLite database header structure - first 100 bytes

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
			S(meta, IDX_UNLINKED_RING_POS, 0);
			for (let i = 0; i < UNLINKED_RING_SIZE; i++) {
				S(meta, IDX_UNLINKED_RING_START + i, 0);
			}
			const off = ioff(1);
			meta.fill(0, off, off + INODE_WORDS);
			S(meta, off + I_MODE, MODE_DIR);
			S(meta, off + I_PARENT, 1);
			S(meta, off + I_NLINK, 1);
			S(meta, off + I_RDEV, 0);
			S(meta, off + I_OPENREFS, 0);
			S(meta, off + I_PERSIST, 0);
			setSize(off, 0);
			putName(off, '/');
			setTimes(off, true, true, true);
			S(meta, off + I_CAP, 0);
			log('root initialized');
		}
		unlock();
	}

	/* directory helpers */
	const dCount = (off: number) => L(meta, off + I_SIZEL);
	const dVec = (off: number) =>
		new Int32Array(dataBuf, L(meta, off + I_DATA_OFF), dCount(off));
	const pushChild = (off: number, id: number) => {
		const cnt = dCount(off);
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
		let currentOffset;
		let newOffset;
		do {
			currentOffset = Atomics.load(meta, IDX_NEXT_DATA);
			newOffset = currentOffset + bytes;
			if (newOffset > data8.length) {
				log(
					`allocData failed: requested ${bytes}, currentOffset ${currentOffset}, newOffset ${newOffset} > dataBuffer.length ${data8.length}`
				);
				throw new FS.ErrnoError(28); // ENOSPC - No space left on device
			}
			// Attempt to atomically update IDX_NEXT_DATA from currentOffset to newOffset
		} while (
			Atomics.compareExchange(
				meta,
				IDX_NEXT_DATA,
				currentOffset,
				newOffset
			) !== currentOffset
		);
		log(
			`allocData success: allocated ${bytes} bytes at offset ${currentOffset}, new IDX_NEXT_DATA ${newOffset}`
		);
		return currentOffset; // Return the beginning of the allocated block
	};

	// Helper to check if an inode ID is in the recently unlinked ring buffer
	const isRecentlyUnlinked = (idToCheck: number): boolean => {
		for (let i = 0; i < UNLINKED_RING_SIZE; i++) {
			if (L(meta, IDX_UNLINKED_RING_START + i) === idToCheck) {
				return true;
			}
		}
		return false;
	};

	/* Helper to check if a filename is a SQLite journal or WAL file */
	const isSQLiteJournalFile = (name: string): boolean => {
		return name.endsWith('-journal') || name.endsWith('-wal');
	};

	/* inode allocation */
	const newInode = (parent: number, mode: number, name: string, rdev = 0) => {
		lock();
		let id = -1;
		let success = false;
		try {
			// Loop to find a suitable inode ID that hasn't been recently unlinked
			for (let attempts = 0; attempts < maxInodes * 2; attempts++) {
				// Limit attempts
				id = Atomics.add(meta, IDX_NEXT_INODE, 1);

				if (id > maxInodes) {
					// We've exceeded the max inode count, reset counter? This state is tricky.
					// For now, just fail loudly. A real FS might need ID reclamation.
					Atomics.sub(meta, IDX_NEXT_INODE, 1); // Roll back counter
					log(`newInode error: exceeded maxInodes (${maxInodes})`);
					throw new FS.ErrnoError(28); // ENOSPC
				}

				// Check if this ID is in the recently unlinked ring buffer
				if (isRecentlyUnlinked(id)) {
					log(
						`[SABFS] newInode: skipping recently unlinked id=${id}`
					);
					continue; // Try the next ID
				}

				// ID is potentially valid and not recently unlinked, proceed
				success = true;
				break;
			}

			if (!success) {
				// Failed to find a suitable ID after many attempts
				log(
					`newInode error: failed to find unused inode ID after ${
						maxInodes * 2
					} attempts`
				);
				throw new FS.ErrnoError(28); // ENOSPC or another error?
			}

			// --- Initialize the chosen inode ID ---
			const off = ioff(id);
			meta.fill(0, off, off + INODE_WORDS);
			S(meta, off + I_MODE, mode);
			S(meta, off + I_PARENT, parent);
			S(meta, off + I_NLINK, 1);
			S(meta, off + I_RDEV, rdev);
			S(meta, off + I_OPENREFS, 0);
			S(meta, off + I_PERSIST, 0);
			setSize(off, 0);
			putName(off, name);
			setTimes(off, true, true, true);
			if ((mode & S_IFMT) === S_IFDIR) S(meta, off + I_CAP, 0);
			pushChild(ioff(parent), id);
			setTimes(ioff(parent), false, true, true);
			unlock();
			log('inode', id, '"' + name + '"');
			return id;
		} finally {
			unlock();
		}
	};

	/* Helper function to check if a file is accessible despite being unlinked */
	// Remove this function entirely
	/*
	const isAccessibleAfterUnlink = (id: number): boolean => {
		const off = ioff(id);
		
		// Files with no mode (MODE=0) but non-zero link count are still accessible
		if (L(meta, off + I_MODE) === 0 && L(meta, off + I_NLINK) > 0) {
			return true;
		}
		
		// Journal files with NLINK=0 but MODE>0 are still accessible
		const name = getName(off);
		if (L(meta, off + I_NLINK) === 0 && L(meta, off + I_MODE) > 0 && 
			(name.endsWith("-journal") || name.endsWith("-wal"))) {
			return true;
		}
		
		// Recently unlinked files that appear in the ring buffer are accessible
		for (let i = 0; i < UNLINKED_RING_SIZE; i++) {
			if (L(meta, IDX_UNLINKED_RING_START + i) === id) {
				return true;
			}
		}
		
		return false;
	};
	*/

	const readBytes = (
		id: number,
		pos: number,
		len: number,
		out: Uint8Array
	) => {
		const off = ioff(id);

		// Check if this inode is valid (mode != 0)
		if (L(meta, off + I_MODE) === 0) {
			// Check if this is a SQLite journal file that was recently unlinked
			// If so, restore its mode so it can be read
			const name = getName(off);
			if (isSQLiteJournalFile(name) && isRecentlyUnlinked(id)) {
				log(
					`  -> RECOVERY in readBytes: Restoring mode for unlinked journal file ${name} (id=${id})`
				);
				S(meta, off + I_MODE, 0o100666); // Regular file with rw permissions
			} else {
				// Not a journal file or not recently unlinked
				log(
					`  -> ERROR: Attempted to read from an inaccessible inode ${id} (mode=0)`
				);
				throw new FS.ErrnoError(2); // ENOENT
			}
		}

		lock();
		try {
			const size = sz(off);
			if (pos >= size) return 0;
			const to = Math.min(len, size - pos),
				src = L(meta, off + I_DATA_OFF) + pos;
			out.set(data8.subarray(src, src + to));
			setTimes(off, true, false, false);
			return to;
		} finally {
			unlock();
		}
	};

	const writeBytes = (id: number, pos: number, src: Uint8Array) => {
		log(`writeBytes id=${id} pos=${pos} len=${src.length}`);
		const off = ioff(id);

		// Check if this inode is valid (mode != 0)
		if (L(meta, off + I_MODE) === 0) {
			// Check if this is a SQLite journal file that was recently unlinked
			// If so, restore its mode so it can be written to
			const name = getName(off);
			if (isSQLiteJournalFile(name) && isRecentlyUnlinked(id)) {
				log(
					`  -> RECOVERY in writeBytes: Restoring mode for unlinked journal file ${name} (id=${id})`
				);
				S(meta, off + I_MODE, 0o100666); // Regular file with rw permissions
			} else {
				// Not a journal file or not recently unlinked
				log(
					`  -> ERROR: Attempted to write to an inaccessible inode ${id} (mode=0)`
				);
				throw new FS.ErrnoError(2); // ENOENT
			}
		}

		let cap = L(meta, off + I_CAP),
			start = L(meta, off + I_DATA_OFF);
		const end = pos + src.length,
			size = sz(off);
		const name = getName(off);

		log(
			`  -> initial size=${size} cap=${cap} start=${start} end=${end} name=${name}`
		);
		lock();
		try {
			// Additional check after acquiring lock - check mode again
			if (L(meta, off + I_MODE) === 0) {
				log(
					`  -> ERROR: Inode ${id} became inaccessible while waiting for lock (mode=0)`
				);
				throw new FS.ErrnoError(2); // ENOENT
			}

			if (end > cap) {
				log(`  -> reallocating: end(${end}) > cap(${cap})`);
				const ncap = Math.max(
					end,
					cap ? (cap < 1 << 20 ? cap * 2 : (cap * 9) >> 3) : 256
				);
				log(`  -> new capacity ncap=${ncap}`);
				const nOff = allocData(ncap);
				log(`  -> allocated new block at nOff=${nOff}`);
				if (size > 0) {
					// Only copy if there was previous data
					log(`  -> slicing ${size} bytes from old offset ${start}`);
					const oldData = data8.slice(start, start + size);
					log(
						`  -> writing ${oldData.length} sliced bytes to new offset ${nOff}`
					);
					data8.set(oldData, nOff);
				}
				start = nOff;
				cap = ncap;
				S(meta, off + I_DATA_OFF, start);
				S(meta, off + I_CAP, cap);
				log(`  -> updated DATA_OFF=${start}, CAP=${cap}`);
			}

			// If the write position is beyond the current size, fill the gap with zeros
			if (pos > size) {
				log(
					`  -> filling gap: pos(${pos}) > size(${size}), filling ${
						pos - size
					} bytes from ${start + size}`
				);
				data8.fill(0, start + size, start + pos);
			}

			log(
				`  -> writing ${src.length} bytes to data buffer at offset ${
					start + pos
				}`
			);
			data8.set(src, start + pos);

			// Update size *after* writing the data if the file grew.
			if (end > size) {
				log(`  -> updating size from ${size} to ${end} *after* write`);
				setSize(off, end);
			}

			// Write operation finished, now ensure the data is flushed and protected
			setTimes(off, false, true, true);

			// Special handling for SQLite database files
			// Force an fsync-like behavior to ensure durability
			if (name.endsWith('.sqlite') || name.endsWith('.db')) {
				log(
					`  -> writeBytes: special handling for SQLite database file ${name}`
				);
				// Make sure any pending writes are guaranteed to be visible to all threads
				S(meta, off + I_PERSIST, 1); // Mark SQLite database as persistent
			}
		} finally {
			unlock();
		}
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
			lock();
			try {
				const o = ioff(n.sabId);
				const mode = L(meta, o + I_MODE);

				// Read all attributes while holding the lock
				const attrs = {
					dev: 1,
					ino: n.sabId,
					mode,
					nlink: L(meta, o + I_NLINK),
					uid: L(meta, o + I_UID),
					gid: L(meta, o + I_GID),
					rdev: L(meta, o + I_RDEV),
					size: mode & S_IFDIR ? 4096 : sz(o), // sz() also uses Atomics.load
					// Faking times for now, reading them atomically would be needed otherwise
					atime: new Date(),
					mtime: new Date(),
					ctime: new Date(),
				};
				return attrs;
			} finally {
				unlock();
			}
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

			// Normal lookup: Iterate through directory entries
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

			// If not found in directory, check if this is a journal file in the unlinked ring buffer
			if (isSQLiteJournalFile(name)) {
				log(
					`  lookup dir ${parentId}: "${name}" not found in directory, checking unlinked ring buffer`
				);

				for (let i = 0; i < UNLINKED_RING_SIZE; i++) {
					const id = L(meta, IDX_UNLINKED_RING_START + i);
					if (id <= 0) continue;

					const off = ioff(id);
					// We need to check if this is a matching journal file with the right parent
					if (
						L(meta, off + I_PARENT) === parentId &&
						getName(off) === name
					) {
						// Ensure it's still active (has non-zero mode)
						if (L(meta, off + I_MODE) === 0) {
							log(
								`  lookup dir ${parentId}: found "${name}" in unlinked buffer but it has mode=0`
							);
							continue;
						}

						// Found a matching journal file in the unlinked buffer
						log(
							`  lookup dir ${parentId}: found unlinked journal file "${name}" as id ${id}, re-adding to directory`
						);

						// Re-add it to the parent directory - this is critical for SQLite to work properly
						lock();
						try {
							pushChild(poff, id);
							// Increment nlink since it's back in a directory
							S(meta, off + I_NLINK, L(meta, off + I_NLINK) + 1);
							// Clear it from the unlinked buffer
							S(meta, IDX_UNLINKED_RING_START + i, 0);
						} finally {
							unlock();
						}

						return mkNode(id, p.mount, p);
					}
				}

				log(
					`  lookup dir ${parentId}: "${name}" not found in unlinked ring buffer either`
				);
			}

			log(`lookup failed for "${name}" in dir ${parentId}`);
			throw new FS.ErrnoError(44); // ENOENT
		},
		mknod(p: any, n: string, m: number, d: number) {
			const parentId = p.sabId;
			log(`mknod: creating "${n}" in parent ${parentId}`);

			// Create the new inode
			const id = newInode(parentId, m, n, d);

			// If it's a journal file, mark it as persistent
			if (isSQLiteJournalFile(n)) {
				const off = ioff(id);
				log(`mknod: marking ${n} (id=${id}) as persistent`);
				lock();
				try {
					S(meta, off + I_PERSIST, 1);
				} finally {
					unlock();
				}
			} else if (n.endsWith('.sqlite') || n.endsWith('.db')) {
				// Also mark SQLite database files as persistent to ensure consistency
				const off = ioff(id);
				log(
					`mknod: marking SQLite database ${n} (id=${id}) as persistent`
				);
				lock();
				try {
					S(meta, off + I_PERSIST, 1);
				} finally {
					unlock();
				}
			}

			return mkNode(id, p.mount, p);
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
			const off = ioff(c.sabId);
			const name = getName(off);

			log(`[SABFS] unlink: ${name} (id=${c.sabId})`);
			lock();
			try {
				// Remove from parent directory
				removeChild(ioff(p.sabId), c.sabId);

				// Set link count to 0, but DO NOT set mode to 0 yet.
				// The file will be fully deleted when the last open reference is closed.
				const openRefs = L(meta, off + I_OPENREFS);
				const persist = L(meta, off + I_PERSIST);
				log(
					`[SABFS] unlink: setting nlink=0 for inode ${c.sabId} ("${name}"), openRefs=${openRefs}`
				);
				S(meta, off + I_NLINK, 0);

				// Only set mode=0 if there are no open references
				if (openRefs === 0 && persist === 0) {
					// ALWAYS keep journal files accessible even when unlinked with no open refs
					if (isSQLiteJournalFile(name)) {
						log(
							`[SABFS] unlink: journal file ${name} (id=${c.sabId}) kept accessible after unlink`
						);
						// Never set mode=0 for journal files and mark as persistent
						S(meta, off + I_PERSIST, 1);
					} else {
						log(
							`[SABFS] unlink: no open refs, marking inode ${c.sabId} as fully deleted (mode=0)`
						);
						S(meta, off + I_MODE, 0);
					}
				} else if (persist === 1) {
					log(
						`[SABFS] unlink: keeping persistent inode ${c.sabId} ("${name}") accessible`
					);
				} else {
					log(
						`[SABFS] unlink: keeping inode ${c.sabId} accessible for ${openRefs} open refs`
					);
				}

				// Add to the ring buffer of recently unlinked inodes
				const ringPos = L(meta, IDX_UNLINKED_RING_POS);
				const ringIndex = IDX_UNLINKED_RING_START + ringPos;
				log(
					`[SABFS] unlink: Storing unlinked id=${c.sabId} at ring index ${ringIndex}`
				);
				S(meta, ringIndex, c.sabId);
				S(
					meta,
					IDX_UNLINKED_RING_POS,
					(ringPos + 1) % UNLINKED_RING_SIZE
				);
			} finally {
				unlock();
			}
		},
		rmdir(p: any, nm: string) {
			const c = node_ops.lookup(p, nm);
			// Prevent removing directories named like journal files, just in case
			if (nm.endsWith('-journal') || nm.endsWith('-wal')) {
				log(
					`rmdir: refusing to remove directory resembling journal file ${nm}`
				);
				throw new FS.ErrnoError(1); // EPERM - Operation not permitted
			}

			if (dCount(ioff(c.sabId)) > 0) throw new FS.ErrnoError(55); // ENOTEMPTY
			lock();
			removeChild(ioff(p.sabId), c.sabId);
			const off = ioff(c.sabId);
			S(meta, off + I_NLINK, 0);

			// Only fully delete the directory if there are no open references
			const openRefs = L(meta, off + I_OPENREFS);
			if (openRefs === 0) {
				S(meta, off + I_MODE, 0);
				log(`rmdir: removed directory "${nm}" (id=${c.sabId})`);
			} else {
				log(
					`rmdir: marked directory "${nm}" (id=${c.sabId}) for deletion, but keeping accessible for ${openRefs} open refs`
				);
			}
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
			lock();
			try {
				const off = ioff(n.sabId);
				const len = sz(off); // Read size under lock
				const dataOffset = L(meta, off + I_DATA_OFF); // Read offset under lock
				// Slice data under lock
				const linkData = data8.slice(dataOffset, dataOffset + len);
				return TD.decode(linkData);
			} finally {
				unlock();
			}
		},
		chmod(n: any, mode: number) {
			node_ops.setattr(n, { mode });
		},
		chown() {},
		fsync(s: any) {
			const id = s.node.sabId;
			const off = ioff(id);
			const name = getName(off);

			log(`fsync called for node id ${id} (${name})`);

			// Lock the metadata to ensure atomic updates
			lock();
			try {
				// Mark database files as persistent to ensure they're never deleted
				if (name.endsWith('.sqlite') || name.endsWith('.db')) {
					log(
						`  -> fsync: marking SQLite database ${name} as persistent`
					);
					S(meta, off + I_PERSIST, 1);
				}

				// Update mtime to indicate metadata was synchronized
				setTimes(off, false, true, false);
			} finally {
				unlock();
			}

			return 0;
		},
		flush() {
			return 0;
		},
	};

	/* stream_ops */
	const stream_ops: any = {
		open(s: any) {
			if (s.flags & 0x400 && FS.isFile(s.node.mode))
				node_ops.setattr(s.node, { size: 0 });
			s.position = s.flags & 0x800 ? sz(ioff(s.node.sabId)) : 0;

			// Special handling for SQLite journal files
			const id = s.node.sabId;
			const off = ioff(id);
			const name = getName(off);

			// Check if this is a journal file with mode=0 but in the recently unlinked buffer
			// This handles SQLite's pattern of: unlink journal file -> immediately reopen it
			if (
				L(meta, off + I_MODE) === 0 &&
				isSQLiteJournalFile(name) &&
				isRecentlyUnlinked(id)
			) {
				log(
					`  -> RECOVERY: Restoring mode for unlinked journal file ${name} (id=${id})`
				);
				lock();
				try {
					// Restore it as a regular file with rw permissions
					S(meta, off + I_MODE, 0o100666);
					// We don't update nlink because it should remain "unlinked" from the directory
				} finally {
					unlock();
				}
			}

			// Increment the open reference count for this inode
			lock();
			try {
				const off = ioff(s.node.sabId);
				Atomics.add(meta, off + I_OPENREFS, 1);
				log(
					`  -> Incremented open refs for inode ${
						s.node.sabId
					} to ${L(meta, off + I_OPENREFS)}`
				);
			} finally {
				unlock();
			}
		},
		close(s: any) {
			// Decrement the open reference count
			lock();
			try {
				const off = ioff(s.node.sabId);
				const openRefs = Atomics.sub(meta, off + I_OPENREFS, 1);
				const newRefs = openRefs - 1;
				const nlink = L(meta, off + I_NLINK);
				const persist = L(meta, off + I_PERSIST);

				log(
					`  -> Decremented open refs for inode ${s.node.sabId} to ${newRefs}, nlink=${nlink}`
				);

				// Check first if it's a journal file - we should never fully delete those
				const name = getName(off);
				if (newRefs === 0 && nlink === 0 && persist === 0) {
					if (isSQLiteJournalFile(name)) {
						log(
							`  -> Journal file ${name} (id=${s.node.sabId}) kept alive after closing`
						);
						// For journal files, we never mark them as fully deleted even when closed
						// Mark as persistent
						S(meta, off + I_PERSIST, 1);
					} else {
						log(
							`  -> No more open refs and nlink=0, marking inode ${s.node.sabId} as fully deleted (mode=0)`
						);
						S(meta, off + I_MODE, 0);
					}
				} else if (persist === 1) {
					log(
						`  -> Keeping persistent inode ${s.node.sabId} ("${name}") accessible`
					);
				}
			} finally {
				unlock();
			}
		},
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
			lock();
			try {
				const size = sz(ioff(s.node.sabId)); // Read size under lock
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

				if (p < 0) throw new FS.ErrnoError(22); // EINVAL
				s.position = p;
				return p;
			} finally {
				unlock();
			}
		},
		flush(s: any) {
			log(`flush called for node id ${s.node.sabId}`);
			const id = s.node.sabId;
			const off = ioff(id);

			// Lock the metadata to ensure atomic updates
			lock();
			try {
				// Check if the node is valid
				if (L(meta, off + I_MODE) === 0) {
					// For flush, if the inode is invalid, we'll just log and succeed
					// This is because SQLite may call flush on already-closed files
					log(
						`  -> WARNING: flush called on invalid inode ${id}, ignoring`
					);
					return 0;
				}

				// Update mtime to indicate data was modified
				setTimes(off, false, true, false);
				log(`  -> flush completed for inode ${id}`);
				return 0;
			} finally {
				unlock();
			}
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
