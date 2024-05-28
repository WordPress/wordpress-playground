import { AbstractMountable } from '@php-wasm/universal';

export class NodeFSMount extends AbstractMountable {
	constructor(private readonly localPath: string) {
		super();
	}

	handleMount(): void | Promise<void> {
		this.state!.FS.mount(
			this.state!.FS.filesystems['NODEFS'],
			{ root: this.localPath },
			this.state!.vfsMountPoint
		);
	}

	handleUnmount() {
		this.state!.FS!.unmount(this.localPath);
	}
}
