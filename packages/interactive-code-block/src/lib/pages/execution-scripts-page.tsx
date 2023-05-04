import * as React from '@wordpress/element';
import { render } from '@wordpress/element';

import ExecutionScriptsList from './execution-scripts-list';
import { installEntities } from './entities';
import Notifications from './notifications';
installEntities();

window.addEventListener(
	'load',
	function () {
		render(
			<>
				<ExecutionScriptsList />
				<Notifications />
			</>,
			document.querySelector('#execution-scripts')
		);
	},
	false
);
