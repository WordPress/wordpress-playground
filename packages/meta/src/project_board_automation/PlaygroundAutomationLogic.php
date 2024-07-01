<?php

class PlaygroundAutomationLogic {

    private $projectId = '';
    private $statusFieldId = '';
    private $githubIds = [];
    /**
     * 
     * Human-readable name of the "Needs Author's Reply" option in
     * the GitHub Project's "Status" field.
     * 
     * For consistency, it should match with the label's name, but
     * there are no hard technical requirements for this.
     * 
     * @var string
     */
    private $needsAuthorReplyStatusText = "Needs Author's Reply"; 
    /**
     * 
     * Human-readable name of the "Needs Author's Reply" label across
     * all the repositories tracked in the GitHub project.
     * 
     * For consistency, it should match with the project's "Status" field
     * option's value, but there are no hard technical requirements for this.
     * 
     * @var string
     */
    private $needsAuthorReplyLabelText = "Needs Author's Reply";

    public function __construct(
        private GitHubApi $githubApi,
    ) {
        $this->githubIds = require __DIR__ . '/github_ids.php';
        $this->projectId = $this->githubIds['project_id'];
        $this->statusFieldId = $this->githubIds['fields']['status']['id'];
    }

    public function closeAndArchiveNotDoingCard($projectItem)
    {
        if(
            !$this->hasStatus($projectItem, 'Not Doing')
        ) {
            return false;
        }
        $this->githubApi->closeIssue($projectItem['content']['id']);
        $this->githubApi->removeItemFromProject($this->projectId, $projectItem['id']);
        return true;
    }

    public function moveFutureWorkCardsToRoadmap($projectItem)
    {
        if(
            !$this->hasStatus($projectItem, 'Future Work')
        ) {
            return false;
        }
        $this->githubApi->setFieldValueById(
            $this->projectId,
            $projectItem['id'],
            $this->statusFieldId,
            $this->githubIds['fields']['status']['options']['on_the_roadmap']
        );
        return true;
    }

    /**
     * Find all cards with Status = "Needs author reply". If they do not
     * have a "Needs author reply" label, add it.
     */
    public function addNeedsAuthorReplyLabelToANewItemWithThatStatus($projectItem)
    {
        if(
            !$this->hasStatus($projectItem, $this->needsAuthorReplyStatusText) || 
            $this->hasLabel($projectItem, $this->needsAuthorReplyLabelText)
        ) {
            return false;
        }
        $this->githubApi->addLabelByName(
            $projectItem['content']['id'],
            $this->needsAuthorReplyLabelText
        );
        return true;
    }
    
    public function iterateProjectItems()
    {
        yield from $this->githubApi->iterateProjectItems($this->projectId);
    }

    /**
     * Find all cards with "Needs author reply" label. If any comments have
     * been added since the last time that label was added, remove the label 
     * and clear the "Status" field.
     */
    public function moveBackToInboxAfterAuthorsReply($projectItem)
    {
        // Process items that have **either** the status or the label.
        // The author could have replied after the status was set, but before
        // we had a chance to add a label.
        if(
            !$this->hasStatus($projectItem, $this->needsAuthorReplyStatusText) && 
            !$this->hasLabel($projectItem, $this->needsAuthorReplyLabelText)
        ) {
            return false;
        }
        
        $issueOrPrId = $projectItem['content']['id'];
        $result = $this->checkIfAuthorRepliedAfterLabelWasCreated($issueOrPrId);

        if (!$result['author_replied']) {
            return false;
        }

        // Only remove the label if there was a label in the first place.
        // The author may have replied after the status was set, but before
        // we had a chance to add a label.
        if (null !== $result['label_id']) {
            $this->githubApi->removeLabelById($issueOrPrId, $result['label_id']);
        }
        $this->githubApi->setFieldValueById(
            $this->projectId,
            $projectItem['id'],
            $this->statusFieldId,
            // null means we're clearing the status field
            null
        );
        return true;
    }

    private function hasStatus($projectItem, $statusText)
    {
        $status = GitHubApi::extractProjectItemFieldValueById(
            $projectItem,
            $this->statusFieldId
        );
        return $status && slugify($status['name']) === slugify($statusText);
    }

    private function hasLabel($projectItem, $labelText) {
        return GitHubApi::extractProjectItemHasLabelByName(
            $projectItem,
            $labelText
        );
    }

    public function checkIfAuthorRepliedAfterLabelWasCreated($issueOrPrId)
    {
        $hasLabel = GitHubApi::extractProjectItemHasLabelByName(
            $this->githubApi->getProjectItemForIssueId($this->projectId, $issueOrPrId),
            $this->needsAuthorReplyLabelText
        );
        $timeline = array_reverse($this->getTimelineItemsForIssueOrPr($issueOrPrId));

        // If the item doesn't have the label, we check if there was
        // a comment submitted since the last status change.
        if(!$hasLabel) {
            $fieldValue = GitHubApi::extractProjectItemFieldValueById(
                $this->githubApi->getProjectItemForIssueId($this->projectId, $issueOrPrId),
                $this->statusFieldId
            );
            $statusUpdatedAt = new DateTime($fieldValue['updatedAt']);

            $comment_seen = false;
            foreach ($timeline as $event) {
                if (!isset($event['node']['__typename'])) {
                    continue;
                }
                if(!isset($event['node']['createdAt'])) {
                    continue;
                }
                $createdAt = new DateTime($event['node']['createdAt']);
                // We've processed all the timeline events after the
                // last status change and we haven't found a comment.
                // We're done.
                if ($createdAt <= $statusUpdatedAt) {
                    break;
                }

                if ($event['node']['__typename'] === 'IssueComment') {
                    return [
                        'author_replied' => true,
                        'label_id' => null
                    ];
                }
            }

            return [
                'author_replied' => false
            ];
        }

        $comment_seen = false;
        foreach($timeline as $event) {
            if(!isset($event['node']['__typename'])) {
                continue;
            }
            if ($event['node']['__typename'] === 'IssueComment') {
                $comment_seen = true;
            } else if (
                $event['node']['__typename'] === 'LabeledEvent' &&
                slugify($event['node']['label']['name']) === slugify($this->needsAuthorReplyLabelText)
            ) {
                // If a comment was already seen, we assume the author replied.
                // Note we are iterating in reverse order, so that comment
                // must have been created **after** the label was added.
                //
                // Also note we don't filter for author specifically. Any comment is enough
                // to put this item back in the inbox. The next person reviewing the
                // inbox may always punt it back to the "Needs author's reply" column
                // if needed.
                return [
                    'author_replied' => $comment_seen,
                    'label_id' => $event['node']['label']['id']
                ];
            } 
        }
        return [
            'author_replied' => false
        ];
    }

    public function getTimelineItemsForIssueOrPr($issueOrPrId)
    {
        $query = <<<'GRAPHQL'
            query($objectId: ID!) {
                node(id: $objectId) {
                    ... on Issue {
                        timelineItems(last: 100) {
                            edges {
                                node {
                                    __typename
                                    ... on LabeledEvent {
                                        createdAt
                                        label {
                                            id
                                            name
                                        }
                                    }
                                    ... on IssueComment {
                                        createdAt
                                        body
                                    }
                                }
                            }
                        }
                    }
                    ... on PullRequest {
                        timelineItems(last: 100) {
                            edges {
                                node {
                                    __typename
                                    ... on LabeledEvent {
                                        createdAt
                                        label {
                                            id
                                            name
                                        }
                                    }
                                    ... on IssueComment {
                                        createdAt
                                        body
                                    }
                                }
                            }
                        }
                    }
                }
            }
        GRAPHQL;
        $response = $this->githubApi->graphqlQuery($query, [
            'objectId' => $issueOrPrId,
        ]);
        return $response['data']['node']['timelineItems']['edges'];
    }

}