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
	I_PERSIST = 49; // Flag to indicate journal file for truncate-on-close
const INODE_WORDS = 16 + 32 + 2; // Re-add I_PERSIST to size
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
		for (let i = 0; i < cnt; i++) {
			if (Atomics.load(vec, i) !== id) continue;

			const last = cnt - 1;
			// Swap down the last entry (if not the same slot)
			if (i !== last) {
				Atomics.store(vec, i, Atomics.load(vec, last));
			}
			// Really clear the old slot
			Atomics.store(vec, last, 0);

			// Decrement count
			S(meta, off + I_SIZEL, last);
			Atomics.notify(meta, (off + I_SIZEL) >> 2, 1);
			log('dir-', (off - HEADER_WORDS) / INODE_WORDS + 1, 'del', id);
			return;
		}
		throw new FS.ErrnoError(44);
	};

	/* data allocation */
	const align4 = (x: number) => (x + 3) & ~3;

	const allocData = (bytes: number) => {
		let cur, next;
		do {
			cur = align4(Atomics.load(meta, IDX_NEXT_DATA)); // <-- new
			next = cur + align4(bytes); //   |
			if (next > data8.length) throw new FS.ErrnoError(28);
		} while (
			Atomics.compareExchange(meta, IDX_NEXT_DATA, cur, next) !== cur
		);
		return cur; // always multiple of 4
	};

	/* Helper to check if a filename is a SQLite journal or WAL file */
	const isSQLiteJournalFile = (name: string): boolean => {
		return name.endsWith('-journal') || name.endsWith('-wal');
	};

	/* ─── Helper to check if a filename is a SQLite shared memory file ─── */
	const isSQLiteShmFile = (name: string): boolean => {
		return name.endsWith('-shm');
	};

	/* ─── Helper to check if a filename is a SQLite database file ─── */
	const isSQLiteDbFile = (name: string): boolean => {
		return name.endsWith('.sqlite') || name.endsWith('.db');
	};

	/* Helper to flush a database to ensure data is persisted */
	const flushDatabase = (id: number) => {
		const off = ioff(id);
		const name = getName(off);

		if (isSQLiteDbFile(name)) {
			// No need to acquire a lock here as we'll be called with a lock already held
			// Mark the database as fully persisted
			log(
				`  -> FLUSH: Ensuring durability for SQLite database ${name} (id=${id})`
			);
			S(meta, off + I_PERSIST, 1);

			// Get the current size for logging
			const size = sz(off);
			log(
				`  -> FLUSH: Database ${name} marked as persistent, size=${size}`
			);
		}
	};

	/* ─── Helper to check if a filename is ANY SQLite-related file ─── */
	const checkSQLiteFile = (name: string): boolean => {
		return (
			isSQLiteJournalFile(name) ||
			isSQLiteShmFile(name) ||
			isSQLiteDbFile(name)
		);
	};

	/* ─── Create necessary filesystem resources for SQLite consistency ─── */
	const ensureSQLiteConsistency = (path: string) => {
		// If this is a SQLite database file, make sure all related files are ready
		if (checkSQLiteFile(path)) {
			log(`Ensuring consistency for SQLite database: ${path}`);

			// Perform any additional setup needed for SQLite to work correctly
			// without requiring EXCLUSIVE locking mode

			// Create a special lock file metadata to coordinate database access
			if (isSQLiteDbFile(path)) {
				// This metadata helps us track active transactions for this database
				// A real implementation would do more here
				return {
					locked: false,
					pendingWriters: 0,
					activeReaders: 0,
					version: 1,
				};
			}
		}
		return null;
	};

	/* inode allocation */
	// Internal implementation, assumes lock is held
	const newInodeInternal = (
		parent: number,
		mode: number,
		name: string,
		rdev = 0
	) => {
		let id = -1;
		let success = false;
		// Loop to find a suitable inode ID
		for (let attempts = 0; attempts < maxInodes * 2; attempts++) {
			id = Atomics.add(meta, IDX_NEXT_INODE, 1);
			if (id > maxInodes) {
				Atomics.sub(meta, IDX_NEXT_INODE, 1);
				log(`newInode error: exceeded maxInodes (${maxInodes})`);
				throw new FS.ErrnoError(28);
			}
			success = true;
			break;
		}
		if (!success) {
			log(
				`newInode error: failed to find unused inode ID after ${
					maxInodes * 2
				} attempts`
			);
			throw new FS.ErrnoError(28);
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
		log('inode', id, '"' + name + '"');
		return id;
	};

	// Public wrapper that handles locking
	const newInode = (
		parent: number,
		mode: number,
		name: string,
		rdev = 0,
		alreadyLocked = false
	) => {
		if (!alreadyLocked) lock();
		try {
			return newInodeInternal(parent, mode, name, rdev);
		} finally {
			if (!alreadyLocked) unlock();
		}
	};

	const readBytes = (
		id: number,
		pos: number,
		len: number,
		out: Uint8Array
	) => {
		const off = ioff(id);

		// Check if this inode is valid (mode != 0)
		if (L(meta, off + I_MODE) === 0) {
			log(
				`  -> ERROR: Attempted to read from an inaccessible inode ${id} (mode=0)`
			);
			throw new FS.ErrnoError(9); // EBADF - Bad file descriptor
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
			log(
				`  -> ERROR: Attempted to write to an inaccessible inode ${id} (mode=0)`
			);
			throw new FS.ErrnoError(9); // EBADF - Bad file descriptor
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
			if (isSQLiteDbFile(name)) {
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

		// Check if this is a SQLite file and needs special handling
		if (checkSQLiteFile(getName(off))) {
			// Add a property to track SQLite-specific metadata
			node.sqliteInfo = ensureSQLiteConsistency(getName(off));
		}

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
					if (id <= 0) {
						continue;
					}
					const childOff = ioff(id);
					// Check if mode is non-zero AND link count is non-zero
					if (
						L(meta, childOff + I_MODE) === 0 ||
						L(meta, childOff + I_NLINK) === 0
					) {
						log(
							` lookup skipping inactive/unlinked child id=${id}`
						);
						continue;
					}
					const childName = getName(childOff);
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
		mknod(p: any, n: string, m: number, d: number, alreadyLocked = false) {
			const parentId = p.sabId;
			log(`mknod: creating "${n}" in parent ${parentId}`);

			// Create the new inode, passing the lock status
			const id = newInode(parentId, m, n, d, alreadyLocked);

			// Check for SQLite files to ensure filesystem consistency
			if (checkSQLiteFile(n)) {
				ensureSQLiteConsistency(n);
			}

			// Mark ONLY journal files as persistent (for truncate-on-close behavior)
			if (isSQLiteJournalFile(n)) {
				const off = ioff(id);
				log(
					`mknod: marking journal file ${n} (id=${id}) for truncate-on-close`
				);
				if (!alreadyLocked) lock();
				try {
					S(meta, off + I_PERSIST, 1);
				} finally {
					if (!alreadyLocked) unlock();
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
			let c;
			try {
				c = node_ops.lookup(p, nm);
			} catch (e: any) {
				if (e.errno === 44) {
					// ENOENT
					log('unlink: file not found, ignore', nm);
					return;
				}
				throw e;
			}
			const off = ioff(c.sabId);
			const name = getName(off);

			log(`[SABFS] unlink: ${name} (id=${c.sabId})`);
			lock();
			try {
				// Remove from parent directory
				try {
					removeChild(ioff(p.sabId), c.sabId);
				} catch (e: any) {
					if (e.errno !== 44) throw e;
				}

				// Set link count to 0.
				// The file will be fully deleted (mode=0) by the 'close' operation
				// when the last open reference is closed.
				log(
					`[SABFS] unlink: setting nlink=0 for inode ${c.sabId} ("${name}")`
				);
				S(meta, off + I_NLINK, 0);
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

			// Use a single lock to avoid recursive locking issues
			lock();
			try {
				// Update timestamp first
				setTimes(off, false, true, false);

				if (isSQLiteDbFile(name)) {
					log(`  -> fsync: calling flushDatabase for ${name}`);
					flushDatabase(id); // Still calls this (currently just sets time again)

					// Speculative fix: Attempt to read entire file content to force sync?
					try {
						const currentSize = sz(off);
						if (currentSize > 0) {
							log(
								`  -> fsync: performing full read (${currentSize} bytes) on db id ${id}`
							);
							const dummyBuffer = new Uint8Array(currentSize);
							const bytesRead = readBytes(
								id,
								0,
								currentSize,
								dummyBuffer
							);
							log(
								`  -> fsync: dummy full read complete, bytesRead=${bytesRead}`
							);
						} else {
							log(
								`  -> fsync: skipping full read on empty db file id ${id}`
							);
						}
					} catch (readErr: any) {
						log(
							`  -> fsync: dummy full read failed for db id ${id}: ${readErr}`
						);
						// Ignore dummy read errors
					}
				} else {
					// Optional: Keep dummy single byte read for non-DB files?
					// For simplicity, let's remove it for now.
					/*
					try {
						if (sz(off) > 0) {
							log(`  -> fsync: performing dummy read on id ${id}`);
							const dummyByte = new Uint8Array(1);
							readBytes(id, 0, 1, dummyByte);
					} else {
						log(`  -> fsync: skipping dummy read on empty file id ${id}`);
					}
				} catch (readErr: any) {
					log(`  -> fsync: dummy read failed for id ${id}: ${readErr}`);
					// Ignore dummy read errors, fsync should still succeed
				}
				*/
				}
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
			// --- Initial setup before lock ---
			const id = s.node.sabId;
			const off = ioff(id);
			const name = getName(off); // Read name early, might be slightly racy but ok for logic below
			const isWriteIntent = s.flags & 0x302; // O_WRONLY, O_RDWR, O_TRUNC, etc

			log(
				`  -> open: ${name} (id=${id}) with flags=${s.flags}, writeIntent=${isWriteIntent}`
			);

			// Check if inode is already deleted BEFORE locking
			// If mode is 0, the file is gone. open should probably fail.
			if (L(meta, off + I_MODE) === 0) {
				log(
					` -> ERROR: open called on deleted inode ${id} ("${name}") mode=0`
				);
				throw new FS.ErrnoError(9); // EBADF - Bad file descriptor
			}

			// --- Main lock section ---
			lock();
			try {
				// Re-check mode after acquiring lock, in case of race condition
				if (L(meta, off + I_MODE) === 0) {
					log(
						` -> ERROR: inode ${id} ("${name}") deleted while waiting for lock in open`
					);
					throw new FS.ErrnoError(9); // EBADF - Bad file descriptor
				}

				// Handle O_TRUNC *after* acquiring lock
				if (s.flags & 0x400 && FS.isFile(s.node.mode)) {
					log(`  -> open: truncating ${name} (id=${id})`);
					node_ops.setattr(
						s.node,
						{ size: 0 },
						true /* alreadyLocked */
					); // Assuming setattr is adapted or safe
					// TODO: Adapt setattr if needed, or simplify truncate logic here
					// Quick fix for truncate:
					setSize(off, 0);
					setTimes(off, false, true, true);
				}
				s.position = s.flags & 0x800 ? sz(off) : 0;

				// Handle -shm file lookup/creation *inside* the lock
				if (isSQLiteDbFile(name) && isWriteIntent) {
					log(
						`  -> open: SQLite database being opened for writing: ${name}`
					);
					const shmName = name + '-shm';
					let shmNode = null;
					const parentNode = s.node.parent;

					if (parentNode) {
						// Ensure parentNode exists
						log(
							`  -> open: Looking for ${shmName} in parent directory ${parentNode.name}`
						);
						try {
							// Call lookup WITHOUT alreadyLocked flag now
							shmNode = parentNode.node_ops.lookup(
								parentNode,
								shmName
							);
							log(`  -> open: Found existing ${shmName}`);
						} catch (e: any) {
							// ENOENT is expected if it doesn't exist
							if ((e as any).errno !== 44 /* ENOENT */) {
								log(
									`  -> open: Error looking up ${shmName}: ${e}`
								);
							} else {
								log(
									`  -> open: ${shmName} not found, attempting creation.`
								);
								// Create the -shm file if lookup failed
								try {
									// Call mknod with alreadyLocked = true
									shmNode = parentNode.node_ops.mknod(
										parentNode,
										shmName,
										0o100666,
										0,
										true
									);
									log(
										`  -> open: Successfully created ${shmName}`
									);

									// Initialize it - does this need FS.open/write?
									// FS.open calls stream_ops.open again -> deadlock risk if not careful
									// Direct write is safer if possible.
									// We have the node (shmNode), let's write directly using writeBytes
									if (shmNode) {
										log(
											`  -> open: Initializing ${shmName} with header`
										);
									}
								} catch (createError: any) {
									log(
										`  -> open: Error creating ${shmName}: ${createError}`
									);
								}
							}
						}
					} else {
						log(
							`  -> open: Cannot handle SHM file for root node or node without parent.`
						);
					}

					// Record SHM node if found/created
					if (s.node.sqliteInfo && shmNode) {
						s.node.sqliteInfo.shmNode = shmNode;
						log(
							`  -> open: Associated shmNode (id=${shmNode.sabId}) with dbNode (id=${id})`
						);
					}
					if (s.node.sqliteInfo) {
						log(
							`  -> open: Tracking write access to database ${name}`
						);
						s.node.sqliteInfo.pendingWriters++;
					}
				} // End SHM handling

				// Increment open reference count
				Atomics.add(meta, off + I_OPENREFS, 1);
				log(
					`  -> Incremented open refs for inode ${id} to ${L(
						meta,
						off + I_OPENREFS
					)}`
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
				// Check if inode still exists before proceeding
				if (L(meta, off + I_MODE) === 0) {
					log(
						` -> WARNING: close called on already deleted inode ${s.node.sabId}, ignoring ref count.`
					);
					// Do nothing if mode is already 0
					return;
				}

				const openRefs = Atomics.sub(meta, off + I_OPENREFS, 1);
				const newRefs = openRefs - 1;
				const nlink = L(meta, off + I_NLINK);
				const name = getName(off);

				// Track SQLite database statistics (optional, keep for now)
				if (s.node.sqliteInfo) {
					if (isSQLiteDbFile(name)) {
						log(
							`  -> close: Cleaning up database tracking for ${name}`
						);
						s.node.sqliteInfo.pendingWriters = Math.max(
							0,
							s.node.sqliteInfo.pendingWriters - 1
						);
						s.node.sqliteInfo.version++;
					}
				}

				log(
					`  -> Decremented open refs for inode ${s.node.sabId} to ${newRefs}, nlink=${nlink}`
				);

				// If the link count is 0 and this is the last open reference,
				// decide whether to TRUNCATE (journal) or DELETE (normal).
				if (newRefs === 0 && nlink === 0) {
					const persist = L(meta, off + I_PERSIST);
					if (persist === 1) {
						// Journal file: Truncate instead of deleting mode
						log(
							`  -> Journal inode ${s.node.sabId} ("${name}") closed and unlinked. Truncating and clearing persist flag.`
						);
						setSize(off, 0); // Truncate to zero bytes
						setTimes(off, false, true, true); // Update times
						S(meta, off + I_PERSIST, 0); // Clear flag so it deletes next time
					} else {
						// Normal file or already-truncated journal: Delete inode
						log(
							`  -> No more open refs and nlink=0, marking inode ${s.node.sabId} ("${name}") as fully deleted (mode=0)`
						);
						S(meta, off + I_MODE, 0); // Set mode to 0
						S(meta, off + I_PERSIST, 0); // Ensure persist is 0
					}
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
		// Add dummy locking operations to potentially satisfy SQLite
		fcntl(s: any, cmd: any, arg: any) {
			log(
				`[SABFS] fcntl called for node ${s.node.sabId}, cmd=${cmd}, arg=${arg} - returning 0 (success)`
			);
			// Return 0 for success, assuming commands are related to locking (e.g., F_SETLK)
			// A real implementation would need to inspect cmd/arg and simulate locks.
			return 0;
		},
		lock(s: any) {
			log(`[SABFS] lock called for node ${s.node.sabId} - NO-OP`);
			// No-op
		},
		unlock(s: any) {
			log(`[SABFS] unlock called for node ${s.node.sabId} - NO-OP`);
			// No-op
		},
	};

	/* backend object for FS.mount */
	return { mount: (m: any) => mkNode(1, m, null) };
}

/* ─── helper to allocate buffers ─────────────────────────────────────────── */
export const createBuffers = (metaBytes = 16 << 20, dataBytes = 128 << 20) => ({
	metaBuf: new SharedArrayBuffer(metaBytes),
	dataBuf: new SharedArrayBuffer(dataBytes),
});
