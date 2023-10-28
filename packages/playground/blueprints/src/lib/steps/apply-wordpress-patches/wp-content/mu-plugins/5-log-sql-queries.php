<?php

function playground_report_queries($query)
{
    post_message_to_js(json_encode([
        'type' => 'sql',
        'query' => $query,
    ]));
    return $query;
}
add_filter('query', 'playground_report_queries', -1000);
