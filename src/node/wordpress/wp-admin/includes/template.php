<?php
 require_once ABSPATH . 'wp-admin/includes/class-walker-category-checklist.php'; require_once ABSPATH . 'wp-admin/includes/class-wp-internal-pointers.php'; function wp_category_checklist( $post_id = 0, $descendants_and_self = 0, $selected_cats = false, $popular_cats = false, $walker = null, $checked_ontop = true ) { wp_terms_checklist( $post_id, array( 'taxonomy' => 'category', 'descendants_and_self' => $descendants_and_self, 'selected_cats' => $selected_cats, 'popular_cats' => $popular_cats, 'walker' => $walker, 'checked_ontop' => $checked_ontop, ) ); } function wp_terms_checklist( $post_id = 0, $args = array() ) { $defaults = array( 'descendants_and_self' => 0, 'selected_cats' => false, 'popular_cats' => false, 'walker' => null, 'taxonomy' => 'category', 'checked_ontop' => true, 'echo' => true, ); $params = apply_filters( 'wp_terms_checklist_args', $args, $post_id ); $parsed_args = wp_parse_args( $params, $defaults ); if ( empty( $parsed_args['walker'] ) || ! ( $parsed_args['walker'] instanceof Walker ) ) { $walker = new Walker_Category_Checklist; } else { $walker = $parsed_args['walker']; } $taxonomy = $parsed_args['taxonomy']; $descendants_and_self = (int) $parsed_args['descendants_and_self']; $args = array( 'taxonomy' => $taxonomy ); $tax = get_taxonomy( $taxonomy ); $args['disabled'] = ! current_user_can( $tax->cap->assign_terms ); $args['list_only'] = ! empty( $parsed_args['list_only'] ); if ( is_array( $parsed_args['selected_cats'] ) ) { $args['selected_cats'] = array_map( 'intval', $parsed_args['selected_cats'] ); } elseif ( $post_id ) { $args['selected_cats'] = wp_get_object_terms( $post_id, $taxonomy, array_merge( $args, array( 'fields' => 'ids' ) ) ); } else { $args['selected_cats'] = array(); } if ( is_array( $parsed_args['popular_cats'] ) ) { $args['popular_cats'] = array_map( 'intval', $parsed_args['popular_cats'] ); } else { $args['popular_cats'] = get_terms( array( 'taxonomy' => $taxonomy, 'fields' => 'ids', 'orderby' => 'count', 'order' => 'DESC', 'number' => 10, 'hierarchical' => false, ) ); } if ( $descendants_and_self ) { $categories = (array) get_terms( array( 'taxonomy' => $taxonomy, 'child_of' => $descendants_and_self, 'hierarchical' => 0, 'hide_empty' => 0, ) ); $self = get_term( $descendants_and_self, $taxonomy ); array_unshift( $categories, $self ); } else { $categories = (array) get_terms( array( 'taxonomy' => $taxonomy, 'get' => 'all', ) ); } $output = ''; if ( $parsed_args['checked_ontop'] ) { $checked_categories = array(); $keys = array_keys( $categories ); foreach ( $keys as $k ) { if ( in_array( $categories[ $k ]->term_id, $args['selected_cats'], true ) ) { $checked_categories[] = $categories[ $k ]; unset( $categories[ $k ] ); } } $output .= $walker->walk( $checked_categories, 0, $args ); } $output .= $walker->walk( $categories, 0, $args ); if ( $parsed_args['echo'] ) { echo $output; } return $output; } function wp_popular_terms_checklist( $taxonomy, $default_term = 0, $number = 10, $display = true ) { $post = get_post(); if ( $post && $post->ID ) { $checked_terms = wp_get_object_terms( $post->ID, $taxonomy, array( 'fields' => 'ids' ) ); } else { $checked_terms = array(); } $terms = get_terms( array( 'taxonomy' => $taxonomy, 'orderby' => 'count', 'order' => 'DESC', 'number' => $number, 'hierarchical' => false, ) ); $tax = get_taxonomy( $taxonomy ); $popular_ids = array(); foreach ( (array) $terms as $term ) { $popular_ids[] = $term->term_id; if ( ! $display ) { continue; } $id = "popular-$taxonomy-$term->term_id"; $checked = in_array( $term->term_id, $checked_terms, true ) ? 'checked="checked"' : ''; ?>

		<li id="<?php echo $id; ?>" class="popular-category">
			<label class="selectit">
				<input id="in-<?php echo $id; ?>" type="checkbox" <?php echo $checked; ?> value="<?php echo (int) $term->term_id; ?>" <?php disabled( ! current_user_can( $tax->cap->assign_terms ) ); ?> />
				<?php
 echo esc_html( apply_filters( 'the_category', $term->name, '', '' ) ); ?>
			</label>
		</li>

		<?php
 } return $popular_ids; } function wp_link_category_checklist( $link_id = 0 ) { $default = 1; $checked_categories = array(); if ( $link_id ) { $checked_categories = wp_get_link_cats( $link_id ); if ( ! count( $checked_categories ) ) { $checked_categories[] = $default; } } else { $checked_categories[] = $default; } $categories = get_terms( array( 'taxonomy' => 'link_category', 'orderby' => 'name', 'hide_empty' => 0, ) ); if ( empty( $categories ) ) { return; } foreach ( $categories as $category ) { $cat_id = $category->term_id; $name = esc_html( apply_filters( 'the_category', $category->name, '', '' ) ); $checked = in_array( $cat_id, $checked_categories, true ) ? ' checked="checked"' : ''; echo '<li id="link-category-', $cat_id, '"><label for="in-link-category-', $cat_id, '" class="selectit"><input value="', $cat_id, '" type="checkbox" name="link_category[]" id="in-link-category-', $cat_id, '"', $checked, '/> ', $name, '</label></li>'; } } function get_inline_data( $post ) { $post_type_object = get_post_type_object( $post->post_type ); if ( ! current_user_can( 'edit_post', $post->ID ) ) { return; } $title = esc_textarea( trim( $post->post_title ) ); echo '
<div class="hidden" id="inline_' . $post->ID . '">
	<div class="post_title">' . $title . '</div>' . '<div class="post_name">' . apply_filters( 'editable_slug', $post->post_name, $post ) . '</div>
	<div class="post_author">' . $post->post_author . '</div>
	<div class="comment_status">' . esc_html( $post->comment_status ) . '</div>
	<div class="ping_status">' . esc_html( $post->ping_status ) . '</div>
	<div class="_status">' . esc_html( $post->post_status ) . '</div>
	<div class="jj">' . mysql2date( 'd', $post->post_date, false ) . '</div>
	<div class="mm">' . mysql2date( 'm', $post->post_date, false ) . '</div>
	<div class="aa">' . mysql2date( 'Y', $post->post_date, false ) . '</div>
	<div class="hh">' . mysql2date( 'H', $post->post_date, false ) . '</div>
	<div class="mn">' . mysql2date( 'i', $post->post_date, false ) . '</div>
	<div class="ss">' . mysql2date( 's', $post->post_date, false ) . '</div>
	<div class="post_password">' . esc_html( $post->post_password ) . '</div>'; if ( $post_type_object->hierarchical ) { echo '<div class="post_parent">' . $post->post_parent . '</div>'; } echo '<div class="page_template">' . ( $post->page_template ? esc_html( $post->page_template ) : 'default' ) . '</div>'; if ( post_type_supports( $post->post_type, 'page-attributes' ) ) { echo '<div class="menu_order">' . $post->menu_order . '</div>'; } $taxonomy_names = get_object_taxonomies( $post->post_type ); foreach ( $taxonomy_names as $taxonomy_name ) { $taxonomy = get_taxonomy( $taxonomy_name ); if ( ! $taxonomy->show_in_quick_edit ) { continue; } if ( $taxonomy->hierarchical ) { $terms = get_object_term_cache( $post->ID, $taxonomy_name ); if ( false === $terms ) { $terms = wp_get_object_terms( $post->ID, $taxonomy_name ); wp_cache_add( $post->ID, wp_list_pluck( $terms, 'term_id' ), $taxonomy_name . '_relationships' ); } $term_ids = empty( $terms ) ? array() : wp_list_pluck( $terms, 'term_id' ); echo '<div class="post_category" id="' . $taxonomy_name . '_' . $post->ID . '">' . implode( ',', $term_ids ) . '</div>'; } else { $terms_to_edit = get_terms_to_edit( $post->ID, $taxonomy_name ); if ( ! is_string( $terms_to_edit ) ) { $terms_to_edit = ''; } echo '<div class="tags_input" id="' . $taxonomy_name . '_' . $post->ID . '">' . esc_html( str_replace( ',', ', ', $terms_to_edit ) ) . '</div>'; } } if ( ! $post_type_object->hierarchical ) { echo '<div class="sticky">' . ( is_sticky( $post->ID ) ? 'sticky' : '' ) . '</div>'; } if ( post_type_supports( $post->post_type, 'post-formats' ) ) { echo '<div class="post_format">' . esc_html( get_post_format( $post->ID ) ) . '</div>'; } do_action( 'add_inline_data', $post, $post_type_object ); echo '</div>'; } function wp_comment_reply( $position = 1, $checkbox = false, $mode = 'single', $table_row = true ) { global $wp_list_table; $content = apply_filters( 'wp_comment_reply', '', array( 'position' => $position, 'checkbox' => $checkbox, 'mode' => $mode, ) ); if ( ! empty( $content ) ) { echo $content; return; } if ( ! $wp_list_table ) { if ( 'single' === $mode ) { $wp_list_table = _get_list_table( 'WP_Post_Comments_List_Table' ); } else { $wp_list_table = _get_list_table( 'WP_Comments_List_Table' ); } } ?>
<form method="get">
	<?php if ( $table_row ) : ?>
<table style="display:none;"><tbody id="com-reply"><tr id="replyrow" class="inline-edit-row" style="display:none;"><td colspan="<?php echo $wp_list_table->get_column_count(); ?>" class="colspanchange">
<?php else : ?>
<div id="com-reply" style="display:none;"><div id="replyrow" style="display:none;">
<?php endif; ?>
	<fieldset class="comment-reply">
	<legend>
		<span class="hidden" id="editlegend"><?php _e( 'Edit Comment' ); ?></span>
		<span class="hidden" id="replyhead"><?php _e( 'Reply to Comment' ); ?></span>
		<span class="hidden" id="addhead"><?php _e( 'Add new Comment' ); ?></span>
	</legend>

	<div id="replycontainer">
	<label for="replycontent" class="screen-reader-text"><?php _e( 'Comment' ); ?></label>
	<?php
 $quicktags_settings = array( 'buttons' => 'strong,em,link,block,del,ins,img,ul,ol,li,code,close' ); wp_editor( '', 'replycontent', array( 'media_buttons' => false, 'tinymce' => false, 'quicktags' => $quicktags_settings, ) ); ?>
	</div>

	<div id="edithead" style="display:none;">
		<div class="inside">
		<label for="author-name"><?php _e( 'Name' ); ?></label>
		<input type="text" name="newcomment_author" size="50" value="" id="author-name" />
		</div>

		<div class="inside">
		<label for="author-email"><?php _e( 'Email' ); ?></label>
		<input type="text" name="newcomment_author_email" size="50" value="" id="author-email" />
		</div>

		<div class="inside">
		<label for="author-url"><?php _e( 'URL' ); ?></label>
		<input type="text" id="author-url" name="newcomment_author_url" class="code" size="103" value="" />
		</div>
	</div>

	<div id="replysubmit" class="submit">
		<p class="reply-submit-buttons">
			<button type="button" class="save button button-primary">
				<span id="addbtn" style="display: none;"><?php _e( 'Add Comment' ); ?></span>
				<span id="savebtn" style="display: none;"><?php _e( 'Update Comment' ); ?></span>
				<span id="replybtn" style="display: none;"><?php _e( 'Submit Reply' ); ?></span>
			</button>
			<button type="button" class="cancel button"><?php _e( 'Cancel' ); ?></button>
			<span class="waiting spinner"></span>
		</p>
		<div class="notice notice-error notice-alt inline hidden">
			<p class="error"></p>
		</div>
	</div>

	<input type="hidden" name="action" id="action" value="" />
	<input type="hidden" name="comment_ID" id="comment_ID" value="" />
	<input type="hidden" name="comment_post_ID" id="comment_post_ID" value="" />
	<input type="hidden" name="status" id="status" value="" />
	<input type="hidden" name="position" id="position" value="<?php echo $position; ?>" />
	<input type="hidden" name="checkbox" id="checkbox" value="<?php echo $checkbox ? 1 : 0; ?>" />
	<input type="hidden" name="mode" id="mode" value="<?php echo esc_attr( $mode ); ?>" />
	<?php
 wp_nonce_field( 'replyto-comment', '_ajax_nonce-replyto-comment', false ); if ( current_user_can( 'unfiltered_html' ) ) { wp_nonce_field( 'unfiltered-html-comment', '_wp_unfiltered_html_comment', false ); } ?>
	</fieldset>
	<?php if ( $table_row ) : ?>
</td></tr></tbody></table>
	<?php else : ?>
</div></div>
	<?php endif; ?>
</form>
	<?php
} function wp_comment_trashnotice() { ?>
<div class="hidden" id="trash-undo-holder">
	<div class="trash-undo-inside">
		<?php
 printf( __( 'Comment by %s moved to the Trash.' ), '<strong></strong>' ); ?>
		<span class="undo untrash"><a href="#"><?php _e( 'Undo' ); ?></a></span>
	</div>
</div>
<div class="hidden" id="spam-undo-holder">
	<div class="spam-undo-inside">
		<?php
 printf( __( 'Comment by %s marked as spam.' ), '<strong></strong>' ); ?>
		<span class="undo unspam"><a href="#"><?php _e( 'Undo' ); ?></a></span>
	</div>
</div>
	<?php
} function list_meta( $meta ) { if ( ! $meta ) { echo '
<table id="list-table" style="display: none;">
	<thead>
	<tr>
		<th class="left">' . _x( 'Name', 'meta name' ) . '</th>
		<th>' . __( 'Value' ) . '</th>
	</tr>
	</thead>
	<tbody id="the-list" data-wp-lists="list:meta">
	<tr><td></td></tr>
	</tbody>
</table>'; return; } $count = 0; ?>
<table id="list-table">
	<thead>
	<tr>
		<th class="left"><?php _ex( 'Name', 'meta name' ); ?></th>
		<th><?php _e( 'Value' ); ?></th>
	</tr>
	</thead>
	<tbody id='the-list' data-wp-lists='list:meta'>
	<?php
 foreach ( $meta as $entry ) { echo _list_meta_row( $entry, $count ); } ?>
	</tbody>
</table>
	<?php
} function _list_meta_row( $entry, &$count ) { static $update_nonce = ''; if ( is_protected_meta( $entry['meta_key'], 'post' ) ) { return ''; } if ( ! $update_nonce ) { $update_nonce = wp_create_nonce( 'add-meta' ); } $r = ''; ++ $count; if ( is_serialized( $entry['meta_value'] ) ) { if ( is_serialized_string( $entry['meta_value'] ) ) { $entry['meta_value'] = maybe_unserialize( $entry['meta_value'] ); } else { --$count; return ''; } } $entry['meta_key'] = esc_attr( $entry['meta_key'] ); $entry['meta_value'] = esc_textarea( $entry['meta_value'] ); $entry['meta_id'] = (int) $entry['meta_id']; $delete_nonce = wp_create_nonce( 'delete-meta_' . $entry['meta_id'] ); $r .= "\n\t<tr id='meta-{$entry['meta_id']}'>"; $r .= "\n\t\t<td class='left'><label class='screen-reader-text' for='meta-{$entry['meta_id']}-key'>" . __( 'Key' ) . "</label><input name='meta[{$entry['meta_id']}][key]' id='meta-{$entry['meta_id']}-key' type='text' size='20' value='{$entry['meta_key']}' />"; $r .= "\n\t\t<div class='submit'>"; $r .= get_submit_button( __( 'Delete' ), 'deletemeta small', "deletemeta[{$entry['meta_id']}]", false, array( 'data-wp-lists' => "delete:the-list:meta-{$entry['meta_id']}::_ajax_nonce=$delete_nonce" ) ); $r .= "\n\t\t"; $r .= get_submit_button( __( 'Update' ), 'updatemeta small', "meta-{$entry['meta_id']}-submit", false, array( 'data-wp-lists' => "add:the-list:meta-{$entry['meta_id']}::_ajax_nonce-add-meta=$update_nonce" ) ); $r .= '</div>'; $r .= wp_nonce_field( 'change-meta', '_ajax_nonce', false, false ); $r .= '</td>'; $r .= "\n\t\t<td><label class='screen-reader-text' for='meta-{$entry['meta_id']}-value'>" . __( 'Value' ) . "</label><textarea name='meta[{$entry['meta_id']}][value]' id='meta-{$entry['meta_id']}-value' rows='2' cols='30'>{$entry['meta_value']}</textarea></td>\n\t</tr>"; return $r; } function meta_form( $post = null ) { global $wpdb; $post = get_post( $post ); $keys = apply_filters( 'postmeta_form_keys', null, $post ); if ( null === $keys ) { $limit = apply_filters( 'postmeta_form_limit', 30 ); $keys = $wpdb->get_col( $wpdb->prepare( "SELECT DISTINCT meta_key
				FROM $wpdb->postmeta
				WHERE meta_key NOT BETWEEN '_' AND '_z'
				HAVING meta_key NOT LIKE %s
				ORDER BY meta_key
				LIMIT %d", $wpdb->esc_like( '_' ) . '%', $limit ) ); } if ( $keys ) { natcasesort( $keys ); $meta_key_input_id = 'metakeyselect'; } else { $meta_key_input_id = 'metakeyinput'; } ?>
<p><strong><?php _e( 'Add New Custom Field:' ); ?></strong></p>
<table id="newmeta">
<thead>
<tr>
<th class="left"><label for="<?php echo $meta_key_input_id; ?>"><?php _ex( 'Name', 'meta name' ); ?></label></th>
<th><label for="metavalue"><?php _e( 'Value' ); ?></label></th>
</tr>
</thead>

<tbody>
<tr>
<td id="newmetaleft" class="left">
	<?php if ( $keys ) { ?>
<select id="metakeyselect" name="metakeyselect">
<option value="#NONE#"><?php _e( '&mdash; Select &mdash;' ); ?></option>
		<?php
 foreach ( $keys as $key ) { if ( is_protected_meta( $key, 'post' ) || ! current_user_can( 'add_post_meta', $post->ID, $key ) ) { continue; } echo "\n<option value='" . esc_attr( $key ) . "'>" . esc_html( $key ) . '</option>'; } ?>
</select>
<input class="hide-if-js" type="text" id="metakeyinput" name="metakeyinput" value="" />
<a href="#postcustomstuff" class="hide-if-no-js" onclick="jQuery('#metakeyinput, #metakeyselect, #enternew, #cancelnew').toggle();return false;">
<span id="enternew"><?php _e( 'Enter new' ); ?></span>
<span id="cancelnew" class="hidden"><?php _e( 'Cancel' ); ?></span></a>
<?php } else { ?>
<input type="text" id="metakeyinput" name="metakeyinput" value="" />
<?php } ?>
</td>
<td><textarea id="metavalue" name="metavalue" rows="2" cols="25"></textarea></td>
</tr>

<tr><td colspan="2">
<div class="submit">
	<?php
 submit_button( __( 'Add Custom Field' ), '', 'addmeta', false, array( 'id' => 'newmeta-submit', 'data-wp-lists' => 'add:the-list:newmeta', ) ); ?>
</div>
	<?php wp_nonce_field( 'add-meta', '_ajax_nonce-add-meta', false ); ?>
</td></tr>
</tbody>
</table>
	<?php
 } function touch_time( $edit = 1, $for_post = 1, $tab_index = 0, $multi = 0 ) { global $wp_locale; $post = get_post(); if ( $for_post ) { $edit = ! ( in_array( $post->post_status, array( 'draft', 'pending' ), true ) && ( ! $post->post_date_gmt || '0000-00-00 00:00:00' === $post->post_date_gmt ) ); } $tab_index_attribute = ''; if ( (int) $tab_index > 0 ) { $tab_index_attribute = " tabindex=\"$tab_index\""; } $post_date = ( $for_post ) ? $post->post_date : get_comment()->comment_date; $jj = ( $edit ) ? mysql2date( 'd', $post_date, false ) : current_time( 'd' ); $mm = ( $edit ) ? mysql2date( 'm', $post_date, false ) : current_time( 'm' ); $aa = ( $edit ) ? mysql2date( 'Y', $post_date, false ) : current_time( 'Y' ); $hh = ( $edit ) ? mysql2date( 'H', $post_date, false ) : current_time( 'H' ); $mn = ( $edit ) ? mysql2date( 'i', $post_date, false ) : current_time( 'i' ); $ss = ( $edit ) ? mysql2date( 's', $post_date, false ) : current_time( 's' ); $cur_jj = current_time( 'd' ); $cur_mm = current_time( 'm' ); $cur_aa = current_time( 'Y' ); $cur_hh = current_time( 'H' ); $cur_mn = current_time( 'i' ); $month = '<label><span class="screen-reader-text">' . __( 'Month' ) . '</span><select class="form-required" ' . ( $multi ? '' : 'id="mm" ' ) . 'name="mm"' . $tab_index_attribute . ">\n"; for ( $i = 1; $i < 13; $i = $i + 1 ) { $monthnum = zeroise( $i, 2 ); $monthtext = $wp_locale->get_month_abbrev( $wp_locale->get_month( $i ) ); $month .= "\t\t\t" . '<option value="' . $monthnum . '" data-text="' . $monthtext . '" ' . selected( $monthnum, $mm, false ) . '>'; $month .= sprintf( __( '%1$s-%2$s' ), $monthnum, $monthtext ) . "</option>\n"; } $month .= '</select></label>'; $day = '<label><span class="screen-reader-text">' . __( 'Day' ) . '</span><input type="text" ' . ( $multi ? '' : 'id="jj" ' ) . 'name="jj" value="' . $jj . '" size="2" maxlength="2"' . $tab_index_attribute . ' autocomplete="off" class="form-required" /></label>'; $year = '<label><span class="screen-reader-text">' . __( 'Year' ) . '</span><input type="text" ' . ( $multi ? '' : 'id="aa" ' ) . 'name="aa" value="' . $aa . '" size="4" maxlength="4"' . $tab_index_attribute . ' autocomplete="off" class="form-required" /></label>'; $hour = '<label><span class="screen-reader-text">' . __( 'Hour' ) . '</span><input type="text" ' . ( $multi ? '' : 'id="hh" ' ) . 'name="hh" value="' . $hh . '" size="2" maxlength="2"' . $tab_index_attribute . ' autocomplete="off" class="form-required" /></label>'; $minute = '<label><span class="screen-reader-text">' . __( 'Minute' ) . '</span><input type="text" ' . ( $multi ? '' : 'id="mn" ' ) . 'name="mn" value="' . $mn . '" size="2" maxlength="2"' . $tab_index_attribute . ' autocomplete="off" class="form-required" /></label>'; echo '<div class="timestamp-wrap">'; printf( __( '%1$s %2$s, %3$s at %4$s:%5$s' ), $month, $day, $year, $hour, $minute ); echo '</div><input type="hidden" id="ss" name="ss" value="' . $ss . '" />'; if ( $multi ) { return; } echo "\n\n"; $map = array( 'mm' => array( $mm, $cur_mm ), 'jj' => array( $jj, $cur_jj ), 'aa' => array( $aa, $cur_aa ), 'hh' => array( $hh, $cur_hh ), 'mn' => array( $mn, $cur_mn ), ); foreach ( $map as $timeunit => $value ) { list( $unit, $curr ) = $value; echo '<input type="hidden" id="hidden_' . $timeunit . '" name="hidden_' . $timeunit . '" value="' . $unit . '" />' . "\n"; $cur_timeunit = 'cur_' . $timeunit; echo '<input type="hidden" id="' . $cur_timeunit . '" name="' . $cur_timeunit . '" value="' . $curr . '" />' . "\n"; } ?>

<p>
<a href="#edit_timestamp" class="save-timestamp hide-if-no-js button"><?php _e( 'OK' ); ?></a>
<a href="#edit_timestamp" class="cancel-timestamp hide-if-no-js button-cancel"><?php _e( 'Cancel' ); ?></a>
</p>
	<?php
} function page_template_dropdown( $default_template = '', $post_type = 'page' ) { $templates = get_page_templates( null, $post_type ); ksort( $templates ); foreach ( array_keys( $templates ) as $template ) { $selected = selected( $default_template, $templates[ $template ], false ); echo "\n\t<option value='" . esc_attr( $templates[ $template ] ) . "' $selected>" . esc_html( $template ) . '</option>'; } } function parent_dropdown( $default_page = 0, $parent = 0, $level = 0, $post = null ) { global $wpdb; $post = get_post( $post ); $items = $wpdb->get_results( $wpdb->prepare( "SELECT ID, post_parent, post_title FROM $wpdb->posts WHERE post_parent = %d AND post_type = 'page' ORDER BY menu_order", $parent ) ); if ( $items ) { foreach ( $items as $item ) { if ( $post && $post->ID && (int) $item->ID === $post->ID ) { continue; } $pad = str_repeat( '&nbsp;', $level * 3 ); $selected = selected( $default_page, $item->ID, false ); echo "\n\t<option class='level-$level' value='$item->ID' $selected>$pad " . esc_html( $item->post_title ) . '</option>'; parent_dropdown( $default_page, $item->ID, $level + 1 ); } } else { return false; } } function wp_dropdown_roles( $selected = '' ) { $r = ''; $editable_roles = array_reverse( get_editable_roles() ); foreach ( $editable_roles as $role => $details ) { $name = translate_user_role( $details['name'] ); if ( $selected === $role ) { $r .= "\n\t<option selected='selected' value='" . esc_attr( $role ) . "'>$name</option>"; } else { $r .= "\n\t<option value='" . esc_attr( $role ) . "'>$name</option>"; } } echo $r; } function wp_import_upload_form( $action ) { $bytes = apply_filters( 'import_upload_size_limit', wp_max_upload_size() ); $size = size_format( $bytes ); $upload_dir = wp_upload_dir(); if ( ! empty( $upload_dir['error'] ) ) : ?>
		<div class="error"><p><?php _e( 'Before you can upload your import file, you will need to fix the following error:' ); ?></p>
		<p><strong><?php echo $upload_dir['error']; ?></strong></p></div>
		<?php
 else : ?>
<form enctype="multipart/form-data" id="import-upload-form" method="post" class="wp-upload-form" action="<?php echo esc_url( wp_nonce_url( $action, 'import-upload' ) ); ?>">
<p>
		<?php
 printf( '<label for="upload">%s</label> (%s)', __( 'Choose a file from your computer:' ), sprintf( __( 'Maximum size: %s' ), $size ) ); ?>
<input type="file" id="upload" name="import" size="25" />
<input type="hidden" name="action" value="save" />
<input type="hidden" name="max_file_size" value="<?php echo $bytes; ?>" />
</p>
		<?php submit_button( __( 'Upload file and import' ), 'primary' ); ?>
</form>
		<?php
 endif; } function add_meta_box( $id, $title, $callback, $screen = null, $context = 'advanced', $priority = 'default', $callback_args = null ) { global $wp_meta_boxes; if ( empty( $screen ) ) { $screen = get_current_screen(); } elseif ( is_string( $screen ) ) { $screen = convert_to_screen( $screen ); } elseif ( is_array( $screen ) ) { foreach ( $screen as $single_screen ) { add_meta_box( $id, $title, $callback, $single_screen, $context, $priority, $callback_args ); } } if ( ! isset( $screen->id ) ) { return; } $page = $screen->id; if ( ! isset( $wp_meta_boxes ) ) { $wp_meta_boxes = array(); } if ( ! isset( $wp_meta_boxes[ $page ] ) ) { $wp_meta_boxes[ $page ] = array(); } if ( ! isset( $wp_meta_boxes[ $page ][ $context ] ) ) { $wp_meta_boxes[ $page ][ $context ] = array(); } foreach ( array_keys( $wp_meta_boxes[ $page ] ) as $a_context ) { foreach ( array( 'high', 'core', 'default', 'low' ) as $a_priority ) { if ( ! isset( $wp_meta_boxes[ $page ][ $a_context ][ $a_priority ][ $id ] ) ) { continue; } if ( ( 'core' === $priority || 'sorted' === $priority ) && false === $wp_meta_boxes[ $page ][ $a_context ][ $a_priority ][ $id ] ) { return; } if ( 'core' === $priority ) { if ( 'default' === $a_priority ) { $wp_meta_boxes[ $page ][ $a_context ]['core'][ $id ] = $wp_meta_boxes[ $page ][ $a_context ]['default'][ $id ]; unset( $wp_meta_boxes[ $page ][ $a_context ]['default'][ $id ] ); } return; } if ( empty( $priority ) ) { $priority = $a_priority; } elseif ( 'sorted' === $priority ) { $title = $wp_meta_boxes[ $page ][ $a_context ][ $a_priority ][ $id ]['title']; $callback = $wp_meta_boxes[ $page ][ $a_context ][ $a_priority ][ $id ]['callback']; $callback_args = $wp_meta_boxes[ $page ][ $a_context ][ $a_priority ][ $id ]['args']; } if ( $priority !== $a_priority || $context !== $a_context ) { unset( $wp_meta_boxes[ $page ][ $a_context ][ $a_priority ][ $id ] ); } } } if ( empty( $priority ) ) { $priority = 'low'; } if ( ! isset( $wp_meta_boxes[ $page ][ $context ][ $priority ] ) ) { $wp_meta_boxes[ $page ][ $context ][ $priority ] = array(); } $wp_meta_boxes[ $page ][ $context ][ $priority ][ $id ] = array( 'id' => $id, 'title' => $title, 'callback' => $callback, 'args' => $callback_args, ); } function do_block_editor_incompatible_meta_box( $data_object, $box ) { $plugin = _get_plugin_from_callback( $box['old_callback'] ); $plugins = get_plugins(); echo '<p>'; if ( $plugin ) { printf( __( 'This meta box, from the %s plugin, is not compatible with the block editor.' ), "<strong>{$plugin['Name']}</strong>" ); } else { _e( 'This meta box is not compatible with the block editor.' ); } echo '</p>'; if ( empty( $plugins['classic-editor/classic-editor.php'] ) ) { if ( current_user_can( 'install_plugins' ) ) { $install_url = wp_nonce_url( self_admin_url( 'plugin-install.php?tab=favorites&user=wordpressdotorg&save=0' ), 'save_wporg_username_' . get_current_user_id() ); echo '<p>'; printf( __( 'Please install the <a href="%s">Classic Editor plugin</a> to use this meta box.' ), esc_url( $install_url ) ); echo '</p>'; } } elseif ( is_plugin_inactive( 'classic-editor/classic-editor.php' ) ) { if ( current_user_can( 'activate_plugins' ) ) { $activate_url = wp_nonce_url( self_admin_url( 'plugins.php?action=activate&plugin=classic-editor/classic-editor.php' ), 'activate-plugin_classic-editor/classic-editor.php' ); echo '<p>'; printf( __( 'Please activate the <a href="%s">Classic Editor plugin</a> to use this meta box.' ), esc_url( $activate_url ) ); echo '</p>'; } } elseif ( $data_object instanceof WP_Post ) { $edit_url = add_query_arg( array( 'classic-editor' => '', 'classic-editor__forget' => '', ), get_edit_post_link( $data_object ) ); echo '<p>'; printf( __( 'Please open the <a href="%s">classic editor</a> to use this meta box.' ), esc_url( $edit_url ) ); echo '</p>'; } } function _get_plugin_from_callback( $callback ) { try { if ( is_array( $callback ) ) { $reflection = new ReflectionMethod( $callback[0], $callback[1] ); } elseif ( is_string( $callback ) && false !== strpos( $callback, '::' ) ) { $reflection = new ReflectionMethod( $callback ); } else { $reflection = new ReflectionFunction( $callback ); } } catch ( ReflectionException $exception ) { return null; } if ( ! $reflection->isInternal() ) { $filename = wp_normalize_path( $reflection->getFileName() ); $plugin_dir = wp_normalize_path( WP_PLUGIN_DIR ); if ( strpos( $filename, $plugin_dir ) === 0 ) { $filename = str_replace( $plugin_dir, '', $filename ); $filename = preg_replace( '|^/([^/]*/).*$|', '\\1', $filename ); $plugins = get_plugins(); foreach ( $plugins as $name => $plugin ) { if ( strpos( $name, $filename ) === 0 ) { return $plugin; } } } } return null; } function do_meta_boxes( $screen, $context, $data_object ) { global $wp_meta_boxes; static $already_sorted = false; if ( empty( $screen ) ) { $screen = get_current_screen(); } elseif ( is_string( $screen ) ) { $screen = convert_to_screen( $screen ); } $page = $screen->id; $hidden = get_hidden_meta_boxes( $screen ); printf( '<div id="%s-sortables" class="meta-box-sortables">', esc_attr( $context ) ); $sorted = get_user_option( "meta-box-order_$page" ); if ( ! $already_sorted && $sorted ) { foreach ( $sorted as $box_context => $ids ) { foreach ( explode( ',', $ids ) as $id ) { if ( $id && 'dashboard_browser_nag' !== $id ) { add_meta_box( $id, null, null, $screen, $box_context, 'sorted' ); } } } } $already_sorted = true; $i = 0; if ( isset( $wp_meta_boxes[ $page ][ $context ] ) ) { foreach ( array( 'high', 'sorted', 'core', 'default', 'low' ) as $priority ) { if ( isset( $wp_meta_boxes[ $page ][ $context ][ $priority ] ) ) { foreach ( (array) $wp_meta_boxes[ $page ][ $context ][ $priority ] as $box ) { if ( false === $box || ! $box['title'] ) { continue; } $block_compatible = true; if ( is_array( $box['args'] ) ) { if ( $screen->is_block_editor() && isset( $box['args']['__back_compat_meta_box'] ) && $box['args']['__back_compat_meta_box'] ) { continue; } if ( isset( $box['args']['__block_editor_compatible_meta_box'] ) ) { $block_compatible = (bool) $box['args']['__block_editor_compatible_meta_box']; unset( $box['args']['__block_editor_compatible_meta_box'] ); } if ( ! $block_compatible && $screen->is_block_editor() ) { $box['old_callback'] = $box['callback']; $box['callback'] = 'do_block_editor_incompatible_meta_box'; } if ( isset( $box['args']['__back_compat_meta_box'] ) ) { $block_compatible = $block_compatible || (bool) $box['args']['__back_compat_meta_box']; unset( $box['args']['__back_compat_meta_box'] ); } } $i++; $hidden_class = ( ! $screen->is_block_editor() && in_array( $box['id'], $hidden, true ) ) ? ' hide-if-js' : ''; echo '<div id="' . $box['id'] . '" class="postbox ' . postbox_classes( $box['id'], $page ) . $hidden_class . '" ' . '>' . "\n"; echo '<div class="postbox-header">'; echo '<h2 class="hndle">'; if ( 'dashboard_php_nag' === $box['id'] ) { echo '<span aria-hidden="true" class="dashicons dashicons-warning"></span>'; echo '<span class="screen-reader-text">' . __( 'Warning:' ) . ' </span>'; } echo $box['title']; echo "</h2>\n"; if ( 'dashboard_browser_nag' !== $box['id'] ) { $widget_title = $box['title']; if ( is_array( $box['args'] ) && isset( $box['args']['__widget_basename'] ) ) { $widget_title = $box['args']['__widget_basename']; unset( $box['args']['__widget_basename'] ); } echo '<div class="handle-actions hide-if-no-js">'; echo '<button type="button" class="handle-order-higher" aria-disabled="false" aria-describedby="' . $box['id'] . '-handle-order-higher-description">'; echo '<span class="screen-reader-text">' . __( 'Move up' ) . '</span>'; echo '<span class="order-higher-indicator" aria-hidden="true"></span>'; echo '</button>'; echo '<span class="hidden" id="' . $box['id'] . '-handle-order-higher-description">' . sprintf( __( 'Move %s box up' ), $widget_title ) . '</span>'; echo '<button type="button" class="handle-order-lower" aria-disabled="false" aria-describedby="' . $box['id'] . '-handle-order-lower-description">'; echo '<span class="screen-reader-text">' . __( 'Move down' ) . '</span>'; echo '<span class="order-lower-indicator" aria-hidden="true"></span>'; echo '</button>'; echo '<span class="hidden" id="' . $box['id'] . '-handle-order-lower-description">' . sprintf( __( 'Move %s box down' ), $widget_title ) . '</span>'; echo '<button type="button" class="handlediv" aria-expanded="true">'; echo '<span class="screen-reader-text">' . sprintf( __( 'Toggle panel: %s' ), $widget_title ) . '</span>'; echo '<span class="toggle-indicator" aria-hidden="true"></span>'; echo '</button>'; echo '</div>'; } echo '</div>'; echo '<div class="inside">' . "\n"; if ( WP_DEBUG && ! $block_compatible && 'edit' === $screen->parent_base && ! $screen->is_block_editor() && ! isset( $_GET['meta-box-loader'] ) ) { $plugin = _get_plugin_from_callback( $box['callback'] ); if ( $plugin ) { ?>
							<div class="error inline">
								<p>
									<?php
 printf( __( 'This meta box, from the %s plugin, is not compatible with the block editor.' ), "<strong>{$plugin['Name']}</strong>" ); ?>
								</p>
							</div>
							<?php
 } } call_user_func( $box['callback'], $data_object, $box ); echo "</div>\n"; echo "</div>\n"; } } } } echo '</div>'; return $i; } function remove_meta_box( $id, $screen, $context ) { global $wp_meta_boxes; if ( empty( $screen ) ) { $screen = get_current_screen(); } elseif ( is_string( $screen ) ) { $screen = convert_to_screen( $screen ); } elseif ( is_array( $screen ) ) { foreach ( $screen as $single_screen ) { remove_meta_box( $id, $single_screen, $context ); } } if ( ! isset( $screen->id ) ) { return; } $page = $screen->id; if ( ! isset( $wp_meta_boxes ) ) { $wp_meta_boxes = array(); } if ( ! isset( $wp_meta_boxes[ $page ] ) ) { $wp_meta_boxes[ $page ] = array(); } if ( ! isset( $wp_meta_boxes[ $page ][ $context ] ) ) { $wp_meta_boxes[ $page ][ $context ] = array(); } foreach ( array( 'high', 'core', 'default', 'low' ) as $priority ) { $wp_meta_boxes[ $page ][ $context ][ $priority ][ $id ] = false; } } function do_accordion_sections( $screen, $context, $data_object ) { global $wp_meta_boxes; wp_enqueue_script( 'accordion' ); if ( empty( $screen ) ) { $screen = get_current_screen(); } elseif ( is_string( $screen ) ) { $screen = convert_to_screen( $screen ); } $page = $screen->id; $hidden = get_hidden_meta_boxes( $screen ); ?>
	<div id="side-sortables" class="accordion-container">
		<ul class="outer-border">
	<?php
 $i = 0; $first_open = false; if ( isset( $wp_meta_boxes[ $page ][ $context ] ) ) { foreach ( array( 'high', 'core', 'default', 'low' ) as $priority ) { if ( isset( $wp_meta_boxes[ $page ][ $context ][ $priority ] ) ) { foreach ( $wp_meta_boxes[ $page ][ $context ][ $priority ] as $box ) { if ( false === $box || ! $box['title'] ) { continue; } $i++; $hidden_class = in_array( $box['id'], $hidden, true ) ? 'hide-if-js' : ''; $open_class = ''; if ( ! $first_open && empty( $hidden_class ) ) { $first_open = true; $open_class = 'open'; } ?>
					<li class="control-section accordion-section <?php echo $hidden_class; ?> <?php echo $open_class; ?> <?php echo esc_attr( $box['id'] ); ?>" id="<?php echo esc_attr( $box['id'] ); ?>">
						<h3 class="accordion-section-title hndle" tabindex="0">
							<?php echo esc_html( $box['title'] ); ?>
							<span class="screen-reader-text"><?php _e( 'Press return or enter to open this section' ); ?></span>
						</h3>
						<div class="accordion-section-content <?php postbox_classes( $box['id'], $page ); ?>">
							<div class="inside">
								<?php call_user_func( $box['callback'], $data_object, $box ); ?>
							</div><!-- .inside -->
						</div><!-- .accordion-section-content -->
					</li><!-- .accordion-section -->
					<?php
 } } } } ?>
		</ul><!-- .outer-border -->
	</div><!-- .accordion-container -->
	<?php
 return $i; } function add_settings_section( $id, $title, $callback, $page ) { global $wp_settings_sections; if ( 'misc' === $page ) { _deprecated_argument( __FUNCTION__, '3.0.0', sprintf( __( 'The "%s" options group has been removed. Use another settings group.' ), 'misc' ) ); $page = 'general'; } if ( 'privacy' === $page ) { _deprecated_argument( __FUNCTION__, '3.5.0', sprintf( __( 'The "%s" options group has been removed. Use another settings group.' ), 'privacy' ) ); $page = 'reading'; } $wp_settings_sections[ $page ][ $id ] = array( 'id' => $id, 'title' => $title, 'callback' => $callback, ); } function add_settings_field( $id, $title, $callback, $page, $section = 'default', $args = array() ) { global $wp_settings_fields; if ( 'misc' === $page ) { _deprecated_argument( __FUNCTION__, '3.0.0', sprintf( __( 'The "%s" options group has been removed. Use another settings group.' ), 'misc' ) ); $page = 'general'; } if ( 'privacy' === $page ) { _deprecated_argument( __FUNCTION__, '3.5.0', sprintf( __( 'The "%s" options group has been removed. Use another settings group.' ), 'privacy' ) ); $page = 'reading'; } $wp_settings_fields[ $page ][ $section ][ $id ] = array( 'id' => $id, 'title' => $title, 'callback' => $callback, 'args' => $args, ); } function do_settings_sections( $page ) { global $wp_settings_sections, $wp_settings_fields; if ( ! isset( $wp_settings_sections[ $page ] ) ) { return; } foreach ( (array) $wp_settings_sections[ $page ] as $section ) { if ( $section['title'] ) { echo "<h2>{$section['title']}</h2>\n"; } if ( $section['callback'] ) { call_user_func( $section['callback'], $section ); } if ( ! isset( $wp_settings_fields ) || ! isset( $wp_settings_fields[ $page ] ) || ! isset( $wp_settings_fields[ $page ][ $section['id'] ] ) ) { continue; } echo '<table class="form-table" role="presentation">'; do_settings_fields( $page, $section['id'] ); echo '</table>'; } } function do_settings_fields( $page, $section ) { global $wp_settings_fields; if ( ! isset( $wp_settings_fields[ $page ][ $section ] ) ) { return; } foreach ( (array) $wp_settings_fields[ $page ][ $section ] as $field ) { $class = ''; if ( ! empty( $field['args']['class'] ) ) { $class = ' class="' . esc_attr( $field['args']['class'] ) . '"'; } echo "<tr{$class}>"; if ( ! empty( $field['args']['label_for'] ) ) { echo '<th scope="row"><label for="' . esc_attr( $field['args']['label_for'] ) . '">' . $field['title'] . '</label></th>'; } else { echo '<th scope="row">' . $field['title'] . '</th>'; } echo '<td>'; call_user_func( $field['callback'], $field['args'] ); echo '</td>'; echo '</tr>'; } } function add_settings_error( $setting, $code, $message, $type = 'error' ) { global $wp_settings_errors; $wp_settings_errors[] = array( 'setting' => $setting, 'code' => $code, 'message' => $message, 'type' => $type, ); } function get_settings_errors( $setting = '', $sanitize = false ) { global $wp_settings_errors; if ( $sanitize ) { sanitize_option( $setting, get_option( $setting ) ); } if ( isset( $_GET['settings-updated'] ) && $_GET['settings-updated'] && get_transient( 'settings_errors' ) ) { $wp_settings_errors = array_merge( (array) $wp_settings_errors, get_transient( 'settings_errors' ) ); delete_transient( 'settings_errors' ); } if ( empty( $wp_settings_errors ) ) { return array(); } if ( $setting ) { $setting_errors = array(); foreach ( (array) $wp_settings_errors as $key => $details ) { if ( $setting === $details['setting'] ) { $setting_errors[] = $wp_settings_errors[ $key ]; } } return $setting_errors; } return $wp_settings_errors; } function settings_errors( $setting = '', $sanitize = false, $hide_on_update = false ) { if ( $hide_on_update && ! empty( $_GET['settings-updated'] ) ) { return; } $settings_errors = get_settings_errors( $setting, $sanitize ); if ( empty( $settings_errors ) ) { return; } $output = ''; foreach ( $settings_errors as $key => $details ) { if ( 'updated' === $details['type'] ) { $details['type'] = 'success'; } if ( in_array( $details['type'], array( 'error', 'success', 'warning', 'info' ), true ) ) { $details['type'] = 'notice-' . $details['type']; } $css_id = sprintf( 'setting-error-%s', esc_attr( $details['code'] ) ); $css_class = sprintf( 'notice %s settings-error is-dismissible', esc_attr( $details['type'] ) ); $output .= "<div id='$css_id' class='$css_class'> \n"; $output .= "<p><strong>{$details['message']}</strong></p>"; $output .= "</div> \n"; } echo $output; } function find_posts_div( $found_action = '' ) { ?>
	<div id="find-posts" class="find-box" style="display: none;">
		<div id="find-posts-head" class="find-box-head">
			<?php _e( 'Attach to existing content' ); ?>
			<button type="button" id="find-posts-close"><span class="screen-reader-text"><?php _e( 'Close media attachment panel' ); ?></span></button>
		</div>
		<div class="find-box-inside">
			<div class="find-box-search">
				<?php if ( $found_action ) { ?>
					<input type="hidden" name="found_action" value="<?php echo esc_attr( $found_action ); ?>" />
				<?php } ?>
				<input type="hidden" name="affected" id="affected" value="" />
				<?php wp_nonce_field( 'find-posts', '_ajax_nonce', false ); ?>
				<label class="screen-reader-text" for="find-posts-input"><?php _e( 'Search' ); ?></label>
				<input type="text" id="find-posts-input" name="ps" value="" />
				<span class="spinner"></span>
				<input type="button" id="find-posts-search" value="<?php esc_attr_e( 'Search' ); ?>" class="button" />
				<div class="clear"></div>
			</div>
			<div id="find-posts-response"></div>
		</div>
		<div class="find-box-buttons">
			<?php submit_button( __( 'Select' ), 'primary alignright', 'find-posts-submit', false ); ?>
			<div class="clear"></div>
		</div>
	</div>
	<?php
} function the_post_password() { $post = get_post(); if ( isset( $post->post_password ) ) { echo esc_attr( $post->post_password ); } } function _draft_or_post_title( $post = 0 ) { $title = get_the_title( $post ); if ( empty( $title ) ) { $title = __( '(no title)' ); } return esc_html( $title ); } function _admin_search_query() { echo isset( $_REQUEST['s'] ) ? esc_attr( wp_unslash( $_REQUEST['s'] ) ) : ''; } function iframe_header( $title = '', $deprecated = false ) { show_admin_bar( false ); global $hook_suffix, $admin_body_class, $wp_locale; $admin_body_class = preg_replace( '/[^a-z0-9_-]+/i', '-', $hook_suffix ); $current_screen = get_current_screen(); header( 'Content-Type: ' . get_option( 'html_type' ) . '; charset=' . get_option( 'blog_charset' ) ); _wp_admin_html_begin(); ?>
<title><?php bloginfo( 'name' ); ?> &rsaquo; <?php echo $title; ?> &#8212; <?php _e( 'WordPress' ); ?></title>
	<?php
 wp_enqueue_style( 'colors' ); ?>
<script type="text/javascript">
addLoadEvent = function(func){if(typeof jQuery!=='undefined')jQuery(function(){func();});else if(typeof wpOnload!=='function'){wpOnload=func;}else{var oldonload=wpOnload;wpOnload=function(){oldonload();func();}}};
function tb_close(){var win=window.dialogArguments||opener||parent||top;win.tb_remove();}
var ajaxurl = '<?php echo esc_js( admin_url( 'admin-ajax.php', 'relative' ) ); ?>',
	pagenow = '<?php echo esc_js( $current_screen->id ); ?>',
	typenow = '<?php echo esc_js( $current_screen->post_type ); ?>',
	adminpage = '<?php echo esc_js( $admin_body_class ); ?>',
	thousandsSeparator = '<?php echo esc_js( $wp_locale->number_format['thousands_sep'] ); ?>',
	decimalPoint = '<?php echo esc_js( $wp_locale->number_format['decimal_point'] ); ?>',
	isRtl = <?php echo (int) is_rtl(); ?>;
</script>
	<?php
 do_action( 'admin_enqueue_scripts', $hook_suffix ); do_action( "admin_print_styles-{$hook_suffix}" ); do_action( 'admin_print_styles' ); do_action( "admin_print_scripts-{$hook_suffix}" ); do_action( 'admin_print_scripts' ); do_action( "admin_head-{$hook_suffix}" ); do_action( 'admin_head' ); $admin_body_class .= ' locale-' . sanitize_html_class( strtolower( str_replace( '_', '-', get_user_locale() ) ) ); if ( is_rtl() ) { $admin_body_class .= ' rtl'; } ?>
</head>
	<?php
 $admin_body_id = isset( $GLOBALS['body_id'] ) ? 'id="' . $GLOBALS['body_id'] . '" ' : ''; $admin_body_classes = apply_filters( 'admin_body_class', '' ); $admin_body_classes = ltrim( $admin_body_classes . ' ' . $admin_body_class ); ?>
<body <?php echo $admin_body_id; ?>class="wp-admin wp-core-ui no-js iframe <?php echo $admin_body_classes; ?>">
<script type="text/javascript">
(function(){
var c = document.body.className;
c = c.replace(/no-js/, 'js');
document.body.className = c;
})();
</script>
	<?php
} function iframe_footer() { global $hook_suffix; ?>
	<div class="hidden">
	<?php
 do_action( 'admin_footer', $hook_suffix ); do_action( "admin_print_footer_scripts-{$hook_suffix}" ); do_action( 'admin_print_footer_scripts' ); ?>
	</div>
<script type="text/javascript">if(typeof wpOnload==='function')wpOnload();</script>
</body>
</html>
	<?php
} function _post_states( $post, $display = true ) { $post_states = get_post_states( $post ); $post_states_string = ''; if ( ! empty( $post_states ) ) { $state_count = count( $post_states ); $i = 0; $post_states_string .= ' &mdash; '; foreach ( $post_states as $state ) { ++$i; $sep = ( $i < $state_count ) ? ', ' : ''; $post_states_string .= "<span class='post-state'>$state$sep</span>"; } } if ( $display ) { echo $post_states_string; } return $post_states_string; } function get_post_states( $post ) { $post_states = array(); if ( isset( $_REQUEST['post_status'] ) ) { $post_status = $_REQUEST['post_status']; } else { $post_status = ''; } if ( ! empty( $post->post_password ) ) { $post_states['protected'] = _x( 'Password protected', 'post status' ); } if ( 'private' === $post->post_status && 'private' !== $post_status ) { $post_states['private'] = _x( 'Private', 'post status' ); } if ( 'draft' === $post->post_status ) { if ( get_post_meta( $post->ID, '_customize_changeset_uuid', true ) ) { $post_states[] = __( 'Customization Draft' ); } elseif ( 'draft' !== $post_status ) { $post_states['draft'] = _x( 'Draft', 'post status' ); } } elseif ( 'trash' === $post->post_status && get_post_meta( $post->ID, '_customize_changeset_uuid', true ) ) { $post_states[] = _x( 'Customization Draft', 'post status' ); } if ( 'pending' === $post->post_status && 'pending' !== $post_status ) { $post_states['pending'] = _x( 'Pending', 'post status' ); } if ( is_sticky( $post->ID ) ) { $post_states['sticky'] = _x( 'Sticky', 'post status' ); } if ( 'future' === $post->post_status ) { $post_states['scheduled'] = _x( 'Scheduled', 'post status' ); } if ( 'page' === get_option( 'show_on_front' ) ) { if ( (int) get_option( 'page_on_front' ) === $post->ID ) { $post_states['page_on_front'] = _x( 'Front Page', 'page label' ); } if ( (int) get_option( 'page_for_posts' ) === $post->ID ) { $post_states['page_for_posts'] = _x( 'Posts Page', 'page label' ); } } if ( (int) get_option( 'wp_page_for_privacy_policy' ) === $post->ID ) { $post_states['page_for_privacy_policy'] = _x( 'Privacy Policy Page', 'page label' ); } return apply_filters( 'display_post_states', $post_states, $post ); } function _media_states( $post, $display = true ) { $media_states = get_media_states( $post ); $media_states_string = ''; if ( ! empty( $media_states ) ) { $state_count = count( $media_states ); $i = 0; $media_states_string .= ' &mdash; '; foreach ( $media_states as $state ) { ++$i; $sep = ( $i < $state_count ) ? ', ' : ''; $media_states_string .= "<span class='post-state'>$state$sep</span>"; } } if ( $display ) { echo $media_states_string; } return $media_states_string; } function get_media_states( $post ) { static $header_images; $media_states = array(); $stylesheet = get_option( 'stylesheet' ); if ( current_theme_supports( 'custom-header' ) ) { $meta_header = get_post_meta( $post->ID, '_wp_attachment_is_custom_header', true ); if ( is_random_header_image() ) { if ( ! isset( $header_images ) ) { $header_images = wp_list_pluck( get_uploaded_header_images(), 'attachment_id' ); } if ( $meta_header === $stylesheet && in_array( $post->ID, $header_images, true ) ) { $media_states[] = __( 'Header Image' ); } } else { $header_image = get_header_image(); if ( ! empty( $meta_header ) && $meta_header === $stylesheet && wp_get_attachment_url( $post->ID ) !== $header_image ) { $media_states[] = __( 'Header Image' ); } if ( $header_image && wp_get_attachment_url( $post->ID ) === $header_image ) { $media_states[] = __( 'Current Header Image' ); } } if ( get_theme_support( 'custom-header', 'video' ) && has_header_video() ) { $mods = get_theme_mods(); if ( isset( $mods['header_video'] ) && $post->ID === $mods['header_video'] ) { $media_states[] = __( 'Current Header Video' ); } } } if ( current_theme_supports( 'custom-background' ) ) { $meta_background = get_post_meta( $post->ID, '_wp_attachment_is_custom_background', true ); if ( ! empty( $meta_background ) && $meta_background === $stylesheet ) { $media_states[] = __( 'Background Image' ); $background_image = get_background_image(); if ( $background_image && wp_get_attachment_url( $post->ID ) === $background_image ) { $media_states[] = __( 'Current Background Image' ); } } } if ( (int) get_option( 'site_icon' ) === $post->ID ) { $media_states[] = __( 'Site Icon' ); } if ( (int) get_theme_mod( 'custom_logo' ) === $post->ID ) { $media_states[] = __( 'Logo' ); } return apply_filters( 'display_media_states', $media_states, $post ); } function compression_test() { ?>
	<script type="text/javascript">
	var compressionNonce = <?php echo wp_json_encode( wp_create_nonce( 'update_can_compress_scripts' ) ); ?>;
	var testCompression = {
		get : function(test) {
			var x;
			if ( window.XMLHttpRequest ) {
				x = new XMLHttpRequest();
			} else {
				try{x=new ActiveXObject('Msxml2.XMLHTTP');}catch(e){try{x=new ActiveXObject('Microsoft.XMLHTTP');}catch(e){};}
			}

			if (x) {
				x.onreadystatechange = function() {
					var r, h;
					if ( x.readyState == 4 ) {
						r = x.responseText.substr(0, 18);
						h = x.getResponseHeader('Content-Encoding');
						testCompression.check(r, h, test);
					}
				};

				x.open('GET', ajaxurl + '?action=wp-compression-test&test='+test+'&_ajax_nonce='+compressionNonce+'&'+(new Date()).getTime(), true);
				x.send('');
			}
		},

		check : function(r, h, test) {
			if ( ! r && ! test )
				this.get(1);

			if ( 1 == test ) {
				if ( h && ( h.match(/deflate/i) || h.match(/gzip/i) ) )
					this.get('no');
				else
					this.get(2);

				return;
			}

			if ( 2 == test ) {
				if ( '"wpCompressionTest' === r )
					this.get('yes');
				else
					this.get('no');
			}
		}
	};
	testCompression.check();
	</script>
	<?php
} function submit_button( $text = null, $type = 'primary', $name = 'submit', $wrap = true, $other_attributes = null ) { echo get_submit_button( $text, $type, $name, $wrap, $other_attributes ); } function get_submit_button( $text = '', $type = 'primary large', $name = 'submit', $wrap = true, $other_attributes = '' ) { if ( ! is_array( $type ) ) { $type = explode( ' ', $type ); } $button_shorthand = array( 'primary', 'small', 'large' ); $classes = array( 'button' ); foreach ( $type as $t ) { if ( 'secondary' === $t || 'button-secondary' === $t ) { continue; } $classes[] = in_array( $t, $button_shorthand, true ) ? 'button-' . $t : $t; } $class = implode( ' ', array_unique( array_filter( $classes ) ) ); $text = $text ? $text : __( 'Save Changes' ); $id = $name; if ( is_array( $other_attributes ) && isset( $other_attributes['id'] ) ) { $id = $other_attributes['id']; unset( $other_attributes['id'] ); } $attributes = ''; if ( is_array( $other_attributes ) ) { foreach ( $other_attributes as $attribute => $value ) { $attributes .= $attribute . '="' . esc_attr( $value ) . '" '; } } elseif ( ! empty( $other_attributes ) ) { $attributes = $other_attributes; } $name_attr = $name ? ' name="' . esc_attr( $name ) . '"' : ''; $id_attr = $id ? ' id="' . esc_attr( $id ) . '"' : ''; $button = '<input type="submit"' . $name_attr . $id_attr . ' class="' . esc_attr( $class ); $button .= '" value="' . esc_attr( $text ) . '" ' . $attributes . ' />'; if ( $wrap ) { $button = '<p class="submit">' . $button . '</p>'; } return $button; } function _wp_admin_html_begin() { global $is_IE; $admin_html_class = ( is_admin_bar_showing() ) ? 'wp-toolbar' : ''; if ( $is_IE ) { header( 'X-UA-Compatible: IE=edge' ); } ?>
<!DOCTYPE html>
<html class="<?php echo $admin_html_class; ?>"
	<?php
 do_action( 'admin_xml_ns' ); language_attributes(); ?>
>
<head>
<meta http-equiv="Content-Type" content="<?php bloginfo( 'html_type' ); ?>; charset=<?php echo get_option( 'blog_charset' ); ?>" />
	<?php
} function convert_to_screen( $hook_name ) { if ( ! class_exists( 'WP_Screen' ) ) { _doing_it_wrong( 'convert_to_screen(), add_meta_box()', sprintf( __( 'Likely direct inclusion of %1$s in order to use %2$s. This is very wrong. Hook the %2$s call into the %3$s action instead.' ), '<code>wp-admin/includes/template.php</code>', '<code>add_meta_box()</code>', '<code>add_meta_boxes</code>' ), '3.3.0' ); return (object) array( 'id' => '_invalid', 'base' => '_are_belong_to_us', ); } return WP_Screen::get( $hook_name ); } function _local_storage_notice() { ?>
	<div id="local-storage-notice" class="hidden notice is-dismissible">
	<p class="local-restore">
		<?php _e( 'The backup of this post in your browser is different from the version below.' ); ?>
		<button type="button" class="button restore-backup"><?php _e( 'Restore the backup' ); ?></button>
	</p>
	<p class="help">
		<?php _e( 'This will replace the current editor content with the last backup version. You can use undo and redo in the editor to get the old content back or to return to the restored version.' ); ?>
	</p>
	</div>
	<?php
} function wp_star_rating( $args = array() ) { $defaults = array( 'rating' => 0, 'type' => 'rating', 'number' => 0, 'echo' => true, ); $parsed_args = wp_parse_args( $args, $defaults ); $rating = (float) str_replace( ',', '.', $parsed_args['rating'] ); if ( 'percent' === $parsed_args['type'] ) { $rating = round( $rating / 10, 0 ) / 2; } $full_stars = floor( $rating ); $half_stars = ceil( $rating - $full_stars ); $empty_stars = 5 - $full_stars - $half_stars; if ( $parsed_args['number'] ) { $format = _n( '%1$s rating based on %2$s rating', '%1$s rating based on %2$s ratings', $parsed_args['number'] ); $title = sprintf( $format, number_format_i18n( $rating, 1 ), number_format_i18n( $parsed_args['number'] ) ); } else { $title = sprintf( __( '%s rating' ), number_format_i18n( $rating, 1 ) ); } $output = '<div class="star-rating">'; $output .= '<span class="screen-reader-text">' . $title . '</span>'; $output .= str_repeat( '<div class="star star-full" aria-hidden="true"></div>', $full_stars ); $output .= str_repeat( '<div class="star star-half" aria-hidden="true"></div>', $half_stars ); $output .= str_repeat( '<div class="star star-empty" aria-hidden="true"></div>', $empty_stars ); $output .= '</div>'; if ( $parsed_args['echo'] ) { echo $output; } return $output; } function _wp_posts_page_notice() { printf( '<div class="notice notice-warning inline"><p>%s</p></div>', __( 'You are currently editing the page that shows your latest posts.' ) ); } function _wp_block_editor_posts_page_notice() { wp_add_inline_script( 'wp-notices', sprintf( 'wp.data.dispatch( "core/notices" ).createWarningNotice( "%s", { isDismissible: false } )', __( 'You are currently editing the page that shows your latest posts.' ) ), 'after' ); } 