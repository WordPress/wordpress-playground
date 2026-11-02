#!/bin/bash
set -e

phpunit
php tests/e2e/cors-proxy-e2e-test.php
