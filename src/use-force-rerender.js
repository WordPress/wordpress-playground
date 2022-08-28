import * as React from 'react';

export default function useForceRerender() {
	const [ , updateState ] = React.useState();
	return React.useCallback( () => updateState( {} ), [] );
}
