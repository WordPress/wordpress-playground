import forms from '../../forms.module.css';
import { GitHubPointer } from '../analyze-github-url';
import css from './style.module.css';

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
	if (['pr', 'branch', 'repo'].includes(urlType as any)) {
		return (
			<>
				<div className={`${forms.formGroup} ${forms.formGroupLast}`}>
					<label>
						I am importing a:
						<select
							value={contentType as string}
							className={css.repoInput}
							onChange={(e) =>
								setContentType(e.target.value as ContentType)
							}
						>
							<option value=""></option>
							<option value="theme">Theme</option>
							<option value="plugin">Plugin</option>
							<option value="wp-content">
								wp-content directory
							</option>
						</select>
					</label>
				</div>
				<div className={`${forms.formGroup} ${forms.formGroupLast}`}>
					<label>
						From the following path in the repo:
						<input
							type="text"
							className={css.repoInput}
							value={repoPath}
							onChange={(e) => setRepoPath(e.target.value)}
						/>
					</label>
				</div>
			</>
		);
	}

	return <div />;
}
