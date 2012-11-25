/**
 * script.js
 *
 * Date: 3 July 2012
 * Functionality for the controller configuration wizard.
 */

var Wizard = (function() {
	var player = null,
		wizard = null;

	function KeyboardJoystick() {
		
	}

	return {

		init: function( w, onLoadFn, onCloseFn ) {
			wizard = w;

			$(wizard).overlay({

				top: '20%',

				mask: {
					color: '#000',
					loadSpeed: 300,
					opacity: 0.8
				},

				// keep the overlay open when the user clicks around it
				closeOnClick: false,

				// before the wizard opens, execute the passed in function
				onBeforeLoad: onLoadFn,

				// execute the passed in function when the wizard closes
				onClose: onCloseFn
			});

		},

		start: function( p ) {
			player = p;

			$(wizard).overlay().load();
		},

		cancel: function() {
			player = null;
			wizard = null;

			$(wizard).overlay().close();
		}

	};

 })();