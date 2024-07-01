<?php

require_once __DIR__ . '/../src/project_board_automation/bootstrap.php';

echo "Processing GitHub project items...\n";

$exit_status = 0;

$githubApi = new GitHubApi( getenv( 'GITHUB_TOKEN' ) );
$automation = new PlaygroundAutomationLogic($githubApi);
foreach($automation->iterateProjectItems() as $projectItem) {
    if(!isset($projectItem['content']['repository']['nameWithOwner'])) {
        continue;
    }

    try {
        $humanIssueName = (
            $projectItem['content']['repository']['nameWithOwner'] .
            "#" .
            $projectItem['content']['number'] .
            ' (' .
            $projectItem['content']['title'] .
            ')'
        );

        if ($automation->closeAndArchiveNotDoingCard($projectItem)) {
            echo "– Closing and removing \"Not Doing\" card from the board: $humanIssueName\n";
            continue;
        }

        if ($automation->moveFutureWorkCardsToRoadmap($projectItem)) {
            echo "– Moving \"Future Work\" cards to \"On the roadmap\" to hide them from the high-velocity views on the board: $humanIssueName\n";
            continue;
        }

        if ($automation->moveBackToInboxAfterAuthorsReply($projectItem)) {
            echo "– Author replied – moving the card back to inbox: $humanIssueName\n";
            continue;
        }

        if ($automation->addNeedsAuthorReplyLabelToANewItemWithThatStatus($projectItem)) {
            echo "– Adding \"Need Author's reply\" label to: $humanIssueName\n";
            continue;
        }
    } catch (Exception $e) {
        echo "Error processing card: $humanIssueName\n";
        echo $e->getMessage() . "\n";
        echo "Skipping that one and continuing...\n";
        echo "\n";
        $exit_status = 1;
    }
}

echo "Done!\n";
echo "\n";

if($exit_status !== 0) {
    echo "There were errors. Please check the output above.\n";
}
exit($exit_status);
