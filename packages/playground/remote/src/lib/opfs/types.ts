export type EmscriptenFS = any;
export type EmscriptenFSStream = {
	path: string;
	node: EmscriptenFSNode;
};
export type EmscriptenFSNode = {
	name: string;
	mode: number;
	node_ops: any;
};

declare global {
	interface FileSystemFileHandle {
		move(target: FileSystemDirectoryHandle): Promise<void>;
		move(name: string): Promise<void>;
		move(target: FileSystemDirectoryHandle, name: string): Promise<void>;
		createWritable(): Promise<FileSystemWritableFileStream>;
	}
	interface FileSystemWritableFileStream {
		write(
			buffer: BufferSource,
			options?: FileSystemReadWriteOptions
		): Promise<number>;
		close(): Promise<void>;
		seek(offset: number): Promise<void>;
		truncate(newSize: number): Promise<void>;
	}
}
