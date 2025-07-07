async function boot() {
	const { fetchMindmapData } = await import('./fetch-mindmap-data.js');
	const isLocalhost =
		window.location.hostname === 'localhost' ||
		window.location.hostname === '127.0.0.1';
	let mindmapData = null;
	if (localStorage.getItem('mindmapData')) {
		mindmapData = JSON.parse(localStorage.getItem('mindmapData'));
	} else {
		mindmapData = await fetchMindmapData();
		localStorage.setItem('mindmapData', JSON.stringify(mindmapData));
	}

	const width = window.innerWidth;
	const height = window.innerHeight;

	const svg = d3
		.select('#mindmap')
		.append('svg')
		.attr(
			'xmlns:mydata',
			'https://playground.wordpress.net/svg-namespaces/mydata'
		)
		.attr('width', width)
		.attr('height', height)
		.style('background', 'white');

	const g = svg
		.append('g')
		.attr('transform', `translate(${width / 2},${height / 2})`); // Centering the root node

	const zoom = d3
		.zoom()
		.scaleExtent([0.1, 4])
		.on('zoom', function (event) {
			g.attr('transform', event.transform);
		});

	svg.call(zoom).call(
		zoom.transform,
		d3.zoomIdentity.translate(width / 2, height / 2)
	);

	const root = d3.hierarchy(mindmapData);
	const treeLayout = d3
		.tree()
		.size([2 * Math.PI, width / 2 - 100])
		.separation((a, b) => (a.parent === b.parent ? 1 : 2) / a.depth);

	treeLayout(root);

	const toClassName = (str) => {
		if (!str) {
			return '';
		}
		return str.toLowerCase().replace(/[^a-zA-Z0-9\-]/g, '-');
	};

	const link = g
		.selectAll('.link')
		.data(root.links())
		.enter()
		.append('line')
		.attr('class', 'link')
		.attr('x1', (d) => radialPoint(d.source.x, d.source.y)[0])
		.attr('y1', (d) => radialPoint(d.source.x, d.source.y)[1])
		.attr('x2', (d) => radialPoint(d.target.x, d.target.y)[0])
		.attr('y2', (d) => radialPoint(d.target.x, d.target.y)[1]);

	const node = g
		.selectAll('.node')
		.data(root.descendants())
		.enter()
		.append('g')
		.attr('class', (d) =>
			[
				'node',
				toClassName(d.data.key),
				d.data.state === 'OPEN' ? 'open' : 'closed',
			].join(' ')
		)
		.attr(
			'transform',
			(d) =>
				`translate(${radialPoint(d.x, d.y)[0]},${
					radialPoint(d.x, d.y)[1]
				})`
		);

	const maxTitleLength = 30;
	let asTitle = (title) =>
		title.substring(0, maxTitleLength) +
		(title.length > maxTitleLength ? '...' : '');
	node.append('rect')
		.attr('width', (d) => asTitle(d.data.title).length * 8 + 20) // Dynamically set width based on text length
		.attr('height', 30)
		.attr('x', (d) => -(asTitle(d.data.title).length * 8 + 20) / 2) // Center the rectangle
		.attr('y', -15)
		.on('click', handleHighlight);

	node.append('a')
		.attr('xlink:href', (d) => d.data.url) // Assuming href is based on node name
		.attr('target', '_blank')
		.append('text')
		.attr('dy', 5)
		.attr('text-anchor', 'middle')
		.text((d) => asTitle(d.data.title));

	// ==== Details popup ====
	// const visiblePopups = [];
	// function handleClick(event, d) {
	//     const clickedNode = d3.select(this);
	//     if (clickedNode.select("foreignObject").size() > 0) {
	//         const child = clickedNode.select("foreignObject");
	//         child.remove();
	//         if(visiblePopups.includes(child)) {
	//             visiblePopups.splice(visiblePopups.indexOf(child), 1);
	//         }
	//         return;
	//     }

	//     while (visiblePopups.length > 0) {
	//         visiblePopups.pop().remove();
	//     }

	//     const foreignContent = clickedNode.append("foreignObject")
	//         .attr("width", d => d.data.name.length * 8 + 20) // Dynamically set width based on text length
	//         .attr("height", 30)
	//         .attr("x", d => -(d.data.name.length * 8 + 20) / 2) // Center the rectangle
	//         .attr("y", 15); // Position below the current rect

	//     foreignContent.append("xhtml:div")
	//         .style("width", "100%")
	//         .style("height", "100%")
	//         .html("<p>Foreign Content</p>");
	//     visiblePopups.push(foreignContent);
	// }

	// ==== Highlight part of the mindmap ====
	function* iterNodes(node) {
		yield node;
		if (node.children) {
			for (const child of node.children) {
				yield child;
				yield* iterNodes(child);
			}
		}
	}
	function handleHighlight(event, node) {
		if (
			d3
				.selectAll(`.node.${toClassName(node.data.key)}`)
				.classed('highlighted-main')
		) {
			clearHighlights();
			return;
		}
		clearHighlights();

		d3.selectAll(`.node.${toClassName(node.data.key)}`).classed(
			'highlighted-main',
			true
		);

		const tree = new Set(iterNodes(mindmapData));
		const subtree = new Set(iterNodes(node.data));
		if (subtree.size) {
			const subTreeClasses = [...subtree].map((d) => toClassName(d.key));
			const subTreeSelector = subTreeClasses
				.map((d) => `.node.${d}`)
				.join(', ');
			d3.selectAll(subTreeSelector).classed('highlighted', true);
		}

		const restOfTree = new Set([...tree].filter((x) => !subtree.has(x)));
		if (restOfTree.size) {
			const restOfTreeClasses = [...restOfTree].map((d) =>
				toClassName(d.key)
			);
			const restOfTreeSelector = restOfTreeClasses
				.map((c) => `.node.${c}`)
				.join(', ');
			d3.selectAll(restOfTreeSelector).classed('dimmed', true);
		}
	}

	function clearHighlights() {
		d3.selectAll(`.node`)
			.classed('dimmed', false)
			.classed('highlighted', false)
			.classed('highlighted-main', false);
	}

	let currentTransform = d3.zoomIdentity;

	svg.call(zoom).on('zoom', function (event) {
		svg.attr('transform', event.transform);
		currentTransform = event.transform;
	});

	function radialPoint(x, y) {
		return [y * Math.cos(x - Math.PI / 2), y * Math.sin(x - Math.PI / 2)];
	}

	const refreshButton = document.createElement('button');
	refreshButton.innerText = 'Refresh Data';
	refreshButton.style.position = 'absolute';
	refreshButton.style.top = '10px';
	refreshButton.style.right = '10px';
	refreshButton.addEventListener('click', () => {
		localStorage.removeItem('mindmapData');
		location.reload();
	});
	document.body.appendChild(refreshButton);
}
boot();
