<?php
 _deprecated_file( basename( __FILE__ ), '4.9.0' ); class WP_Customize_New_Menu_Section extends WP_Customize_Section { public $type = 'new_menu'; public function __construct( WP_Customize_Manager $manager, $id, array $args = array() ) { _deprecated_function( __METHOD__, '4.9.0' ); parent::__construct( $manager, $id, $args ); } protected function render() { _deprecated_function( __METHOD__, '4.9.0' ); ?>
		<li id="accordion-section-<?php echo esc_attr( $this->id ); ?>" class="accordion-section-new-menu">
			<button type="button" class="button add-new-menu-item add-menu-toggle" aria-expanded="false">
				<?php echo esc_html( $this->title ); ?>
			</button>
			<ul class="new-menu-section-content"></ul>
		</li>
		<?php
 } } 