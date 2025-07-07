const shouldRebuild =
	new URLSearchParams(window.location.search).get('rebuild') === 'true';

let __moduleGithubToken = localStorage.getItem('GITHUB_TOKEN');
const repos = [
	'wordpress/wordpress-playground',
	'wordpress/playground-tools',
	'wordpress/blueprints',
	'wordpress/blueprints-library',
	'adamziel/playground-docs-workflow',
	'adamziel/site-transfer-protocol',
];

const comparableKey = (str) => str.toLowerCase();

const graphqlQuery = async (query, variables) => {
	const headers = {
		'Content-Type': 'application/json',
	};
	if (__moduleGithubToken) {
		headers['Authorization'] = `Bearer ${__moduleGithubToken}`;
	}
	const response = await fetch('https://api.github.com/graphql', {
		method: 'POST',
		headers,
		body: JSON.stringify({ query, variables }),
	});
	return response.json();
};

async function* iterateIssuesPRs(repo, labels = []) {
	const query = `
        query GetProjects($cursor: String!, $query: String!) {
            search(query: $query, first: 100, type: ISSUE, after: $cursor) {
                pageInfo {
                    hasNextPage
                    endCursor
                }
                edges {
                    node {
                        ... on Issue {
                            number
                            title
                            url
                            body
                            state
                            repository {
                                nameWithOwner
                            }
                            labels(first: 10) {
                                nodes {
                                    name
                                }
                            }
                        }
                        ... on PullRequest {
                            number
                            title
                            url
                            body
                            state
                            repository {
                                nameWithOwner
                            }
                            labels(first: 10) {
                                nodes {
                                    name
                                }
                            }
                        }
                    }
                }
            }
        }
    `;

	let cursor = '';
	do {
		const labelQuery = labels.map((label) => `"${label}"`).join(',');
		const variables = {
			cursor,
			query:
				`repo:${repo}` + (labels.length ? ` label:${labelQuery}` : ''),
		};

		const response = await graphqlQuery(query, variables);
		const edges = response.data.search.edges;
		for (const edge of edges) {
			if (edge.node) {
				const item = edge.node;
				const key = comparableKey(
					`${item.repository.nameWithOwner}#${item.number}`
				);
				item.key = key;
				item.title = item.title.trim().replace(/^Tracking: /, '');
				yield edge.node;
			}
		}
		if (!response.data.search.pageInfo.hasNextPage) {
			break;
		}
		cursor = response.data.search.pageInfo.endCursor;
	} while (true);
}

const nodesCacheKey = 'nodes_cache';

const fetchData = async () => {
	let allNodes = {};
	const allNodesArray = [];
	for (const repo of repos) {
		for await (const item of iterateIssuesPRs(repo)) {
			allNodes[item.key] = item;
		}
		for await (const item of iterateIssuesPRs(repo, [
			'[Type] Mindmap Node',
			'[Type] Mindmap Tree',
		])) {
			allNodes[item.key] = item;
		}
	}
	return allNodes;
};

const getConnectedNodes = (issue) => {
	const currentRepo = issue.repository.nameWithOwner;
	let connections = [];

	const regex1 =
		/\bhttps:\/\/github.com\/([^\/]+)\/([^\/]+)\/(?:issues|pull)\/(\d+)\b/g;
	const regex2 = /\b#(\d+)\b/g;
	let match;

	while ((match = regex1.exec(issue.body)) !== null) {
		connections.push(`${match[1]}/${match[2]}#${match[3]}`);
	}

	while ((match = regex2.exec(issue.body)) !== null) {
		connections.push(`${currentRepo}#${match[1]}`);
	}

	return connections.map(comparableKey);
};

const buildEdges = ({ allNodes, rootKey, isEdge }) => {
	const seen = {};
	const allEdges = {};

	const preorderTraversal = (currentNode) => {
		const relatedIssueKeys = getConnectedNodes(currentNode).filter(
			(edgeKey) => isEdge(currentNode.key, edgeKey)
		);

		for (const relatedKey of relatedIssueKeys) {
			if (!allNodes[relatedKey]) continue;
			if (seen[relatedKey]) continue;
			seen[relatedKey] = true;

			if (!allEdges[currentNode.key]) {
				allEdges[currentNode.key] = [];
			}

			allEdges[currentNode.key].push(relatedKey);
			preorderTraversal(allNodes[relatedKey]);
		}
	};

	preorderTraversal(allNodes[rootKey]);
	return allEdges;
};

const buildTree = (allNodes, allEdges, rootKey) => {
	const node = { ...allNodes[rootKey] };
	const childrenKeys = allEdges[rootKey] || [];
	node.children = childrenKeys.map((childKey) =>
		buildTree(allNodes, allEdges, childKey)
	);
	return node;
};

export const fetchMindmapData = async ({ githubToken } = {}) => {
	if (githubToken) {
		__moduleGithubToken = githubToken;
	}

	const allNodes = await fetchData();
	const isEdge = (fromKey, toKey) => {
		if (mindmapTrees[fromKey]) {
			return true;
		}
		if (mindmapNodes[fromKey] && mindmapNodes[toKey]) {
			return true;
		}
		return false;
	};

	const mindmapTrees = {};
	const mindmapNodes = {};
	for (const key in allNodes) {
		if (
			allNodes[key].labels.nodes.some(
				(label) => label.name === '[Type] Mindmap Tree'
			)
		) {
			mindmapTrees[key] = allNodes[key];
			mindmapNodes[key] = allNodes[key];
		} else if (
			allNodes[key].labels.nodes.some(
				(label) => label.name === '[Type] Mindmap Node'
			)
		) {
			mindmapNodes[key] = allNodes[key];
		}
	}

	const rootKey = 'wordpress/wordpress-playground#525';
	const allEdges = buildEdges({
		allNodes,
		rootKey,
		isEdge,
	});
	const tree = buildTree(allNodes, allEdges, rootKey);
	console.log({
		allNodes,
		tree,
	});

	return tree;
};
