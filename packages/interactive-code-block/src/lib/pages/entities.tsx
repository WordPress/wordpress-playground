import { dispatch } from '@wordpress/data';
import { store as coreStore } from '@wordpress/core-data';
import { ExecutionScript, Library } from '../types';

export function installEntities() {
	(dispatch(coreStore) as any).addEntities([
		{
			kind: 'interactive-code-block',
			name: 'library',
			baseURL: `/interactive-code-block/v1/libraries`,
			baseURLParams: { context: 'edit' },
			label: 'PHP Library',
			plural: 'PHP Libraries',
			getTitle: (record: Library) => record.name,
		},
		{
			kind: 'interactive-code-block',
			name: 'script',
			baseURL: `/interactive-code-block/v1/execution-scripts`,
			baseURLParams: { context: 'edit' },
			label: 'Execution script',
			plural: 'Execution scripts',
			getTitle: (record: ExecutionScript) => record.name,
		},
	]);
}
