import * as React from '@wordpress/element';

import { render } from '@wordpress/element';
import PharLibrariesList from './libraries-list';
import { installEntities } from './entities';
import Notifications from './notifications';
installEntities();

window.addEventListener(
	'load',
	function () {
		render(
			<>
				<PharLibrariesList />
				<Notifications />
			</>,
			document.querySelector('#libraries')
		);
	},
	false
);
