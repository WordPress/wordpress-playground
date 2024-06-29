#!/bin/bash

phpunit ./tests/ProxyFunctionsTests.php

fswatch -o *.php ./tests/*.php | while read; do
    # Clear the terminal
    clear
    # Run the phpunit tests
    phpunit ./tests/ProxyFunctionsTests.php
done
