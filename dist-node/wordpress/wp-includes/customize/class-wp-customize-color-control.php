<?php
 class WP_Customize_Color_Control extends WP_Customize_Control { public $type = 'color'; public $statuses; public $mode = 'full'; public function __construct( $manager, $id, $args = array() ) { $this->statuses = array( '' => __( 'Default' ) ); parent::__construct( $manager, $id, $args ); } public function enqueue() { wp_enqueue_script( 'wp-color-picker' ); wp_enqueue_style( 'wp-color-picker' ); } public function to_json() { parent::to_json(); $this->json['statuses'] = $this->statuses; $this->json['defaultValue'] = $this->setting->default; $this->json['mode'] = $this->mode; } public function render_content() {} public function content_template() { ?>
		<# var defaultValue = '#RRGGBB', defaultValueAttr = '',
			isHueSlider = data.mode === 'hue';
		if ( data.defaultValue && _.isString( data.defaultValue ) && ! isHueSlider ) {
			if ( '#' !== data.defaultValue.substring( 0, 1 ) ) {
				defaultValue = '#' + data.defaultValue;
			} else {
				defaultValue = data.defaultValue;
			}
			defaultValueAttr = ' data-default-color=' + defaultValue; // Quotes added automatically.
		} #>
		<# if ( data.label ) { #>
			<span class="customize-control-title">{{{ data.label }}}</span>
		<# } #>
		<# if ( data.description ) { #>
			<span class="description customize-control-description">{{{ data.description }}}</span>
		<# } #>
		<div class="customize-control-content">
			<label><span class="screen-reader-text">{{{ data.label }}}</span>
			<# if ( isHueSlider ) { #>
				<input class="color-picker-hue" type="text" data-type="hue" />
			<# } else { #>
				<input class="color-picker-hex" type="text" maxlength="7" placeholder="{{ defaultValue }}" {{ defaultValueAttr }} />
			<# } #>
			</label>
		</div>
		<?php
 } } 