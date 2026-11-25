export interface Mount {
	hostPath: string;
	vfsPath: string;
	autoMounted?: boolean;
	followSymlinks?: boolean;
}
