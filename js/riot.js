/**
 * pia.js -- Peripheral Interface Adaptor
 * Author: Jason T. Stoudt
 * Date: 1 April 2012
 *
 * A javascript representation of the PIA used for timers, RAM and
 * I/O ports in the Atari 2600.
 */

var RIOT = (function() {

	var MEM_LOCATIONS = {

		INTIM:  0x284,  // the read register

		TIMINT: 0x285,  // seems to be 0x00 until the timer expires, then 0x80

		TIM1T:  0x294,
		TIM8T:  0x295,
		TIM64T: 0x296,
		T1024T: 0x297
		
	},

		INTERVAL_MODE = {
			NONE:   0,
			TIM1T:  1,
			TIM8T:  8,
			TIM64T: 64,
			T1024T: 1024
		},

		timer, // the timer value

		intervalMode,  // whether divide by 1t, 8t, 64t or 1024t is selected

		mmap; // the memory map shared by other components of the system

	return {

		init: function(memory) {
			
			mmap = memory;

			timer = Math.round(Math.random() * 0xffffffff);

			intervalMode = INTERVAL_MODE.NONE;

			mmap.writeByte(0, MEM_LOCATIONS.TIMINT);
			mmap.writeByte(0, MEM_LOCATIONS.TIM1T);
			mmap.writeByte(0, MEM_LOCATIONS.TIM8T);
			mmap.writeByte(0, MEM_LOCATIONS.TIM64T);
			mmap.writeByte(0, MEM_LOCATIONS.T1024T);
		},

		cycle: function() {
			var tim1t, tim8t, tim64t, t1024t;

			// decrement the timer
			timer = (timer - 1) & 0xffffffff;

			// check if the TIM1T register has been written to
			tim1t = mmap.readByte(MEM_LOCATIONS.TIM1T);
			if (tim1t > 0) {
				mmap.writeByte(0, MEM_LOCATIONS.TIM1T);
				timer = tim1t;
				intervalMode = INTERVAL_MODE.TIM1T;
			}

			// check if the TIM8T register has been written to
			tim8t = mmap.readByte(MEM_LOCATIONS.TIM8T);
			if (tim8t > 0) {
				mmap.writeByte(0, MEM_LOCATIONS.TIM8T);
				timer = tim8t << 3;
				intervalMode = INTERVAL_MODE.TIM8T;
			}

			// check if the TIM64T register has been written to
			tim64t = mmap.readByte(MEM_LOCATIONS.TIM64T);
			if (tim64t > 0) {
				mmap.writeByte(0, MEM_LOCATIONS.TIM64T);
				timer = tim64t << 6;
				intervalMode = INTERVAL_MODE.TIM64T;
			}

			// check if the the T1024T register has been written to
			t1024t = mmap.readByte(MEM_LOCATIONS.T1024T);
			if (t1024t > 0) {
				mmap.writeByte(0, MEM_LOCATIONS.T1024T);
				timer = t1024t << 10;
				intervalMode = INTERVAL_MODE.T1024T;
			}
/*
			if (timer < 0) {
				mmap.writeByte(0x80, MEM_LOCATIONS.TIMINT);
				mmap.writeByte
			}
*/

		}

	};

})();