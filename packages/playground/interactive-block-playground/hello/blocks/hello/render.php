<?php
$wrapper_attributes = get_block_wrapper_attributes();

?>

<div
	<?php echo $wrapper_attributes; ?>
>
	<button
		data-wp-on.click="actions.hello.log"
	>
	HELLO
	</button>
</div>
