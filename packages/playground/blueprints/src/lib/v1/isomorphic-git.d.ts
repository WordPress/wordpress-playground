declare module 'isomorphic-git/src/models/GitIndex.js' {
	export class GitIndex {
		constructor(entries?: Map<string, any>, unmergedPaths?: Set<string>);
		insert(entry: {
			filepath: string;
			oid: string;
			stats: {
				ctimeSeconds: number;
				ctimeNanoseconds: number;
				mtimeSeconds: number;
				mtimeNanoseconds: number;
				dev: number;
				ino: number;
				mode: number;
				uid: number;
				gid: number;
				size: number;
			};
		}): void;
		toObject(): Promise<Buffer>;
	}
}
