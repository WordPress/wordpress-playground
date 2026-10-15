import { createContext, useContext, useState, type ReactNode } from 'react';
import type { ExportFormValues } from './github-export-form/form';
import type { GitHubImportFormProps } from './github-import-form/form';
import { readInitialGitHubExportValues } from './github-export-defaults';

type GitHubImportDetails = Parameters<GitHubImportFormProps['onImported']>[0];

type GitHubExportSession = {
	allowZipExport: boolean;
	filesBeforeChanges?: unknown[];
	values: Partial<ExportFormValues>;
	recordExport: (values: ExportFormValues) => void;
	recordImport: (details: GitHubImportDetails) => void;
};

const GitHubExportSessionContext = createContext<GitHubExportSession | null>(
	null
);

/** Keeps GitHub import and export state shared by modal and Dock surfaces. */
export function GitHubExportSessionProvider({
	children,
}: {
	children: ReactNode;
}) {
	const query = new URL(window.location.href).searchParams;
	const [filesBeforeChanges, setFilesBeforeChanges] = useState<unknown[]>();
	const [values, setValues] = useState<Partial<ExportFormValues>>(() =>
		readInitialGitHubExportValues(query)
	);

	const session: GitHubExportSession = {
		allowZipExport:
			(query.get('ghexport-allow-include-zip') ?? 'yes') === 'yes',
		filesBeforeChanges,
		values,
		recordExport(nextValues) {
			setValues(nextValues);
			setFilesBeforeChanges(undefined);
		},
		recordImport(details) {
			const { pr } = details.urlInformation;
			setValues({
				repoUrl: details.url,
				prNumber: pr?.toString(),
				toPathInRepo: details.path,
				prAction: pr ? 'update' : 'create',
				contentType: details.contentType,
				...(details.contentType === 'plugin'
					? { plugin: details.pluginOrThemeName }
					: details.contentType === 'theme'
						? { theme: details.pluginOrThemeName }
						: {}),
			});
			setFilesBeforeChanges(details.files);
		},
	};

	return (
		<GitHubExportSessionContext.Provider value={session}>
			{children}
		</GitHubExportSessionContext.Provider>
	);
}

/** Returns the GitHub import/export session owned by the website layout. */
export function useGitHubExportSession() {
	const session = useContext(GitHubExportSessionContext);
	if (!session) {
		throw new Error(
			'useGitHubExportSession must be used inside GitHubExportSessionProvider.'
		);
	}
	return session;
}
