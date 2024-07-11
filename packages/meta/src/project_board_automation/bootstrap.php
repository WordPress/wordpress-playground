<?php

/**
 * Turns a human-readable string into one that resembles an
 * identifier.
 * 
 * It removes quotes, lowercases the string, and replaces non-alphanumeric
 * characters with underscores. The quotes are removed to avoid slugifying
 * "Don't" into "don_t". We want "dont" instead.
 * 
 * @param mixed $string
 * @return string
 */
function slugify($string) {
	return strtolower(trim(preg_replace('/[^A-Za-z0-9-]+/', '_', str_replace(["'", '"'], '', $string))));
}

require_once __DIR__ . '/GitHubApi.php';
require_once __DIR__ . '/PlaygroundAutomationLogic.php';
