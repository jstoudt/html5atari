/*global Utility:false*/

/**
 * pia.js -- Peripheral Interface Adaptor
 * Author: Jason T. Stoudt
 * Date: 1 April 2012
 *
 * A javascript representation of the PIA used for timers, RAM and
 * I/O ports in the Atari 2600.
 */

function RIOT( memory ) {

	var MEM_LOCATIONS = Utility.MEM_LOCATIONS,
		VOID = Utility.VOID,
		intimList   = [ 0x284, 0x286, 0x28c, 0x28e ],
		timintList  = [ 0x285, 0x287, 0x28d, 0x28f ],
		tim1tList   = [ 0x294, 0x29c ],
		tim8tList   = [ 0x295, 0x29d ],
		tim64tList  = [ 0x296, 0x29e ],
		t1024tList  = [ 0x297, 0x29f ],
		i;

	// the memory map shared by other components of the system
	this.mmap = memory;

	// the timer value
	this.timer = 0;

	// the currently selected INTERVAL MODE value
	this.intervalMode = 'NONE';

	// the 128 bytes of RAM on the RIOT
	this.RAM = new Uint8Array( new ArrayBuffer( 128 ));

	// internal registers for the console switches
	this.P0DIFFICULTY = false;
	this.P1DIFFICULTY = false;
	this.COLOR        = false;
	this.SELECT       = false;
	this.RESET        = false;

	// interval registers for the joystick controller values
	this.P0_UP        = true;
	this.P0_DOWN      = true;
	this.P0_LEFT      = true;
	this.P0_RIGHT     = true;

	this.P1_UP        = true;
	this.P1_DOWN      = true;
	this.P1_LEFT      = true;
	this.P1_RIGHT     = true;

	// internal registers for SWITCH A data direction registers
	this.SWACNT       = 0x00;

	// internal registers for switch B data direction registers
	this.SWBCNT       = 0x00;

	// initialize the RAM buffer and randomize the values
	for ( i = 0; i < this.RAM.length; i++ ) {
		this.RAM[i] = Math.floor( Math.random() * 0xff );
	}

	this.mmap.addReadWrite( 0x80, 0xff, this._readRAM, this._writeRAM );

	for ( i = MEM_LOCATIONS.SWCHA; i < 0x2a0; i += 0x08 ) {
		this.mmap.addReadWrite( i, this._readSWCHA, this._writeSWCHA );
	}

	for ( i = MEM_LOCATIONS.SWACNT; i < 0x2a0; i += 0x08 ) {
		this.mmap.addReadWrite( i, this._readSWACNT, this._writeSWACNT );
	}

	for ( i = MEM_LOCATIONS.SWCHB; i < 0x2a0; i += 0x08 ) {
		this.mmap.addReadWrite( i, this._readSWCHB, VOID );
	}

	for ( i = MEM_LOCATIONS.SWBCNT; i < 0x2a0; i += 0x08 ) {
		this.mmap.addReadWrite( i, this._readSWBCNT, VOID );
	}

	for ( i = 0; i < intimList.length; i++ ) {
		this.mmap.addReadWrite( intimList[i], this._readINTIM, VOID );
	}

	for ( i = 0; i < timintList.length; i++ ) {
		this.mmap.addReadWrite( timintList[i], this._readTIMINT, VOID );
	}

	for ( i = 0; i < tim1tList.length; i++ ) {
		this.mmap.addReadWrite( tim1tList[i], this._readINTIM, this._writeTIM1T );
	}

	for ( i = 0; i < tim8tList.length; i++ ) {
		this.mmap.addReadWrite( tim8tList[i], this._readTIMINT, this._writeTIM8T );
	}

	for ( i = 0; i < tim64tList.length; i++ ) {
		this.mmap.addReadWrite( tim64tList[i], this.readINTIM, this._writeTIM64T );
	}

	for ( i = 0; i < t1024tList.length; i++ ) {
		this.mmap.addReadWrite( t1024tList[i], this.readTIMINT, this._writeT1024T );
	}

	// Add Mirror maps for the entire RAM and other RIOT addresses
	this.mmap.addMirror( 0x0180, 0x1ff, 0x100 );

	this.mmap.addMirror( 0x2a0, 0x2bf, 0x20 );
	this.mmap.addMirror( 0x2c0, 0x2df, 0x40 );
	this.mmap.addMirror( 0x2e0, 0x2ff, 0x60 );

	this.mmap.addMirror( 0x380, 0x39f, 0x100 );
	this.mmap.addMirror( 0x3a0, 0x3bf, 0x120 );
	this.mmap.addMirror( 0x3c0, 0x3df, 0x140 );
	this.mmap.addMirror( 0x3e0, 0x3ff, 0x160 );

	for ( i = 0x400; i <= 0xc00; i += 0x400 ) {
		if ( i >= 0x1000 && i <= 0x1ff ) {
			continue;
		}

		// repeating RAM mirrors
		this.mmap.addMirror( i + 0x80, i + 0xff, i );
		this.mmap.addMirror( i + 0x180, i + 0x1ff, i + 0x100 );

		// repeating RIOT mirrors
		this.mmap.addMirror( i + 0x280, i + 0x29f, i );
		this.mmap.addMirror( i + 0x2a0, i + 0x2bf, i + 0x20 );
		this.mmap.addMirror( i + 0x2c0, i + 0x2df, i + 0x40 );
		this.mmap.addMirror( i + 0x2e0, i + 0x2ff, i + 0x60 );

		this.mmap.addMirror( i + 0x380, i + 0x39f, i + 0x100 );
		this.mmap.addMirror( i + 0x3a0, i + 0x3bf, i + 0x120 );
		this.mmap.addMirror( i + 0x3c0, i + 0x3df, i + 0x140 );
		this.mmap.addMirror( i + 0x3e0, i + 0x3ff, i + 0x160 );
	}

	this.timer = Math.floor( Math.random() * 0xffffffff );
}


RIOT.prototype._readINTIM = function() {
	return ( this.timer < 0 ? this.timer :
		this.intervalMode === 'TIM1T' ? this.timer :
		this.intervalMode === 'TIM8T' ? this.timer >>> 3 :
		this.intervalMode === 'TIM64T' ? this.timer >>> 6 :
		this.timer >>> 10 ) & 0xff;
};

RIOT.prototype._readTIMINT = function() {
	return this.timer < 0 ? 0x80 : 0x00;
};

RIOT.prototype._readRAM = function( addr ) {
	return this.RAM[addr - 0x80];
};

RIOT.prototype._writeRAM = function( val, addr ) {
	this.RAM[addr - 0x80] = val;
};

RIOT.prototype._readSWCHA = function() {
	var val = 0x00;

	if (this.P0_RIGHT === true) {
		val |= 0x80;
	}
	if (this.P0_LEFT === true) {
		val |= 0x40;
	}
	if (this.P0_DOWN === true) {
		val |= 0x20;
	}
	if (this.P0_UP === true) {
		val |= 0x10;
	}
	if (this.P1_RIGHT === true) {
		val |= 0x08;
	}
	if (this.P1_LEFT === true) {
		val |= 0x04;
	}
	if (this.P1_DOWN === true) {
		val |= 0x02;
	}
	if (this.P1_UP === true) {
		val |= 0x01;
	}

	return val;
};

RIOT.prototype._writeSWCHA = function( val ) {
	this.P0_RIGHT = !!( val & 0x80 );
	this.P0_LEFT  = !!( val & 0x40 );
	this.P0_DOWN  = !!( val & 0x20 );
	this.P0_UP    = !!( val & 0x10 );

	this.P1_RIGHT = !!( val & 0x08 );
	this.P1_LEFT  = !!( val & 0x04 );
	this.P1_DOWN  = !!( val & 0x02 );
	this.P1_UP    = !!( val & 0x01 );
};

RIOT.prototype._readSWACNT = function() {
	return this.SWACNT;
};


RIOT.prototype._writeSWACNT = function( val ) {
	this.SWACNT = val;
};

RIOT.prototype._readSWCHB = function() {
	// unused bits in the SWCHB byte should be set
	var val = 0x34;

	if (this.P1DIFFICULTY === true) {
		val |= 0x80;
	}
	if (this.P0DIFFICULTY === true) {
		val |= 0x40;
	}
	if (this.COLOR === true) {
		val |= 0x08;
	}
	if (this.SELECT === true) {
		val |= 0x02;
	}
	if (this.RESET === true) {
		val |= 0x01;
	}
	return val;
};

RIOT.prototype._readSWBCNT = function() {
	return this.SWBCNT;
};

RIOT.prototype._writeTIM1T = function( val ) {
	this.intervalMode = 'TIM1T';
	this.timer = val;
};

RIOT.prototype._writeTIM8T = function ( val ) {
	this.intervalMode = 'TIM8T';
	this.timer = val << 3;
};

RIOT.prototype._writeTIM64T = function( val ) {
	this.intervalMode = 'TIM64T';
	this.timer = val << 6;
};

RIOT.prototype._writeT1024T = function( val ) {
	this.intervalMode = 'T1024T';
	this.timer = val << 10;
};

RIOT.prototype.cycle = function() {
	// decrement the timer
	this.timer--;
};

RIOT.prototype.setConsoleSwitch = function( name, val ) {
	switch( name ) {
		case 'difficulty0':
			this.P0DIFFICULTY = !!val;
			break;
		case 'difficulty1':
			this.P1DIFFICULTY = !!val;
			break;
		case 'color':
			this.COLOR = !!val;
			break;
		case 'select':
			this.SELECT = !!val;
			break;
		case 'reset':
			this.RESET = !!val;
			break;
	}
};

/*
var RIOT = (function() {
		// the memory map shared by other components of the system
	var mmap = null,

		// the timer value
		timer = 0x00,

		// the currently selected INTERVAL MODE value
		intervalMode = 'NONE',

		// the 128 bytes of RAM on the RIOT
		RAM = null,

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

		// internal registers for SWITCH A data direction registers
		SWACNT       = 0x00,

		// internal registers for switch B data direction registers
		SWBCNT       = 0x00,

		readINTIM = function() {
			return (timer < 0 ? timer :
				intervalMode === 'TIM1T' ? timer :
				intervalMode === 'TIM8T' ? timer >>> 3 :
				intervalMode === 'TIM64T' ? timer >>> 6 :
				timer >>> 10) & 0xff;
		},

		readTIMINT = function() {
			return timer < 0 ? 0x80 : 0x00;
		},

		readRAM = function( addr ) {
			return RAM[addr - 0x80];
		},

		writeRAM = function( val, addr ) {
			RAM[addr - 0x80] = val;
		},

		readSWCHA = function() {
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
		},

		writeSWCHA = function( val ) {
			P0_RIGHT = !!(val & 0x80);
			P0_LEFT  = !!(val & 0x40);
			P0_DOWN  = !!(val & 0x20);
			P0_UP    = !!(val & 0x10);

			P1_RIGHT = !!(val & 0x08);
			P1_LEFT  = !!(val & 0x04);
			P1_DOWN  = !!(val & 0x02);
			P1_UP    = !!(val & 0x01);
		},

		readSWACNT = function() {
			return SWACNT;
		},

		writeSWACNT = function( val ) {
			SWACNT = val;
		},

		readSWCHB = function() {
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
		},

		readSWBCNT = function() {
			return SWBCNT;
		},

		writeTIM1T = function( val ) {
			intervalMode = 'TIM1T';
			timer = val;
		},

		writeTIM8T = function ( val ) {
			intervalMode = 'TIM8T';
			timer = val << 3;
		},

		writeTIM64T = function( val ) {
			intervalMode = 'TIM64T';
			timer = val << 6;
		},

		writeT1024T = function( val ) {
			intervalMode = 'T1024T';
			timer = val << 10;
		};

	return {

		init: function( memory ) {
			var i,
				MEM_LOCATIONS = Utility.MEM_LOCATIONS,
				VOID = Utility.VOID,
				intimList   = [ 0x284, 0x286, 0x28c, 0x28e ],
				timintList  = [ 0x285, 0x287, 0x28d, 0x28f ],
				tim1tList   = [ 0x294, 0x29c ],
				tim8tList   = [ 0x295, 0x29d ],
				tim64tList  = [ 0x296, 0x29e ],
				t1024tList  = [ 0x297, 0x29f ];

			// store a reference to the memory map that was passed in
			mmap = memory;

			// initialize the RAM buffer and randomize the values
			RAM = new Uint8Array(new ArrayBuffer(128));
			for (; i < RAM.length; i++) {
				RAM[i] = Math.floor(Math.random() * 0xff);
			}

			mmap.addReadWrite(0x80, 0xff, readRAM, writeRAM);

			for (i = MEM_LOCATIONS.SWCHA; i < 0x2a0; i += 0x08) {
				mmap.addReadWrite(i, readSWCHA, writeSWCHA);
			}

			for (i = MEM_LOCATIONS.SWACNT; i < 0x2a0; i += 0x08) {
				mmap.addReadWrite(i, readSWACNT, writeSWACNT);
			}

			for (i = MEM_LOCATIONS.SWCHB; i < 0x2a0; i += 0x08) {
				mmap.addReadWrite(i, readSWCHB, VOID);
			}

			for (i = MEM_LOCATIONS.SWBCNT; i < 0x2a0; i += 0x08) {
				mmap.addReadWrite(i, readSWBCNT, VOID);
			}

			for (i = 0; i < intimList.length; i++) {
				mmap.addReadWrite(intimList[i], readINTIM, VOID);
			}

			for (i = 0; i < timintList.length; i++) {
				mmap.addReadWrite(timintList[i], readTIMINT, VOID);
			}

			for (i = 0; i < tim1tList.length; i++) {
				mmap.addReadWrite(tim1tList[i], readINTIM, writeTIM1T);
			}

			for (i = 0; i < tim8tList.length; i++) {
				mmap.addReadWrite(tim8tList[i], readTIMINT, writeTIM8T);
			}

			for (i = 0; i < tim64tList.length; i++) {
				mmap.addReadWrite(tim64tList[i], readINTIM, writeTIM64T);
			}

			for (i = 0; i < t1024tList.length; i++) {
				mmap.addReadWrite(t1024tList[i], readTIMINT, writeT1024T);
			}

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

		setConsoleSwitch: function( name, val ) {
			val = !!val;

			if (name === 'difficulty0') {
				P0DIFFICULTY = val;
			} else if (name === 'difficulty1') {
				P1DIFFICULTY = val;
			} else if (name === 'color') {
				COLOR = val;
			} else if (name === 'select') {
				SELECT = val;
			} else if (name === 'reset') {
				RESET = val;
			}
		},

		setJoystickValue: function( p, dir, val ) {
			if (p === 0) {
				if (dir === 'up') {
					P0_UP = val;
				} else if (dir === 'left') {
					P0_LEFT = val;
				} else if (dir === 'right') {
					P0_RIGHT = val;
				} else {
					P0_DOWN = val;
				}
			} else {
				if (dir === 'up') {
					P1_UP = val;
				} else if (dir === 'left') {
					P1_LEFT = val;
				} else if (dir === 'right') {
					P1_RIGHT = val;
				} else {
					P1_DOWN = val;
				}
			}
		},

		getTimerRegisters: function() {
			return {
				timerMode: intervalMode,
				intim:     readINTIM(),
				timint:    readTIMINT(),
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
		},

		getRAM: function() {
			var i    = 0,
				len  = RAM.length,
				copy = new Uint8Array(new ArrayBuffer(len));

			for (; i < len; i++) {
				copy[i] = RAM[i];
			}

			return copy;
		}
	};

})();
*/
