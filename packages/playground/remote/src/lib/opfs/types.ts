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
	interface FileSystemDirectoryHandle {
		values: () => AsyncIterable<
			FileSystemDirectoryHandle | FileSystemFileHandle
		>;
	}
	interface FileSystemFileHandle {
		move(target: FileSystemDirectoryHandle): Promise<void>;
		move(name: string): Promise<void>;
		move(target: FileSystemDirectoryHandle, name: string): Promise<void>;
	}
}
