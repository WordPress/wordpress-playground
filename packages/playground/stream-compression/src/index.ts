import '@php-wasm/node-polyfills';

export { collectBytes } from './utils/collect-bytes';
export { iteratorToStream } from './utils/iterator-to-stream';
export { streamWriteToPhp } from './utils/stream-write-to-php';
export {
	encodeZip as zipFiles,
	decodeZip as unzipFiles,
	decodeRemoteZip as unzipFilesRemote,
} from './zip';
