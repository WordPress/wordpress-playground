import WPNow from "./wp-now"

WPNow.create().then(wpNow => {
  wpNow.runCode(`<?php echo 'Hello WP-NOW';`)
})
