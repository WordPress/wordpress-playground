import * as React from 'react';
import useForceRerender from './use-force-rerender';

import wpWorker from './wp-worker-bridge';

class AsyncFileSystem extends EventTarget {
	constructor( basePath, workerBridge = wpWorker ) {
		super();
		this.workerBridge = workerBridge;
		this.files = [];
		this.basePath = basePath;
	}
	async loadRoot() {
		const files = await this.workerBridge.ls( this.basePath );
		this.files = files;
		this.dispatchEvent( new CustomEvent( 'change' ) );
	}
	async loadDirectory( dir, refresh = false ) {
		if ( dir.isLoading ) {
			return;
		}
		if ( dir.children?.length && ! refresh ) {
			return;
		}

		dir.isLoading = true;
		dir.children = await this.workerBridge.ls( this.basePath + dir.path );
		dir.isLoading = false;

		this.dispatchEvent( new CustomEvent( 'change' ) );
	}
}

const noop = () => { };

export default function FilesExplorer( { root = '/', onSelectFile = noop } ) {
	const filesRef = React.useRef();
	const rerender = useForceRerender();
	React.useEffect( () => {
		filesRef.current = new AsyncFileSystem( root );
		filesRef.current.addEventListener( 'change', rerender );
		filesRef.current.loadRoot();
		return () => {
			filesRef.current.removeEventListener( 'change', rerender );
		};
	}, [] );
	const onClick = React.useCallback( ( file ) => {
		if ( file.type === 'dir' ) {
			const dir = file;
			filesRef.current.loadDirectory( file );
			dir.isExpanded = ! dir.isExpanded;
			rerender();
		} else {
			onSelectFile( file.path );
		}
	}, [] );
	return treeDataToTreeComponents( filesRef.current?.files || [], onClick );
}

const treeDataToTreeComponents = ( treeData, onClick, level = 1 ) => (
	<ul className="flex flex-col list-none">
		{ treeData.map( ( item ) => {
			let icon;
			if ( item.type === 'dir' ) {
				icon = item.isExpanded ? (
					<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
						<path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" />
					</svg>
				) : (
					<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
						<path fillRule="evenodd" d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z" clipRule="evenodd" />
					</svg>
				);
			} else {
				icon = (
					<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
						<path fillRule="evenodd" d="M4.5 2A1.5 1.5 0 003 3.5v13A1.5 1.5 0 004.5 18h11a1.5 1.5 0 001.5-1.5V7.621a1.5 1.5 0 00-.44-1.06l-4.12-4.122A1.5 1.5 0 0011.378 2H4.5zm2.25 8.5a.75.75 0 000 1.5h6.5a.75.75 0 000-1.5h-6.5zm0 3a.75.75 0 000 1.5h6.5a.75.75 0 000-1.5h-6.5z" clipRule="evenodd" />
					</svg>
				);
			}
			const itemLine = (
				<div
					onClick={ () => onClick( item ) }
					className="pr-1 hover:bg-slate-100 cursor-pointer flex items-center"
					style={ {
						paddingLeft: `${ level * 25 }px`,
					} }
				>
					{ icon }
					<span className="ml-1">{ item.name }</span>
				</div>
			);
			if ( item.isExpanded && item.children ) {
				return (
					<li key={ item.name }>
						{ itemLine }
						{ treeDataToTreeComponents( item.children, onClick, level + 1 ) }
					</li>
				);
			}
			return (
				<li key={ item.name }>
					{ itemLine }
				</li>
			);
		} ) }
	</ul>
);
