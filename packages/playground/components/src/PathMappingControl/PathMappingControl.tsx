import React, { useEffect, useState } from 'react';
import {
	// @ts-expect-error
	__experimentalTreeGrid as TreeGrid,
	// @ts-expect-error
	__experimentalTreeGridRow as TreeGridRow,
	// @ts-expect-error
	__experimentalTreeGridCell as TreeGridCell,
	// @ts-expect-error
	__experimentalInputControl as InputControl,
	Button,
} from '@wordpress/components';
import { Icon, chevronRight, chevronDown } from '@wordpress/icons';
import '@wordpress/components/build-style/style.css';
import './style.css';

// Define the type for the file structure
// Define the type for the file structure
type FileNode = {
	name: string;
	type: 'file' | 'folder';
	children?: FileNode[];
};

type PathMappingFormProps = {
	files: FileNode[];
	initialState: MappingNodeStates;
	onMappingChange?: (mapping: PathMapping) => void;
};
type PathMapping = Record<string, string>;
type MappingNodeStates = Record<string, MappingNodeState>;

type MappingNodeState = {
	isOpen?: boolean;
	playgroundPath?: string;
};

const PathMappingControl: React.FC<PathMappingFormProps> = ({
	files,
	initialState = {},
	onMappingChange = () => {},
}) => {
	const [state, setState] = useState<MappingNodeStates>(initialState);

	const updatePathMapping = (
		path: string,
		state: Partial<MappingNodeState>
	) => {
		setState((prevState) => ({
			...prevState,
			[path]: {
				...prevState[path],
				...state,
			},
		}));
	};

	useEffect(() => {
		const pathMapping: PathMapping = {};
		Object.keys(state).forEach((path) => {
			if (state[path].playgroundPath) {
				pathMapping[path] = state[path].playgroundPath!;
			}
		});
		onMappingChange(pathMapping);
	}, [state]);

	const generatePath = (node: FileNode, parentPath = ''): string => {
		return parentPath
			? `${parentPath}/${node.name}`.replaceAll(/\/+/g, '/')
			: node.name;
	};

	return (
		<TreeGrid className="path-mapping-control">
			<TreeGridRow level={0} positionInSet={0} setSize={1}>
				<TreeGridCell>{() => <>File/Folder</>}</TreeGridCell>
				<TreeGridCell>
					{() => <>Absolute path in Playground</>}
				</TreeGridCell>
			</TreeGridRow>
			{files.map((file, index) => (
				<NodeRow
					key={file.name}
					node={file}
					level={0}
					position={index + 1}
					setSize={files.length}
					nodeStates={state}
					updateNodeState={updatePathMapping}
					generatePath={generatePath}
				/>
			))}
		</TreeGrid>
	);
};

const NodeRow: React.FC<{
	node: FileNode;
	level: number;
	position: number;
	setSize: number;
	nodeStates: MappingNodeStates;
	updateNodeState: (path: string, state: Partial<MappingNodeState>) => void;
	generatePath: (node: FileNode, parentPath?: string) => string;
	parentPath?: string;
	parentMapping?: string;
}> = ({
	node,
	level,
	position,
	setSize,
	nodeStates,
	updateNodeState,
	generatePath,
	parentPath = '',
	parentMapping = '',
}) => {
	const path = generatePath(node, parentPath);
	const nodeState = nodeStates[path] || { isOpen: false, playgroundPath: '' };
	const nodeMapping = computeMapping({
		node,
		nodeState,
		parentMapping,
	});

	const toggleOpen = () => {
		updateNodeState(path, { isOpen: !nodeState.isOpen });
	};

	const handlePathChange = (value: string) => {
		updateNodeState(path, { playgroundPath: value });
	};

	const handleKeyDown = (event: any) => {
		if (event.key === 'ArrowLeft') {
			if (nodeState.isOpen) {
				toggleOpen();
			} else {
				if (node.children?.length) {
					(
						document.querySelector(
							`[data-path="${parentPath}"]`
						) as HTMLButtonElement
					)?.focus();
				}
			}
			event.preventDefault();
			event.stopPropagation();
		} else if (event.key === 'ArrowRight') {
			if (nodeState.isOpen) {
				if (node.children?.length) {
					const firstChildPath = generatePath(node.children[0], path);
					(
						document.querySelector(
							`[data-path="${firstChildPath}"]`
						) as HTMLButtonElement
					)?.focus();
				}
			} else {
				toggleOpen();
			}
			event.preventDefault();
			event.stopPropagation();
		}
	};
	return (
		<>
			<TreeGridRow
				level={level}
				positionInSet={position}
				setSize={setSize}
			>
				<TreeGridCell>
					{() => (
						<Button
							onClick={toggleOpen}
							onKeyDown={handleKeyDown}
							className="file-node-button"
							data-path={path}
						>
							<FileName
								node={node}
								isOpen={
									node.type === 'folder' && nodeState.isOpen
								}
								level={level}
							/>
						</Button>
					)}
				</TreeGridCell>
				<TreeGridCell>
					{() => (
						<>
							<InputControl
								disabled={parentMapping}
								value={nodeMapping}
								onChange={handlePathChange}
								onDrag={function noRefCheck() {}}
								onDragEnd={function noRefCheck() {}}
								onDragStart={function noRefCheck() {}}
								onValidate={function noRefCheck() {}}
							/>
						</>
					)}
				</TreeGridCell>
			</TreeGridRow>
			{nodeState.isOpen &&
				node.children &&
				node.children.map((child, index) => (
					<NodeRow
						key={child.name}
						node={child}
						level={level + 1}
						position={index + 1}
						setSize={node.children!.length}
						nodeStates={nodeStates}
						updateNodeState={updateNodeState}
						generatePath={generatePath}
						parentPath={path}
						parentMapping={nodeMapping}
					/>
				))}
		</>
	);
};

function computeMapping({
	node,
	nodeState,
	parentMapping,
}: {
	node: FileNode;
	nodeState: MappingNodeState;
	parentMapping: string;
}): string {
	if (parentMapping) {
		return `${parentMapping}/${node.name}`.replace(/\/+/g, '/');
	}
	if (nodeState.playgroundPath) {
		return nodeState.playgroundPath;
	}
	return '';
}

const FileName: React.FC<{
	node: FileNode;
	level: number;
	isOpen?: boolean;
}> = ({ node, level, isOpen }) => {
	const indent: string[] = [];
	for (let i = 0; i < level; i++) {
		indent.push('&nbsp;&nbsp;&nbsp;&nbsp;');
	}
	return (
		<>
			<span
				aria-hidden="true"
				dangerouslySetInnerHTML={{ __html: indent.join('') }}
			></span>
			{node.type === 'folder' ? (
				<Icon width={16} icon={isOpen ? chevronDown : chevronRight} />
			) : (
				<div style={{ width: 16 }}>&nbsp;</div>
			)}
			{node.name}
		</>
	);
};

export default PathMappingControl;
