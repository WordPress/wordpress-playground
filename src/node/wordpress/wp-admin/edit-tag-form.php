<?php
 if ( ! defined( 'ABSPATH' ) ) { die( '-1' ); } if ( 'category' === $taxonomy ) { do_action_deprecated( 'edit_category_form_pre', array( $tag ), '3.0.0', '{$taxonomy}_pre_edit_form' ); } elseif ( 'link_category' === $taxonomy ) { do_action_deprecated( 'edit_link_category_form_pre', array( $tag ), '3.0.0', '{$taxonomy}_pre_edit_form' ); } else { do_action_deprecated( 'edit_tag_form_pre', array( $tag ), '3.0.0', '{$taxonomy}_pre_edit_form' ); } wp_reset_vars( array( 'wp_http_referer' ) ); $wp_http_referer = remove_query_arg( array( 'action', 'message', 'tag_ID' ), $wp_http_referer ); require_once ABSPATH . 'wp-admin/includes/edit-tag-messages.php'; do_action( "{$taxonomy}_pre_edit_form", $tag, $taxonomy ); ?>

<div class="wrap">
<h1><?php echo $tax->labels->edit_item; ?></h1>

<?php
$class = ( isset( $msg ) && 5 === $msg ) ? 'error' : 'success'; if ( $message ) { ?>
<div id="message" class="notice notice-<?php echo $class; ?>">
	<p><strong><?php echo $message; ?></strong></p>
	<?php if ( $wp_http_referer ) { ?>
	<p><a href="<?php echo esc_url( wp_validate_redirect( esc_url_raw( $wp_http_referer ), admin_url( 'term.php?taxonomy=' . $taxonomy ) ) ); ?>">
		<?php echo esc_html( $tax->labels->back_to_items ); ?>
	</a></p>
	<?php } ?>
</div>
	<?php
} ?>

<div id="ajax-response"></div>

<form name="edittag" id="edittag" method="post" action="edit-tags.php" class="validate"
<?php
 do_action( "{$taxonomy}_term_edit_form_tag" ); ?>
>
<input type="hidden" name="action" value="editedtag" />
<input type="hidden" name="tag_ID" value="<?php echo esc_attr( $tag_ID ); ?>" />
<input type="hidden" name="taxonomy" value="<?php echo esc_attr( $taxonomy ); ?>" />
<?php
wp_original_referer_field( true, 'previous' ); wp_nonce_field( 'update-tag_' . $tag_ID ); do_action( "{$taxonomy}_term_edit_form_top", $tag, $taxonomy ); $tag_name_value = ''; if ( isset( $tag->name ) ) { $tag_name_value = esc_attr( $tag->name ); } ?>
	<table class="form-table" role="presentation">
		<tr class="form-field form-required term-name-wrap">
			<th scope="row"><label for="name"><?php _ex( 'Name', 'term name' ); ?></label></th>
			<td><input name="name" id="name" type="text" value="<?php echo $tag_name_value; ?>" size="40" aria-required="true" />
			<p class="description"><?php echo $tax->labels->name_field_description; ?></p></td>
		</tr>
<?php if ( ! global_terms_enabled() ) { ?>
		<tr class="form-field term-slug-wrap">
			<th scope="row"><label for="slug"><?php _e( 'Slug' ); ?></label></th>
			<?php
 $slug = isset( $tag->slug ) ? apply_filters( 'editable_slug', $tag->slug, $tag ) : ''; ?>
			<td><input name="slug" id="slug" type="text" value="<?php echo esc_attr( $slug ); ?>" size="40" />
			<p class="description"><?php echo $tax->labels->slug_field_description; ?></p></td>
		</tr>
<?php } ?>
<?php if ( is_taxonomy_hierarchical( $taxonomy ) ) : ?>
		<tr class="form-field term-parent-wrap">
			<th scope="row"><label for="parent"><?php echo esc_html( $tax->labels->parent_item ); ?></label></th>
			<td>
				<?php
 $dropdown_args = array( 'hide_empty' => 0, 'hide_if_empty' => false, 'taxonomy' => $taxonomy, 'name' => 'parent', 'orderby' => 'name', 'selected' => $tag->parent, 'exclude_tree' => $tag->term_id, 'hierarchical' => true, 'show_option_none' => __( 'None' ), ); $dropdown_args = apply_filters( 'taxonomy_parent_dropdown_args', $dropdown_args, $taxonomy, 'edit' ); wp_dropdown_categories( $dropdown_args ); ?>
				<?php if ( 'category' === $taxonomy ) : ?>
					<p class="description"><?php _e( 'Categories, unlike tags, can have a hierarchy. You might have a Jazz category, and under that have children categories for Bebop and Big Band. Totally optional.' ); ?></p>
				<?php else : ?>
					<p class="description"><?php echo $tax->labels->parent_field_description; ?></p>
				<?php endif; ?>
			</td>
		</tr>
<?php endif; ?>
		<tr class="form-field term-description-wrap">
			<th scope="row"><label for="description"><?php _e( 'Description' ); ?></label></th>
			<td><textarea name="description" id="description" rows="5" cols="50" class="large-text"><?php echo $tag->description; ?></textarea>
			<p class="description"><?php echo $tax->labels->desc_field_description; ?></p></td>
		</tr>
		<?php
 if ( 'category' === $taxonomy ) { do_action_deprecated( 'edit_category_form_fields', array( $tag ), '3.0.0', '{$taxonomy}_edit_form_fields' ); } elseif ( 'link_category' === $taxonomy ) { do_action_deprecated( 'edit_link_category_form_fields', array( $tag ), '3.0.0', '{$taxonomy}_edit_form_fields' ); } else { do_action_deprecated( 'edit_tag_form_fields', array( $tag ), '3.0.0', '{$taxonomy}_edit_form_fields' ); } do_action( "{$taxonomy}_edit_form_fields", $tag, $taxonomy ); ?>
	</table>
<?php
 if ( 'category' === $taxonomy ) { do_action_deprecated( 'edit_category_form', array( $tag ), '3.0.0', '{$taxonomy}_add_form' ); } elseif ( 'link_category' === $taxonomy ) { do_action_deprecated( 'edit_link_category_form', array( $tag ), '3.0.0', '{$taxonomy}_add_form' ); } else { do_action_deprecated( 'edit_tag_form', array( $tag ), '3.0.0', '{$taxonomy}_edit_form' ); } do_action( "{$taxonomy}_edit_form", $tag, $taxonomy ); ?>

<div class="edit-tag-actions">

	<?php submit_button( __( 'Update' ), 'primary', null, false ); ?>

	<?php if ( current_user_can( 'delete_term', $tag->term_id ) ) : ?>
		<span id="delete-link">
			<a class="delete" href="<?php echo esc_url( admin_url( wp_nonce_url( "edit-tags.php?action=delete&taxonomy=$taxonomy&tag_ID=$tag->term_id", 'delete-tag_' . $tag->term_id ) ) ); ?>"><?php _e( 'Delete' ); ?></a>
		</span>
	<?php endif; ?>

</div>

</form>
</div>

<?php if ( ! wp_is_mobile() ) : ?>
<script type="text/javascript">
try{document.forms.edittag.name.focus();}catch(e){}
</script>
	<?php
endif; 