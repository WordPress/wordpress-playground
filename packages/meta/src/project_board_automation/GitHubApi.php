<?php

class GitHubApi {
	private $token;

	public function __construct( $token ) {
		if(!$token) {
			throw new Exception('GitHub token is required');
		}
		$this->token = $token;
	}

	public function graphqlQuery( $query, $variables = [], $json_assoc = true ) {
		$ch = curl_init();
		curl_setopt( $ch, CURLOPT_URL, "https://api.github.com/graphql" );
		curl_setopt( $ch, CURLOPT_RETURNTRANSFER, 1 );
		curl_setopt( $ch, CURLOPT_POST, 1 );
		curl_setopt( $ch, CURLOPT_POSTFIELDS, json_encode( [ 'query' => $query, 'variables' => $variables ] ) );
		curl_setopt( $ch, CURLOPT_HTTPHEADER, [
			'Authorization: Bearer ' . $this->token,
			'Content-Type: application/json',
			'User-Agent: GitHub-Webhook-Handler',
		] );
		$response = curl_exec( $ch );
		curl_close( $ch );
		$response_data = json_decode( $response, $json_assoc );
		if ($json_assoc) {
			if (isset($response_data['errors']) || (isset($response['status']) && $response['status'] !== 200)) {
				var_dump($response_data);
				throw new Exception('GraphQL query failed');
			}
		} else {
			if (isset($response_data->errors) || (isset($response->status) && $response->status !== 200)) {
				var_dump($response_data);
				throw new Exception('GraphQL query failed');
			}
		}

		return $response_data;
	}

	public function getIssueIdForProjectItemId( $projectItemId ) {
		$query     = <<<'GRAPHQL'
        query($projectItemId: ID!) {
            node(id: $projectItemId) {
                ... on ProjectV2Item {
                    content {
                        ... on Issue {
                            id
                            number
                        }
                        ... on PullRequest {
                            id
                            number
                        }
                    }
                }
            }
        }
        GRAPHQL;
		$variables = [
			'projectItemId' => $projectItemId,
		];
		$response  = $this->graphqlQuery( $query, $variables );
		return $response['data']['node']['content']['id'];
	}


	public function getProjectItemForIssueId($projectId, $issueId)
	{
		$items = $this->graphqlQuery(
			self::FRAGMENT_BASIC_PROJECT_INFO[1] .
			<<<'Q'
			query($id: ID!) {
				node(id: $id) {
					... on Issue {
						id
						projectItems(first:50) {
							nodes {
								...BasicProjectInfo
								project {
									id
								}
							}
						}
					}
					... on PullRequest {
						id
						projectItems(first:50) {
							nodes {
								...BasicProjectInfo
								project {
									id
								}
							}
						}
					}
				}
			}
		Q, [
			'id' => $issueId
		]);
		foreach($items['data']['node']['projectItems']['nodes'] as $projectItem) {
			if($projectItem['project']['id'] === $projectId) {
				return $projectItem;
			}
		}
		return null; // Return null if the issue ID is not found
	}

	static public function extractProjectItemHasLabelByName($projectItem, $labelName)
	{
		$labelField = self::extractProjectItemFieldValueByName($projectItem, 'Labels');
		if(!isset($labelField['labels']['nodes'])) {
			return false;
		}
		foreach($labelField['labels']['nodes'] as $label) {
			// Slugify to avoid derailing this script on cosmetic
			// updates in label names.
			if(slugify($label['name']) === slugify($labelName)) {
				return true;
			}
		}
		return false;
	
	}

	static public function extractProjectItemFieldValueByName($projectItem, $fieldName) {
		var_dump($projectItem);
		foreach($projectItem['fieldValues']['nodes'] as $fieldValue) {
			if(isset($fieldValue['field']['name']) && $fieldValue['field']['name'] === $fieldName) {
				return $fieldValue;
			}
		}
	}

	static public function extractProjectItemFieldValueById($projectItem, $fieldId) {
		foreach($projectItem['fieldValues']['nodes'] as $fieldValue) {
			if(isset($fieldValue['field']['id']) && $fieldValue['field']['id'] === $fieldId) {
				return $fieldValue;
			}
		}
	}

	public function iterateProjectItems($projectId, $fragment=self::FRAGMENT_BASIC_PROJECT_INFO)
	{
		$perPage = 100;
		$query = 
			$fragment[1] .
			<<<GRAPHQL
			query(\$projectId: ID!, \$perPage: Int, \$cursor: String) {
				node(id: \$projectId) {
					... on ProjectV2 {
						items(first: \$perPage, after: \$cursor) {
							edges {
								cursor
								node {
									...{$fragment[0]}
								}
							}
						}
					}
				}
			}
			GRAPHQL;

		$cursor = '';
		do {
			$variables = [
				'projectId' => $projectId,
				'perPage' => $perPage,
				'cursor' => $cursor
			];

			// Assuming you have a function `executeGraphQL` to call the GraphQL API
			$response = $this->graphqlQuery($query, $variables);
			$edges = $response['data']['node']['items']['edges'];
			foreach($edges as $edge) {
				yield $edge['node'];
				$cursor = $edge['cursor'];
			}
		} while(count($edges) === $perPage);
	}


	public function hasLabel($issueId, $labelName)
	{
		$repoId = $this->getRepoIdForIssueId($issueId);
		$labelId = $this->getLabelIdByName($repoId, $labelName);
		if (!$labelId) {
			return false;
		}

		$query = <<<'GRAPHQL'
		query($issueId: ID!) {
			node(id: $issueId) {
				... on Issue {
					labels(first: 10) {
						nodes {
							id
							name
						}
					}
				}
				... on PullRequest {
					labels(first: 10) {
						nodes {
							id
							name
						}
					}
				}
			}
		}
		GRAPHQL;
		$variables = [
			'issueId' => $issueId,
		];
		$response = $this->graphqlQuery($query, $variables);
		$labels = $response['data']['node']['labels']['nodes'];
		foreach ($labels as $label) {
			if ($label['name'] === $labelName) {
				return true;
			}
		}

		return false;
	}

	public function addLabelByName( $issueId, $labelName )
	{
		$repoId = $this->getRepoIdForIssueId($issueId);
		$labelId = $this->getOrCreateLabel($repoId, $labelName);
		return $this->addLabelById( $issueId, $labelId );
	}

	public function addLabelById( $issueId, $labelId )
	{
		$mutation  = <<<'GRAPHQL'
		mutation($issueId: ID!, $labelId: ID!) {
			addLabelsToLabelable(input: {labelableId: $issueId, labelIds: [$labelId]}) {
				labelable {
					... on Issue {
						id
						labels(first: 10) {
							nodes {
								id
								name
							}
						}
					}
					... on PullRequest {
						id
						labels(first: 10) {
							nodes {
								id
								name
							}
						}
					}
				}
			}
		}
		GRAPHQL;
		$variables = [
			'issueId' => $issueId,
			'labelId' => $labelId,
		];

		return $this->graphqlQuery( $mutation, $variables );
	}

	public function removeLabelByName( $issueId, $labelName )
	{
		$repoId = $this->getRepoIdForIssueId($issueId);
		$labelId = $this->getLabelIdByName($repoId, $labelName);
		return $this->removeLabelById( $issueId, $labelId );
	}

	public function removeLabelById( $issueId, $labelId )
	{
		$mutation  = <<<'GRAPHQL'
		mutation($issueId: ID!, $labelId: ID!) {
			removeLabelsFromLabelable(input: {labelableId: $issueId, labelIds: [$labelId]}) {
				labelable {
					... on Issue {
						id
						labels(first: 10) {
							nodes {
								id
								name
							}
						}
					}
					... on PullRequest {
						id
						labels(first: 10) {
							nodes {
								id
								name
							}
						}
					}
				}
			}
		}
		GRAPHQL;
		$variables = [
			'issueId' => $issueId,
			'labelId' => $labelId,
		];

		return $this->graphqlQuery( $mutation, $variables );
	}

	public function getRepoIdForIssueId( $issueId ) {
		$query     = <<<'GRAPHQL'
        query($issueId: ID!) {
            node(id: $issueId) {
                ... on Issue {
                    repository {
                      id
                    }
                }
                ... on PullRequest {
                    repository {
                      id
                    }
                }
            }
        }
        GRAPHQL;
		$variables = [
			'issueId' => $issueId,
		];
		$response  = $this->graphqlQuery( $query, $variables );
		if(isset($response['data']['node']['repository']['id'])) {
			return $response['data']['node']['repository']['id'];
		}

		return null;
	}

	public function getOrCreateLabel($repoId, $labelName)
	{
		$labelId = $this->getLabelIdByName($repoId, $labelName);
		if ($labelId) {
			return $labelId;
		}

		$mutation  = <<<'GRAPHQL'
		mutation($repoId: ID!, $labelName: String!) {
			createLabel(input: {repositoryId: $repoId, name: $labelName, color: "000000"}) {
				label {
					id
				}
			}
		}
		GRAPHQL;
		$variables = [
			'repoId'    => $repoId,
			'labelName' => $labelName,
		];

		$response = $this->graphqlQuery( $mutation, $variables );
		return $response['data']['createLabel']['label']['id'];
	}

	public function getLabelIdByName($repoId, $labelName)
	{
		$query = <<<'GRAPHQL'
			query($repoId: ID!, $cursor: String) {
				node(id: $repoId) {
					... on Repository {
						labels(first: 100, after: $cursor) {
							nodes {
								id
								name
							}
							pageInfo {
								hasNextPage
								endCursor
							}
						}
					}
				}
			}
		GRAPHQL;

		$variables = [
			'repoId' => $repoId,
		];

		$labelId = null;
		do {
			$response = $this->graphqlQuery($query, $variables);
			$labels = $response['data']['node']['labels']['nodes'];
			foreach ($labels as $label) {
				if ($label['name'] === $labelName) {
					$labelId = $label['id'];
					break 2; // Exit both the foreach and do-while loop
				}
			}
			$hasNextPage = $response['data']['node']['labels']['pageInfo']['hasNextPage'];
			$variables['cursor'] = $response['data']['node']['labels']['pageInfo']['endCursor'];
			var_dump($variables);
		} while ($hasNextPage);

		return $labelId;
	}

	public function commentOnIssue( $issueId, $comment ) {
		$mutation  = <<<'GRAPHQL'
        mutation($issueId: ID!, $body: String!) {
            addComment(input: {subjectId: $issueId, body: $body}) {
                commentEdge {
                    node {
                        id
                    }
                }
            }
        }
        GRAPHQL;
		$variables = [
			'issueId' => $issueId,
			'body'    => $comment,
		];

		return $this->graphqlQuery( $mutation, $variables );
	}

	public function closeIssue( $issueId ) {
		$mutation  = <<<'GRAPHQL'
        mutation($issueId: ID!) {
            closeIssue(input: {issueId: $issueId}) {
                issue {
                    id
                }
            }
        }
        GRAPHQL;
		$variables = [
			'issueId' => $issueId,
		];

		return $this->graphqlQuery( $mutation, $variables );
	}

	public function archiveCard( $projectId, $itemId ) {
		$mutation  = <<<'GRAPHQL'
        mutation($projectId: ID!, $itemId: ID!) {
            archiveProjectV2Item(input: {projectId: $projectId, itemId: $itemId}) {
                item {
                    id
                }
            }
        }
        GRAPHQL;
		$variables = [
			'itemId'    => $itemId,
			'projectId' => $projectId,
		];

		return $this->graphqlQuery( $mutation, $variables );
	}

	public function removeItemFromProject( $projectId, $itemId )
	{
		$mutation  = <<<'GRAPHQL'
		mutation($projectId: ID!, $itemId: ID!) {
			deleteProjectV2Item(input: {projectId: $projectId, itemId: $itemId}) {
				deletedItemId
			}
		}
		GRAPHQL;
		$variables = [
			'projectId' => $projectId,
			'itemId'    => $itemId,
		];

		return $this->graphqlQuery( $mutation, $variables );
	}

	public function getIssue($id)
	{
		$query = <<<'GRAPHQL'
		query($id: ID!) {
			node(id: $id) {
				... on Issue {
					id
					number
					title
					body
					state
					author {
						login
					}
					assignees(first: 10) {
						nodes {
							login
						}
					}
					labels(first: 10) {
						nodes {
							name
						}
					}
				}
				... on PullRequest {
					id
					number
					title
					body
					state
					author {
						login
					}
					assignees(first: 10) {
						nodes {
							login
						}
					}
					labels(first: 10) {
						nodes {
							name
						}
					}
				}
			}
		}
		GRAPHQL;
		$variables = [
			'id' => $id,
		];

		$response = $this->graphqlQuery($query, $variables);
		if(isset($response['data']['node'])) {
			return $response['data']['node'];
		}
	}

	public function getFieldValueByName( $projectItemId, $fieldName ) {
		$query     = <<<'GRAPHQL'
			query($projectItemId: ID!) {
				node(id: $projectItemId) {
					... on ProjectV2Item {
						id
						fieldValues(first: 10) {
							nodes {
								... on ProjectV2ItemFieldSingleSelectValue {
									field {
										... on ProjectV2SingleSelectField {
											name
										}
									}
									name
									id
								}
								... on ProjectV2ItemFieldLabelValue {
									labels(first: 20) {
										nodes {
											id
											name
										}
									}
								}
								... on ProjectV2ItemFieldTextValue {
									text
									id
									updatedAt
									creator {
										url
									}
								}
								... on ProjectV2ItemFieldMilestoneValue {
									milestone {
										id
									}
								}
								... on ProjectV2ItemFieldRepositoryValue {
									repository {
										id
										url
									}
								}
							}
						}
						content {
							... on Issue {
								id
							}
							... on PullRequest {
								id
							}
						}
			    	}
				}
			}
		GRAPHQL;

		$variables = [
			'projectItemId'    => $projectItemId,
		];


		$response = $this->graphqlQuery( $query, $variables );
		$fieldValues = $response['data']['node']['fieldValues']['nodes'];
		foreach($fieldValues as $fieldValue) {
			if(isset($fieldValue['field']['name']) && $fieldValue['field']['name'] === $fieldName) {
				return $fieldValue;
			}
		}

		return null;
	}

	public function setFieldValueById( $projectId, $cardId, $fieldId, $valueId ) {
		if(null === $valueId) {
			$mutation  = <<<'GRAPHQL'
			mutation($projectId: ID!, $cardId: ID!, $fieldId: ID!) {
				clearProjectV2ItemFieldValue(input: {projectId: $projectId, itemId: $cardId, fieldId: $fieldId}) {
					projectV2Item {
						id
					}
				}
			}
			GRAPHQL;
			$variables = [
				'projectId' => $projectId,
				'cardId'    => $cardId,
				'fieldId'   => $fieldId,
			];

			return $this->graphqlQuery( $mutation, $variables );
		}

		// Assume that 'status' is a custom field in the project
		$mutation  = <<<'GRAPHQL'
        mutation($projectId: ID!, $cardId: ID!, $fieldId: ID!, $valueId: String!) {
            updateProjectV2ItemFieldValue(input: {
                projectId: $projectId,
                itemId: $cardId,
                fieldId: $fieldId,
                value: {
                    singleSelectOptionId: $valueId
                }
            }) {
                projectV2Item {
                    id
                }
            }
        }
        GRAPHQL;
		$variables = [
			'projectId' => $projectId,
			'cardId'    => $cardId,
			'fieldId'   => $fieldId,
			'valueId'   => $valueId,
		];

		return $this->graphqlQuery( $mutation, $variables );
	}

	public function getProjects( $organization = 'WordPress' ) {
		$query = <<<'GRAPHQL'
    query($organization: String!) {
        organization(login: $organization) {
            projectsV2(first:100) {
                edges {
                    node {
                        id
                        title
                        closed
                    }
                }
            }
        }
    }
GRAPHQL;

		$response     = $this->graphqlQuery( $query, [
			'organization' => $organization,
		] );
		$projects     = $response['data']['organization']['projectsV2']['edges'];
		$openProjects = [];
		foreach ( $projects as $project ) {
			if ( ! $project['node']['closed'] ) {
				$openProjects[] = $project;
			}
		}

		return $openProjects;
	}

	public function getFieldsDefinitions( $projectId ) {
		$query = <<<'GRAPHQL'
    query($projectId: ID!) {
        node(id: $projectId) {
            ... on ProjectV2 {
                fields(first: 100) {
                    nodes {
                        ... on ProjectV2SingleSelectField {
                            id
                            name
                            options {
                                id
                                name
                            }
                        }
                    }
                }
            }
        }
    }
    GRAPHQL;

		$response = $this->graphqlQuery( $query, [
			'projectId' => $projectId,
		] );

		if ( ! isset( $response['data']['node']['fields']['nodes'] ) ) {
			return [];
		}
		$fields         = $response['data']['node']['fields']['nodes'];
		$nonEmptyFields = [];
		foreach ( $fields as $field ) {
			if ( $field ) {
				$nonEmptyFields[] = $field;
			}
		}

		return $nonEmptyFields;
	}

	public function getFieldIdAndValueByName( $projectId, $field_name, $field_value ) {
		$response = $this->getFieldsDefinitions( $projectId );

		if ( isset( $response['data']['node']['fields']['nodes'] ) ) {
			$fields = $response['data']['node']['fields']['nodes'];
			foreach ( $fields as $field ) {
				if ( $field && $field['name'] === $field_name ) {
					foreach ( $field['options'] as $option ) {
						if ( $option['name'] === $field_value ) {
							return [ $field['id'], $option['id'] ];
						}
					}
				}
			}
		}

		return [ null, null ];
	}

	public const FRAGMENT_EXTENDED_PROJECT_INFO = [
		'ExtendedProjectInfo',
		self::FRAGMENT_BASIC_PROJECT_INFO[1] .
		<<<'GRAPHQL'
		fragment ExtendedProjectInfo on ProjectV2Item {
			...BasicProjectInfo
			content {
				... on Issue {
					body
				}
				... on PullRequest {
					body
				}
			}
		}
		GRAPHQL
	];

	public const FRAGMENT_BASIC_PROJECT_INFO = [
		'BasicProjectInfo',
		<<<'GRAPHQL'
		fragment BasicProjectInfo on ProjectV2Item {
			id
			fieldValues(first: 10) {
				nodes {
					... on ProjectV2ItemFieldSingleSelectValue {
						field {
							... on ProjectV2SingleSelectField {
								id
								name
							}
						}
						updatedAt
						name
						id
					}
					... on ProjectV2ItemFieldLabelValue {
						field {
							... on ProjectV2Field {
								id
								name
							}
						}
						labels(first: 20) {
							nodes {
								id
								name
							}
						}
					}
					... on ProjectV2ItemFieldTextValue {
						field {
							... on ProjectV2Field {
								id
								name
							}
						}
						text
						id
						updatedAt
						creator {
							url
						}
					}
					... on ProjectV2ItemFieldMilestoneValue {
						field {
							... on ProjectV2Field {
								id
								name
							}
						}
						milestone {
							id
						}
					}
					... on ProjectV2ItemFieldRepositoryValue {
						field {
							... on ProjectV2Field {
								id
								name
							}
						}
						repository {
							id
							url
						}
					}
				}
			}
			content {
				... on Issue {
					id
					number
					title
					repository {
						nameWithOwner
					}
				}
				... on PullRequest {
					id
					number
					title
					repository {
						nameWithOwner
					}
				}
			}
		}
		GRAPHQL
	];

}
