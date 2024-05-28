export type _ = any;

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
