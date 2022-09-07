<?php
 class WP_Customize_Site_Icon_Control extends WP_Customize_Cropped_Image_Control { public $type = 'site_icon'; public function __construct( $manager, $id, $args = array() ) { parent::__construct( $manager, $id, $args ); add_action( 'customize_controls_print_styles', 'wp_site_icon', 99 ); } public function content_template() { ?>
		<# if ( data.label ) { #>
			<span class="customize-control-title">{{ data.label }}</span>
		<# } #>
		<# if ( data.description ) { #>
			<span class="description customize-control-description">{{{ data.description }}}</span>
		<# } #>

		<# if ( data.attachment && data.attachment.id ) { #>
			<div class="attachment-media-view">
				<# if ( data.attachment.sizes ) { #>
					<div class="site-icon-preview wp-clearfix">
						<div class="favicon-preview">
							<img src="<?php echo esc_url( admin_url( 'images/' . ( is_rtl() ? 'browser-rtl.png' : 'browser.png' ) ) ); ?>" class="browser-preview" width="182" alt="" />

							<div class="favicon">
								<img src="{{ data.attachment.sizes.full ? data.attachment.sizes.full.url : data.attachment.url }}" alt="<?php esc_attr_e( 'Preview as a browser icon' ); ?>" />
							</div>
							<span class="browser-title" aria-hidden="true"><# print( '<?php bloginfo( 'name' ); ?>' ) #></span>
						</div>
						<img class="app-icon-preview" src="{{ data.attachment.sizes.full ? data.attachment.sizes.full.url : data.attachment.url }}" alt="<?php esc_attr_e( 'Preview as an app icon' ); ?>" />
					</div>
				<# } #>
				<div class="actions">
					<# if ( data.canUpload ) { #>
						<button type="button" class="button remove-button"><?php echo $this->button_labels['remove']; ?></button>
						<button type="button" class="button upload-button"><?php echo $this->button_labels['change']; ?></button>
					<# } #>
				</div>
			</div>
		<# } else { #>
			<div class="attachment-media-view">
				<# if ( data.canUpload ) { #>
					<button type="button" class="upload-button button-add-media"><?php echo $this->button_labels['site_icon']; ?></button>
				<# } #>
				<div class="actions">
					<# if ( data.defaultAttachment ) { #>
						<button type="button" class="button default-button"><?php echo $this->button_labels['default']; ?></button>
					<# } #>
				</div>
			</div>
		<# } #>
		<?php
 } } 