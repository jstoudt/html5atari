/**
 * pia.js -- Peripheral Interface Adaptor
 * Author: Jason T. Stoudt
 * Date: 1 April 2012
 *
 * A javascript representation of the PIA used for timers, RAM and
 * I/O ports in the Atari 2600.
 */

window.RIOT = (function() {
		// the memory map shared by other components of the system
	var mmap = null,
		
		// the timer value
		timer = 0x00,
		
		// the currently selected INTERVAL MODE value
		intervalMode = 'NONE',

		// internal registers for the console switches
		P0DIFFICULTY = false,
		P1DIFFICULTY = false,
		COLOR        = false,
		SELECT       = false,
		RESET        = false,
		
		// interval registers for the joystick controller values
		P0_UP        = true,
		P0_DOWN      = true,
		P0_LEFT      = true,
		P0_RIGHT     = true,
		
		P1_UP        = true,
		P1_DOWN      = true,
		P1_LEFT      = true,
		P1_RIGHT     = true,
		
		// internal registers for SWITCH A values
		SWACNT       = 0x00,
		
		SWCHB        = 0x34,
		SWBCNT       = 0x00,

		getINTIM = function() {
			return (timer < 0 ? timer :
				intervalMode === 'TIM1T' ? timer :
				intervalMode === 'TIM8T' ? timer >>> 3 :
				intervalMode === 'TIM64T' ? timer >>> 6 :
				timer >>> 10) & 0xff;
		};

	return {

		init: function( memory ) {
			var i;
			mmap = memory;

			// randomize the RIOT RAM
			for (i = 0x80; i <= 0xff; i++) {
				mmap.writeByte(i, Math.floor(Math.random() * 0xff));
			}

			mmap.addReadOnly(MEM_LOCATIONS.SWCHA, function() {
				var val = 0x00;

				if (P0_RIGHT === true) {
					val |= 0x80;
				}
				if (P0_LEFT === true) {
					val |= 0x40;
				}
				if (P0_DOWN === true) {
					val |= 0x20;
				}
				if (P0_UP === true) {
					val |= 0x10;
				}
				if (P1_RIGHT === true) {
					val |= 0x08;
				}
				if (P1_LEFT === true) {
					val |= 0x04;
				}
				if (P1_DOWN === true) {
					val |= 0x02;
				}
				if (P1_UP === true) {
					val |= 0x01;
				}

				return val;
			});

			mmap.addReadOnly(MEM_LOCATIONS.SWACNT, function() {
				return SWACNT;
			});

			mmap.addReadOnly(MEM_LOCATIONS.SWCHB, function() {
				// unused bits in the SWCHB byte should be set
				var val = 0x34;

				if (P1DIFFICULTY === true) {
					val |= 0x80;
				}
				if (P0DIFFICULTY === true) {
					val |= 0x40;
				}
				if (COLOR === true) {
					val |= 0x08;
				}
				if (SELECT === true) {
					val |= 0x02;
				}
				if (RESET === true) {
					val |= 0x01;
				}
				return val;
			});

			mmap.addReadOnly(MEM_LOCATIONS.SWBCNT, function() {
				return SWBCNT;
			});

			mmap.addReadOnly(MEM_LOCATIONS.INTIM, function() {
				return getINTIM();
			});

			mmap.addReadOnly(MEM_LOCATIONS.TIMINT, function() {
				return timer < 0 ? 0x80 : 0x00;
			});

			mmap.addWriteOnly(MEM_LOCATIONS.TIM1T, function( val ) {
				intervalMode = 'TIM1T';
				timer = val;
			});

			mmap.addWriteOnly(MEM_LOCATIONS.TIM8T, function( val ) {
				intervalMode = 'TIM8T';
				timer = val << 3;
			});

			mmap.addWriteOnly(MEM_LOCATIONS.TIM64T, function( val ) {
				intervalMode = 'TIM64T';
				timer = val << 6;
			});

			mmap.addWriteOnly(MEM_LOCATIONS.T1024T, function( val ) {
				intervalMode = 'T1024T';
				timer = val << 10;
			});

			// Add Mirror maps for the entire RAM and other RIOT addresses
			mmap.addMirror(0x0180, 0x1ff, 0x100);

			mmap.addMirror(0x2a0, 0x2bf, 0x20);
			mmap.addMirror(0x2c0, 0x2df, 0x40);
			mmap.addMirror(0x2e0, 0x2ff, 0x60);

			mmap.addMirror(0x380, 0x39f, 0x100);
			mmap.addMirror(0x3a0, 0x3bf, 0x120);
			mmap.addMirror(0x3c0, 0x3df, 0x140);
			mmap.addMirror(0x3e0, 0x3ff, 0x160);
			
			for (i = 0x400; i <= 0xc00; i += 0x400) {
				if (i >= 0x1000 && i <= 0x1ff) {
					continue;
				}
				// repeating RAM mirrors
				mmap.addMirror(i + 0x80, i + 0xff, i);
				mmap.addMirror(i + 0x180, i + 0x1ff, i + 0x100);

				// repeating RIOT mirrors
				mmap.addMirror(i + 0x280, i + 0x29f, i);
				mmap.addMirror(i + 0x2a0, i + 0x2bf, i + 0x20);
				mmap.addMirror(i + 0x2c0, i + 0x2df, i + 0x40);
				mmap.addMirror(i + 0x2e0, i + 0x2ff, i + 0x60);

				mmap.addMirror(i + 0x380, i + 0x39f, i + 0x100);
				mmap.addMirror(i + 0x3a0, i + 0x3bf, i + 0x120);
				mmap.addMirror(i + 0x3c0, i + 0x3df, i + 0x140);
				mmap.addMirror(i + 0x3e0, i + 0x3ff, i + 0x160);
			}

			timer = Math.floor(Math.random() * 0xffffffff);
		},

		cycle: function() {
			// decrement the timer
			timer--;
		},

		setConsoleSwitch: function( name, value ) {
			value = !!value;

			switch (name) {
				case 'difficulty0':
					P0DIFFICULTY = value;
					break;
				case 'difficulty1':
					P1DIFFICULTY = value;
					break;
				case 'color':
					COLOR = value;
					break;
				case 'select':
					SELECT = value;
					break;
				case 'reset':
					RESET = value;
					break;
			}
		},

		setJoystickValue: function( p, dir, val ) {
			if (p === 0) {
				switch (dir) {
					case 'up':
						P0_UP = val;
						break;
					case 'left':
						P0_LEFT = val;
						break;
					case 'right':
						P0_RIGHT = val;
						break;
					case 'down':
						P0_DOWN = val;
						break;
				}
			} else {
				switch(dir) {
					case 'up':
						P1_UP = val;
						break;
					case 'left':
						P1_LEFT = val;
						break;
					case 'right':
						P1_RIGHT = val;
						break;
					case 'down':
						P1_DOWN = val;
						break;
				}
			}

		},

		getTimerRegisters: function() {
			return {
				timerMode: intervalMode,
				intim:     getINTIM(),
				timint:    timer < 0 ? 0x80 : 0x00,
				timer:     timer
			};
		},

		getConsoleSwitches: function() {
			return {
				p0difficulty: P0DIFFICULTY,
				p1difficulty: P1DIFFICULTY,
				color:        COLOR,
				select:       SELECT,
				reset:        RESET
			};
		},

		getJoystickInfo: function( p ) {
			if (p === 0) {
				return {
					up:    P0_UP,
					left:  P0_LEFT,
					right: P0_RIGHT,
					down:  P0_DOWN
				};
			} else {
				return {
					up:    P1_UP,
					left:  P1_LEFT,
					right: P1_RIGHT,
					down:  P1_DOWN
				};
			}
		}
	};

})();