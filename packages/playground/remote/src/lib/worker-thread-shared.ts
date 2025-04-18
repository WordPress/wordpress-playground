import { PHP, PHPWorker, loadPHPRuntime } from '@php-wasm/universal';
import { exposeAPI, getPHPLoaderModule } from '@php-wasm/web';
import {
	sharedArrayBufferMount,
	SharedFSBuffers,
} from './shared-array-buffer-fs';

interface BootOptions {
	sharedBuffers: SharedFSBuffers;
}

let bufs: SharedFSBuffers | null = null;

export class ExperimentalWorkerEndpoint extends PHPWorker {
	booted = false;

	async boot(options: BootOptions) {
		const php = new PHP(
			await loadPHPRuntime(await getPHPLoaderModule('8.0'))
		);
		php.mkdir('/experimental-sabfs');
		php.mount(
			'/experimental-sabfs',
			sharedArrayBufferMount(options.sharedBuffers)
		);
		bufs = options.sharedBuffers;
		this.setPrimaryPHP(php);
		setApiReady();
	}

	async logHeader(tag: string) {
		const hdr = new Int32Array(bufs!.metaBuf, 0, 8); // first 8 words are enough
		/* fields we care about:
			  0: lock        (should be 0 most of the time)
			  1: MAGIC       (0x53414653 = “SAFS”)
			  2: NEXT_INODE  (== 2 before any file is created, == 3 after your test.txt)
			  3: NEXT_DATA   (advances as you write file contents)                    */
		console.log(
			`[SABFS‑DEBUG] ${tag}`,
			'MAGIC=',
			hdr[1].toString(16),
			'NEXT_INODE=',
			hdr[2],
			'NEXT_DATA=',
			hdr[3]
		);
	}

	async logDirState(tag: string) {
		const meta32 = new Int32Array(bufs!.metaBuf);
		const I_SIZEL = 4,
			I_DATA_OFF = 7; // offsets inside every inode
		const HEADER_WORDS = 256; // inode‑table starts here

		// inode 1 starts at HEADER_WORDS
		const base = HEADER_WORDS + 1 * (16 + 32); // 16+32 = 48 words per inode
		const count = meta32[base + I_SIZEL];
		const dataOff = meta32[base + I_DATA_OFF];

		console.log(
			`[SABFS‑DEBUG] ${tag}`,
			'dirCount=',
			count,
			'dataOff=',
			dataOff
		);
	}
	dumpDir(tag: string) {
		const meta32 = new Int32Array(bufs!.metaBuf);
		const HEADER_WORDS = 256;
		const INODE_WORDS = 48; // as defined
		const I_SIZEL = 4,
			I_DATA_OFF = 7;

		const base = HEADER_WORDS + 1 * INODE_WORDS; // inode 1
		const cnt = meta32[base + I_SIZEL];
		const data = meta32[base + I_DATA_OFF];

		console.log(`[SABFS‑DEBUG] ${tag} dirCount=${cnt}`);
		const vec = new Int32Array(bufs!.metaBuf, data, cnt);
		for (let i = 0; i < cnt; i++) {
			const id = vec[i];
			const off = HEADER_WORDS + (id - 1) * INODE_WORDS;
			const nameBytes = new Uint8Array(
				bufs!.metaBuf,
				(off + 16) * 4,
				128
			); // I_NAME field
			const nul = nameBytes.indexOf(0);
			const name = new TextDecoder().decode(
				new Uint8Array(nameBytes.slice(0, nul < 0 ? 128 : nul))
			);
			console.log('  child', i, 'id', id, 'name', JSON.stringify(name));
		}
	}
}

// post message to parent
self.postMessage('worker-script-started');

const [setApiReady, setAPIError] = exposeAPI(new ExperimentalWorkerEndpoint());
