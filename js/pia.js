/**
 * pia.js -- Peripheral Interface Adaptor
 * Author: Jason T. Stoudt
 * Date: 1 April 2012
 *
 * A javascript representation of the PIA used for timers, RAM and
 * I/O ports in the Atari 2600.
 */

var PIA = (function() {

	var MEM_LOCATIONS = {

		INTIM:  0x284,  // the read register

		TIMINT: 0x285,  // not sure what this register does as of yet

		TIM1T:  0x294,
		TIM8T:  0x295,
		TIM64T: 0x296,
		T1024T: 0x297
		
	},

		timer, // the timer value

		mmap; // the memory map shared by other components of the system

	return {

		init: function(memory) {
			var reg;

			mmap = memory;

			timer = 0;

			for (reg in MEM_LOCATIONS) {
				mmap.writeByte(0, MEM_LOCATIONS[reg]);
			}
		},

		cycle: function() {
			
		}

	};

})();