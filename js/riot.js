/**
 * pia.js -- Peripheral Interface Adaptor
 * Author: Jason T. Stoudt
 * Date: 1 April 2012
 *
 * A javascript representation of the PIA used for timers, RAM and
 * I/O ports in the Atari 2600.
 */

window.RIOT = (function() {

	var MEM_LOCATIONS = {

		// Port A data register for joysticks
		// bits 4-7 for P0, bits 0-3 for P1
		SWCHA:  0x280,
		SWACNT: 0x281,  // Port A data direction register

		SWCHB:  0x282,  // Port B data (console switches)
		SWBCNT: 0x283,  // Port B data direction register

		INTIM:  0x284,  // the read register
		TIMINT: 0x285,  // seems to be 0x00 until the timer expires, then 0x80

		// the various input registers for setting the timer
		TIM1T:  0x294,		TIM8T:  0x295,
		TIM64T: 0x296,		T1024T: 0x297
	},

		// whether divide by 1t, 8t, 64t or 1024t is selected
		INTERVAL_MODE = {
			NONE:   0,
			TIM1T:  1,
			TIM8T:  8,
			TIM64T: 64,
			T1024T: 1024
		},

		timer, // the timer value

		intervalMode,  // the currently selected INTERVAL MODE value

		mmap; // the memory map shared by other components of the system

	return {

		init: function(memory) {
			
			mmap = memory;

			// initialize the SWCHA and SWACNT registers
			mmap.writeByte(0xff, MEM_LOCATIONS.SWCHA);
			mmap.writeByte(0, MEM_LOCATIONS.SWACNT);

			// initialize the SWCHB and SWBCNT registers
			mmap.writeByte(0xff, MEM_LOCATIONS.SWCHB);
			mmap.writeByte(0, MEM_LOCATIONS.SWBCNT);

			timer = Math.floor(Math.random() * 0xffffffff);

			intervalMode = INTERVAL_MODE.NONE;

			// initialize the timer registers
			mmap.writeByte(timer < 0 ? 0x80 : 0, MEM_LOCATIONS.TIMINT);
			mmap.writeByte(timer & 0xff, MEM_LOCATIONS.INTIM);
			mmap.writeByte(0, MEM_LOCATIONS.TIM1T);
			mmap.writeByte(0, MEM_LOCATIONS.TIM8T);
			mmap.writeByte(0, MEM_LOCATIONS.TIM64T);
			mmap.writeByte(0, MEM_LOCATIONS.T1024T);
		},

		cycle: function() {
			var intim,
				tim1t  = mmap.readByte(MEM_LOCATIONS.TIM1T),
				tim8t  = mmap.readByte(MEM_LOCATIONS.TIM8T),
				tim64t = mmap.readByte(MEM_LOCATIONS.TIM64T),
				t1024t = mmap.readByte(MEM_LOCATIONS.T1024T);

			// decrement the timer
			timer--;

			// check if the TIM1T register has been written to
			if (tim1t > 0) {
				mmap.writeByte(0, MEM_LOCATIONS.TIM1T);
				timer = tim1t;
				intervalMode = INTERVAL_MODE.TIM1T;
			}

			// check if the TIM8T register has been written to
			if (tim8t > 0) {
				mmap.writeByte(0, MEM_LOCATIONS.TIM8T);
				timer = tim8t << 3;
				intervalMode = INTERVAL_MODE.TIM8T;
			}

			// check if the TIM64T register has been written to
			if (tim64t > 0) {
				mmap.writeByte(0, MEM_LOCATIONS.TIM64T);
				timer = tim64t << 6;
				intervalMode = INTERVAL_MODE.TIM64T;
			}

			// check if the the T1024T register has been written to
			if (t1024t > 0) {
				mmap.writeByte(0, MEM_LOCATIONS.T1024T);
				timer = t1024t << 10;
				intervalMode = INTERVAL_MODE.T1024T;
			}

			mmap.writeByte((timer < 0 ? timer :
					intervalMode === INTERVAL_MODE.TIM1T ? timer :
					intervalMode === INTERVAL_MODE.TIM8T ? timer >>> 3 :
					intervalMode === INTERVAL_MODE.TIM64T ? timer >>> 6 :
					timer >>> 10) & 0xff,
				MEM_LOCATIONS.INTIM);
			
			mmap.writeByte(timer < 0 ? 0x80 : 0, MEM_LOCATIONS.TIMINT);
		},

		setConsoleSwitch: function(name, value) {
			var swchb = mmap.readByte(MEM_LOCATIONS.SWCHB);

			if (value) {
				swchb |= name === 'reset' ? 0x01 :
					name === 'select' ? 0x02 :
					name === 'color' ? 0x08 :
					name === 'difficulty0' ? 0x40 :
					name === 'difficulty1' ? 0x80 :
					(function() {
						throw new Error('Unknown console switch name');
					})();
			} else {
				swchb &= name === 'reset' ? 0xfe :
					name === 'select' ? 0xfd :
					name === 'color' ? 0xf7 :
					name === 'difficulty0' ? 0xbf :
					name === 'difficulty1' ? 0x7f :
					(function() {
						throw new Error('Unknown console switch name');
					})();
			}

			mmap.writeByte(swchb, MEM_LOCATIONS.SWCHB);
		},

		getTimerRegisters: function() {
			return {
				timerMode: intervalMode === INTERVAL_MODE.TIM1T ? 'TIM1T' :
					intervalMode === INTERVAL_MODE.TIM8T ? 'TIM8T' :
					intervalMode === INTERVAL_MODE.TIM64T ? 'TIM64T' :
					intervalMode === INTERVAL_MODE.T1024T ? 'T1024T' :
					'NONE',
				intim:     mmap.readByte(MEM_LOCATIONS.INTIM),
				timint:    mmap.readByte(MEM_LOCATIONS.TIMINT),
				timer:     timer
			};
		},

		getConsoleSwitches: function() {
			var swchb = mmap.readByte(MEM_LOCATIONS.SWCHB);
			
			return {
				p0difficulty: !!(swchb & 0x80),
				p1difficulty: !!(swchb & 0x40),
				color:        !!(swchb & 0x08),
				select:       !!(swchb & 0x02),
				reset:        !!(swchb & 0x01)
			};
		}
	};

})();