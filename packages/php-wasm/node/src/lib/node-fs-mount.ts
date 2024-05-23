import { Mountable, RootFS } from '@php-wasm/universal';

export class NodeFSMount implements Mountable {
	constructor(private readonly localPath: string) {}

	mount(FS: RootFS, vfsMountPoint: string): void | Promise<void> {
		FS.mount(
			FS.filesystems['NODEFS'],
			{ root: this.localPath },
			vfsMountPoint
		);
	}
}
