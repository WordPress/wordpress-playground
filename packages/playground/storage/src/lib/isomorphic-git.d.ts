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

declare module 'isomorphic-git/src/models/GitPktLine.js' {
	export class GitPktLine {
		static encode(data: string): Buffer;
		static decode(data: Buffer): string;
		static flush(): Buffer;
		static delim(): Buffer;
	}
}

declare module 'isomorphic-git/src/models/GitTree.js' {
	export class GitTree {
		static from(buffer: Buffer): GitTree;
		type: 'tree' | 'blob';
		oid: string;
		format: 'content';
		object: Array<{
			mode: string;
			path: string;
			oid: string;
			type?: 'blob' | 'tree';
			object?: GitTree;
		}>;
	}
}

declare module 'isomorphic-git/src/models/GitAnnotatedTag.js' {
	export class GitAnnotatedTag {
		static from(buffer: Buffer): GitAnnotatedTag;
		parse(): {
			object: {
				object: GitTree;
			};
			type: string;
			tag: string;
			tagger: {
				name: string;
				email: string;
				timestamp: number;
				timezoneOffset: number;
			};
			message: string;
			signature?: string;
		};
	}
}

declare module 'isomorphic-git/src/models/GitCommit.js' {
	export class GitCommit {
		static from(buffer: Buffer): GitCommit;
		parse(): {
			tree: string;
			parent: string[];
			author: {
				name: string;
				email: string;
				timestamp: number;
				timezoneOffset: number;
			};
			committer: {
				name: string;
				email: string;
				timestamp: number;
				timezoneOffset: number;
			};
			message: string;
			gpgsig?: string;
		};
	}
}

declare module 'isomorphic-git/src/models/GitPackIndex.js' {
	export class GitPackIndex {
		static fromPack({ pack }: { pack: Buffer }): Promise<GitPackIndex>;
		read({ oid }: { oid: string }): Promise<GitIndexEntry>;
		toBuffer(): Promise<Buffer>;
		packfileSha: string;
		hashes?: string[];
		offsets: Map<string, number>;
		readSlice({ start }: { start: number }): Promise<{
			type:
				| 'blob'
				| 'tree'
				| 'commit'
				| 'tag'
				| 'ofs_delta'
				| 'ref_delta';
			object?: Buffer | Uint8Array;
		}>;
	}
}

declare module 'isomorphic-git/src/internal-apis.js' {
	export function collect(data: any[]): Promise<Buffer>;
}

declare module 'isomorphic-git/src/wire/parseUploadPackResponse.js' {
	export function parseUploadPackResponse(data: Buffer): any; // Replace 'any' with a more specific type if known
}

declare module 'isomorphic-git/src/errors/ObjectTypeError.js' {
	export class ObjectTypeError extends Error {
		constructor(message: string, expected: string, actual: string);
	}
}
