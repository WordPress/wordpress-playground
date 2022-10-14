<?php

// The Origin-Agent-Cluster hints the browser to allocate a separate
// process for this document. It makes WordPress noticeably faster.
header('Origin-Agent-Cluster: ?1');

echo file_get_contents('iframe-worker.html');
