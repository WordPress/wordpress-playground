import forms from '../../forms.module.css';
import { GitHubPointer } from '../analyze-github-url';

export type ContentType = 'theme' | 'plugin' | 'wp-content';

export interface DetailsProps {
	urlType?: GitHubPointer['type'];
	repoPath: string;
	setRepoPath: (path: string) => void;
	contentType?: ContentType;
	setContentType: (type: ContentType) => void;
}

export function GitHubFormDetails({
	urlType,
	repoPath,
	setRepoPath,
	contentType,
	setContentType,
}: DetailsProps) {
	console.log('urlType', urlType, contentType);
	if (['pr', 'branch', 'repo'].includes(urlType as any)) {
		return (
			<>
				<URLType urlType={urlType as string} />
				<div className={`${forms.formGroup} ${forms.formGroupLast}`}>
					What path in the repo do you want to load?
					<input
						type="text"
						value={repoPath}
						onChange={(e) => setRepoPath(e.target.value)}
					/>
				</div>
				<div className={`${forms.formGroup} ${forms.formGroupLast}`}>
					What is it?
					<select
						value={contentType as string}
						onChange={(e) =>
							setContentType(e.target.value as ContentType)
						}
					>
						<option value=""></option>
						<option value="theme">Theme</option>
						<option value="plugin">Plugin</option>
						<option value="wp-content">wp-content directory</option>
					</select>
				</div>
			</>
		);
	}

	return <div />;
}

function URLType({ urlType }: { urlType: string }) {
	return (
		<div className={`${forms.formGroup} ${forms.formGroupLast}`}>
			{urlType === 'pr' ? (
				<>Looks like that's a PR</>
			) : urlType === 'branch' ? (
				<>Looks like that's a branch</>
			) : urlType === 'rawfile' ? (
				<>Looks like that's a raw file</>
			) : urlType === 'repo' ? (
				<>Looks like that's a repo</>
			) : (
				<>Playground doesn't recognize this URL</>
			)}
		</div>
	);
}
