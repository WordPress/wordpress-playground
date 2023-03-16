// if (query.has('ide')) {
// 	let doneFirstBoot = false;
// 	const { WordPressPluginIDE, createBlockPluginFixture } = await import(
// 		'@wp-playground/plugin-ide'
// 	);
// 	const { default: React } = await import('react');
// 	const {
// 		default: { render },
// 	} = await import('react-dom');
// 	render(
// 		<WordPressPluginIDE
// 			plugin={createBlockPluginFixture}
// 			workerThread={playground}
// 			initialEditedFile="edit.js"
// 			reactDevUrl="/assets/react.development.js"
// 			reactDomDevUrl="/assets/react-dom.development.js"
// 			fastRefreshScriptUrl="/assets/setup-react-refresh-runtime.js"
// 			onBundleReady={async (bundleContents: string) => {
// 				if (doneFirstBoot) {
// 					(wpFrame.contentWindow as any).eval(bundleContents);
// 				} else {
// 					doneFirstBoot = true;
// 					await playground.goTo(query.get('url') || '/');
// 				}
// 			}}
// 		/>,
// 		document.getElementById('test-snippets')!
// 	);
// } else {
// 	await playground.goTo(query.get('url') || '/');
// }
