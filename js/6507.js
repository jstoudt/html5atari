/*global Utility:false, ROM:false*/

/**
 * 6507.js
 *
 * Author: Jason T. Stoudt
 * Date: 28 March 2012
 *
 * A javascript representation of the 6507 microprocessor found in the
 * Atari 2600.
 */

function CPU6507( memory ) {
	this.regSet = {
		ac: 0,       // Accumulator Register
		x:  0,       // X Register
		y:  0,       // Y Register
		sr: 0x30,    // Status Register

//       bit ->   7                           0
//              +---+---+---+---+---+---+---+---+
//              | N | V |   | B | D | I | Z | C |  <-- flag, 0/1 = reset/set
//              +---+---+---+---+---+---+---+---+

		sp: 0xff,   // Stack Pointer
		pc: 0xff    // Program Counter
	};

	// The ROM object containing the game cart data
	this.rom = null;

	// a reference to the memory map to be passed in by TIA
	this.mmap = memory;

	// number of CPU cycles executed -- for timing purposes
	this.cycleCount = 0;

	// read inst and wait some cycles
	this.waiting = false;

	// the number of cycles until instruction is executed
	this.cyclesToWait = 0;

	// Add the mirrored ROM address range
	this.mmap.addMirror(0x1000, 0x1fff, -0xe000);
}

CPU6507.BCD_TO_DEC = [
	0,    1,  2,  3,  4,  5,  6,  7,  8,  9, 10, 11, 12, 13, 14, 15,  // 0x00
	10,  11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25,  // 0x10
	20,  21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35,  // 0x20
	30,  31, 32, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 44, 45,  // 0x30
	40,  41, 42, 43, 44, 45, 46, 47, 48, 49, 50, 51, 52, 53, 54, 55,  // 0x40
	50,  51, 52, 53, 54, 55, 56, 57, 58, 59, 60, 61, 62, 63, 64, 65,  // 0x50
	60,  61, 62, 63, 64, 65, 66, 67, 68, 69, 70, 71, 72, 73, 74, 75,  // 0x60
	70,  71, 72, 73, 74, 75, 76, 77, 78, 79, 80, 81, 82, 83, 84, 85,  // 0x70
	80,  81, 82, 83, 84, 85, 86, 87, 88, 89, 90, 91, 92, 93, 94, 95,  // 0x80
	90,  91, 92, 93, 94, 95, 96, 97, 98, 99,100,101,102,103,104,105,  // 0x90
	100,101,102,103,104,105,106,107,108,109,110,111,112,113,114,115,  // 0xA0
	110,111,112,113,114,115,116,117,118,119,120,121,122,123,124,125,  // 0xB0
	120,121,122,123,124,125,126,127,128,129,130,131,132,133,134,135,  // 0xC0
	130,131,132,133,134,135,136,137,138,139,140,141,142,143,144,145,  // 0xD0
	140,141,142,143,144,145,146,147,148,149,150,151,152,153,154,155,  // 0xE0
	150,151,152,153,154,155,156,157,158,159,160,161,162,163,164,165   // 0xF0
];

CPU6507.DEC_TO_BCD = [
	0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08, 0x09,
	0x10, 0x11, 0x12, 0x13, 0x14, 0x15, 0x16, 0x17, 0x18, 0x19,
	0x20, 0x21, 0x22, 0x23, 0x24, 0x25, 0x26, 0x27, 0x28, 0x29,
	0x30, 0x31, 0x32, 0x33, 0x34, 0x35, 0x36, 0x37, 0x38, 0x39,
	0x40, 0x41, 0x42, 0x43, 0x44, 0x45, 0x46, 0x47, 0x48, 0x49,
	0x50, 0x51, 0x52, 0x53, 0x54, 0x55, 0x56, 0x57, 0x58, 0x59,
	0x60, 0x61, 0x62, 0x63, 0x64, 0x65, 0x66, 0x67, 0x68, 0x69,
	0x70, 0x71, 0x72, 0x73, 0x74, 0x75, 0x76, 0x77, 0x78, 0x79,
	0x80, 0x81, 0x82, 0x83, 0x84, 0x85, 0x86, 0x87, 0x88, 0x89,
	0x90, 0x91, 0x92, 0x93, 0x94, 0x95, 0x96, 0x97, 0x98, 0x99
];

CPU6507._fetchInstruction = function() {
	var val = this.mmap.readByte( this.regSet.pc );
	this.regSet.pc = ( this.regSet.pc + 1 ) & 0xffff;
	return val;
};

CPU6507.prototype._addrMode = {
	// abs
	absolute: function() {
		var addr = this.mmap.readWord( this.regSet.pc );
		this.regSet.pc = ( this.regSet.pc + 2 ) & 0xffff;

		return addr;
	},

	// abs,X
	absoluteX: function() {
		var pre = this.mmap.readWord( this.regSet.pc ),
			post = ( pre + this.regSet.x ) & 0xffff;

		this.regSet.pc = ( this.regSet.pc + 2 ) & 0xffff;

		// if the indexed address crosses a page boundy, add
		// an extra cycle
		if ( ( pre & 0xff00 ) !== ( post & 0xff00 ) ) {
			this.cycleCount++;
		}
		return post;
	},

	// abs,Y
	absoluteY: function() {
		var pre = this.mmap.readWord( this.regSet.pc ),
			post = ( pre + this.regSet.y ) & 0xffff;

		this.regSet.pc = ( this.regSet.pc + 2 ) & 0xffff;

		// if the indexed address crosses a page boundy, add
		// an extra cycle
		if ( ( pre & 0xff00 ) !== ( post & 0xff00 ) ) {
			this.cycleCount++;
		}
		return post;
	},

	// X,ind
	xIndexedIndirect: function() {
		var addr = ( this.mmap.readByte( this.regSet.pc ) );

		addr += this.regSet.x;

		this.regSet.pc = ( this.regSet.pc + 1 ) & 0xffff;

		return this.mmap.readWord( addr & 0xff );
	},

	// ind,Y
	indirectYIndexed: function() {
		var pre = this.mmap.readByte( this.regSet.pc ),
			post;

		pre = this.mmap.readWord( pre );
		post = ( pre + this.regSet.y ) & 0xffff;

		this.regSet.pc = ( this.regSet.pc + 1 ) & 0xffff;

		// if the indexed address crosses a page boundy, add
		// an extra cycle
		if ( ( pre & 0xff00 ) !== ( post & 0xff00 ) ) {
			this.cycleCount++;
		}

		return post;
	},

	// zpg
	zeroPage: function() {
		return CPU6507._fetchInstruction.call( this );
	},

	// zpg,X
	zeroPageX: function() {
		var addr = CPU6507._fetchInstruction.call( this );

		return ( addr + this.regSet.x ) & 0xff;
	},

	// zpg,Y
	zeroPageY: function() {
		var addr = CPU6507._fetchInstruction.call( this );

		return ( addr + this.regSet.y ) & 0xff;
	},

	// rel
	relative: function() {
		var addr = CPU6507._fetchInstruction.call( this );

		addr = (addr & 0x80) ?
			this.regSet.pc - ( ( addr ^ 0xff ) + 1 ) :
			this.regSet.pc + addr;

		return addr & 0xffff;
	}

};

// Stack specific operations
CPU6507.prototype._stackPushByte = function( val ) {
	this.mmap.journalAddByte( val, this.regSet.sp );
	this.regSet.sp = ( this.regSet.sp - 1 ) & 0xff;
};

CPU6507.prototype._stackPopByte = function() {
	this.regSet.sp = ( this.regSet.sp + 1 ) & 0xff;
	return this.mmap.readByte( this.regSet.sp );
};

CPU6507.prototype._stackPushWord = function( val ) {
	this._pushByte( ( val >> 8 ) & 0xff );
	this._pushByte( val & 0xff );
};

CPU6507.prototype._stackPopWord = function() {
	var val = this._popByte();
	return val | ( this._popByte() << 8 );
};

// Helper functions to set and reset processor status register bits
CPU6507.prototype._statusIsSet = function( register ) {
	register = register.toUpperCase();

	var mask = register === 'N' ? 0x80 :
		register === 'V' ? 0x40 :
		register === 'B' ? 0x10 :
		register === 'D' ? 0x08 :
		register === 'I' ? 0x04 :
		register === 'Z' ? 0x02 :
		register === 'C' ? 0x01 :
		(function() {
			throw new Error('An illegal status register has been specified.');
		})();

	return !!( this.regSet.sr & mask);
};

CPU6507.prototype._statusSet = function( register, val ) {
	if ( typeof val === 'undefined' ) {
		val = true;
	}

	if ( !val ) {
	this.regSet.sr &= register === 'N' ? 0x7f :
		register === 'V' ? 0xbf :
		register === 'B' ? 0xef :
		register === 'D' ? 0xf7 :
		register === 'I' ? 0xfb :
		register === 'Z' ? 0xfd :
		register === 'C' ? 0xfe :
		(function() {
			throw new Error( 'An illegal status register has been specified.' );
		})();
	} else {
		this.regSet.sr |= register === 'N' ? 0x80 :
			register === 'V' ? 0x40 :
			register === 'B' ? 0x10 :
			register === 'D' ? 0x08 :
			register === 'I' ? 0x04 :
			register === 'Z' ? 0x02 :
			register === 'C' ? 0x01 :
			(function() {
				throw new Error( 'An illegal status register has been specified.' );
			})();
	}
};

CPU6507.prototype._statusSetFlagsNZ = function( val ) {
	if ( val & 0x80 ) {
		this.regSet.sr |= 0x80;
	} else {
		this.regSet.sr &= 0x7f;
	}

	if ( val === 0 ) {
		this.regSet.sr |= 0x02;
	} else {
		this.regSet.sr &= 0xfd;
	}
};

CPU6507.prototype._arithmeticShiftLeft = function( val ) {
	this._statusSet( 'C', ( val & 0x80 ) );

	val = ( val << 1 ) & 0xff;

	this._statusSetFlagsNZ(val);

	return val;
};

CPU6507.prototype._logicalShiftRight = function( val ) {
	this._statusSet( 'C', ( val & 0x01 ) );

	val >>>= 1;

	this._statusSetFlagsNZ( val );

	return val;
};

CPU6507.prototype._rotateLeft = function( val ) {
	var c = this._statusIsSet( 'C' );

	this._statusSet( 'C', ( val & 0x80 ) );

	val = ( val << 1 ) & 0xff;

	if ( c === true ) {
		val |= 0x01;
	}

	this._statusSetFlagsNZ(val);

	return val;
};

CPU6507.prototype._rotateRight = function( val ) {
	var c = this._statusIsSet( 'C' );

	this._statusSet( 'C', val & 0x01 );

	val >>>= 1;

	if ( c === true ) {
		val |= 0x80;
	}

	this._statusSetFlagsNZ( val );

	return val;
};

CPU6507.prototype._addWithCarry= function( val ) {
	var v = this.regSet.ac & 0x80;

	// execute addition in binary coded decimal mode
	if ( this._statusIsSet( 'D' ) ) {
		val = CPU6507.BCD_TO_DEC[val] + CPU6507.BCD_TO_DEC[this.regSet.ac];
		if ( this._statusIsSet( 'C' ) === true ) {
			val++;
		}

		if ( val > 99 ) {
			this._status.Set( 'C' );
			val = -100;
		} else {
			this._statusSet( 'C', false );
		}

		val = CPU6507.DEC_TO_BCD[val];
	} else {
		val += this.regSet.ac;
		if ( this._statusIsSet( 'C' ) === true ) {
			val += 1;
		}

		this._statusSet( 'C', val > 0xff );
	}

	this._statusSetFlagsNZ( val );

	this._statusSet( 'V', v !== ( val & 0x80 ) );

	this.regSet.ac = val & 0xff;
};

CPU6507.prototype._subtractWithCarry = function( val ) {
	var v = this.regSet.ac & 0x80;

	// execute subtraction in binary coded decimal mode
	if ( this._statusIsSet( 'D' ) ) {
		val = CPU6507.BCD_TO_DEC[this.regSet.ac] - CPU6507.BCD_TO_DEC[val];
		if ( this._statusIsSet( 'C' ) === false ) {
			val--;
		}

		this._statusSet( 'C', val >= 0 );

		if ( val < 0 ) {
			val += 100;
		}

		val = CPU6507.DEC_TO_BCD[val];
	} else {
		val = this.regSet.ac - val;
		if ( this._statusIsSet( 'C' ) === true ) {
			val -= 1;
		}

		this._statusSet( 'C', val >= 0 );
	}

	this._statusSetFlagsNZ( val );

	this._statusSet( 'V', v && !( val & 0x80 ) );

	this.regSet.ac = val & 0xff;
};

CPU6507._compare = function( reg, mem ) {
	this._statusSet( 'Z', reg === mem );
	this._statusSet( 'C', reg >= mem );
	this._statusSet( 'N', reg < mem );
};

CPU6507._AND = function( fAddr ) {
	this.regSet.ac &= this.mmap.readByte( fAddr() );
	this._statusSetFlagsNZ( this.regSet.ac );
};

CPU6507._ORA = function( fAddr ) {
	this.regSet.ac |= this.mmap.readByte( fAddr() );
	this._statusSetFlagsNZ( this.regSet.ac );
};

CPU6507._EOR = function( fAddr ) {
	this.regSet.ac ^= this.mmap.readByte( fAddr() );
	this._statusSetFlagsNZ( this.regSet.ac );
};

CPU6507._ASL = function( fAddr ) {
	var addr = fAddr(),
		result = this._arithmeticShiftLeft( this.mmap.readByte( addr) );

	this.mmap.journalAddByte( result, addr );
};

CPU6507._LSR = function( fAddr ) {
	var addr = fAddr(),
		result = this._logicalShiftRight( this.mmap.readByte( addr ) );

	this.mmap.journalAddByte( result, addr );
};

CPU6507._ROL = function( fAddr ) {
	var addr = fAddr(),
		result = this._rotateLeft( this.mmap.readByte( addr ) );

	this.mmap.journalAddByte( result, addr );
};

CPU6507._ROR = function( fAddr ) {
	var addr = fAddr(),
		result = this._rotateRight( this.mmap.readByte( addr ) );

	this.mmap.journalAddByte( result, addr );
};

CPU6507._BIT = function( fAddr ) {
	var val = this.mmap.readByte( fAddr() );

	this._statusSet( 'N', val & 0x80 );
	this._statusSet( 'V', val & 0x40 );
	this._statusSet( 'Z', ( val & this.regSet.ac ) === 0x00 );
};

CPU6507._ADC = function( fAddr ) {
	this._addWithCarry( this.mmap.readByte( fAddr() ) );
};

CPU6507._SBC = function( fAddr ) {
	this._subtractWithCarry( this.mmap.readByte( fAddr() ) );
};

CPU6507._CMP = function( fAddr ) {
	this._compare( this.regSet.ac, this.mmap.readByte( fAddr() ) );
};

CPU6507._CPX = function( fAddr ) {
	this._compare( this.regSet.x, this.mmap.readByte( fAddr() ) );
};

CPU6507._CPY = function( fAddr ) {
	this._compare( this.regSet.y, this.mmap.readByte( fAddr() ) );
};

CPU6507._LDA = function( fAddr ) {
	this.regSet.ac = this.mmap.readByte( fAddr() );
	this._statusSetFlagsNZ( this.regSet.ac );
};

CPU6507._LDX = function( fAddr ) {
	this.regSet.x = this.mmap.readByte( fAddr() );
	this._statusSetFlagsNZ( this.regSet.x );
};

CPU6507._LDY = function( fAddr ) {
	this.regSet.y = this.mmap.readByte( fAddr() );
	this._statusSetFlagsNZ( this.regSet.y );
};

CPU6507._STA = function( fAddr ) {
	var addr = fAddr.call( this );
	this.mmap.journalAddByte( this.regSet.ac, addr );
};

CPU6507._STX = function( fAddr ) {
	this.mmap.journalAddByte( this.regSet.x, fAddr() );
};

CPU6507._STY = function( fAddr ) {
	this.mmap.journalAddByte( this.regSet.y, fAddr() );
};

CPU6507._DEC = function( fAddr ) {
	var addr = fAddr(),
		val = ( this.mmap.readByte( addr ) - 1 ) & 0xff;

	this._statusSetFlagsNZ( val );

	this.mmap.journalAddByte( val, addr );
};

CPU6507._INC = function( fAddr ) {
	var addr = fAddr(),
		val = ( this.mmap.readByte( addr ) + 1 ) & 0xff;

	this._statusSetFlagsNZ( val );

	this.mmap.journalAddByte( val, addr );
};

CPU6507._JSR = function( fAddr ) {
	var addr = fAddr();

	this._stackPushWord( ( this.regSet.pc - 1 ) & 0xffff );

	this.regSet.pc = addr;
};

CPU6507.prototype._instruction = {

	0x00: { // BRK
		op: function() {
			this._statusSet( 'B', true );
			this._stackPushWord( this.regSet.pc );
			this._stackPushByte( this.regSet.sr );
			this._statusSet( 'I', true );
			this.regSet.pc = this.rom.readBreakAddress();
		},
		addressing: 'implied',
		cycles: 7,
		addr: 'BRK',
		bytes: 1
	},

	0x01: { // ORA X,ind
		op: this._ORA,
		addressing: 'xIndexedIndirect',
		cycles: 6,
		abbr: 'ORA',
		bytes: 2
	},

	0x02: { // unsupported operation
		op: Utility.VOID,
		addressing: 'immediate',
		cycles: 0,
		abbr: 'jam',
		bytes: 1
	},

	0x05: { // ORA zpg
		op: this._ORA,
		addressing: 'zeroPage',
		cycles: 3,
		abbr: 'ORA',
		bytes: 1
	},

	0x06: { // ASL zpg
		op: this._ASL,
		addressing: 'zeroPage',
		cycles: 5,
		abbr: 'ASL',
		bytes: 2
	},

	0x08: { // PHP impl
		op: function() {
			this._stackPushByte( this.regSet.sr );
		},
		addressing: 'implied',
		cycles: 3,
		abbr: 'PHP',
		bytes: 1
	},

	0x09: { // ORA #
		op: function() {
			this.regSet.ac |= this._fetchInstruction();
			this._statusSetFlagsNZ( this.regSet.ac );
		},
		addressing: 'immediate',
		cycles: 2,
		abbr: 'ORA',
		bytes: 2
	},

	0x0a: { // ASL A
		op: function() {
			this.regSet.ac = this._arithmeticShiftLeft( this.regSet.ac );
		},
		addressing: 'accumulator',
		cycles: 2,
		abbr: 'ASL',
		bytes: 1
	},

	0x0d: { // ORA abs
		op: this._ORA,
		addressing: 'absolute',
		cycles: 4,
		abbr: 'ORA',
		bytes: 3
	},

	0x0e: { // ASL abs
		op: this._ASL,
		addressing: 'absolute',
		cycles: 6,
		abbr: 'ASL',
		bytes: 3
	},

	0x10: { // BPL rel
		op: function( fAddr ) {
			var addr = fAddr();
			if (this._statusIsSet( 'N' ) === false) {
				this.cycleCount += ( ( this.regSet.pc & 0xff00 ) === ( addr & 0xff00 ) ) ? 1 : 2;
				this.regSet.pc = addr;
			}
		},
		addressing: 'relative',
		cycles: 2,
		abbr: 'BPL',
		bytes: 2
	},

	0x11: { // ORA ind,Y
		op: this._ORA,
		addressing: 'indirectYIndexed',
		cycles: 5,
		abbr: 'ORA',
		bytes: 2
	},

	0x15: { // ORA zpg,X
		op: this._ORA,
		addressing: 'zeroPageX',
		cycles: 4,
		abbr: 'ORA',
		bytes: 2
	},

	0x16: { // ASL zpg,X
		op: this._ASL,
		addressing: 'zeroPageX',
		cycles: 6,
		abbr: 'ASL',
		bytes: 2
	},

	0x18: { // CLC impl
		op: function() {
			this._statusSet( 'C', false );
		},
		addressing: 'implied',
		cycles: 2,
		abbr: 'CLC',
		bytes: 1
	},

	0x19: { // ORA abs,Y
		op: this._ORA,
		addressing: 'absoluteY',
		cycles: 4,
		abbr: 'ORA',
		bytes: 3
	},

	0x1d: { // ORA abs,X
		op: this._ORA,
		addressing: 'absoluteX',
		cycles: 4,
		abbr: 'ORA',
		bytes: 3
	},

	0x1e: { // ASL abs,X
		op: this._ASL,
		addressing: 'absoluteX',
		cycles: 7,
		abbr: 'ASL',
		bytes: 3
	},

	0x20: { // JSR abs
		op: this._JSR,
		addressing: 'absolute',
		cycles: 6,
		abbr: 'JSR',
		bytes: 3
	},

	0x21: { // AND x,ind
		op: this._AND,
		addressing: 'xIndexedIndirect',
		cycles: 6,
		abbr: 'AND',
		bytes: 2
	},

	0x24: { // BIT zpg
		op: this._BIT,
		addressing: 'zeroPage',
		cycles: 3,
		abbr: 'BIT',
		bytes: 2
	},

	0x25: { // AND zpg
		op: this._AND,
		addressing: 'zeroPage',
		cycles: 3,
		abbr: 'AND',
		bytes: 2
	},

	0x26: { // ROL zpg
		op: this._ROL,
		addressing: 'zeroPage',
		cycles: 5,
		abbr: 'ROL',
		bytes: 2
	},

	0x28: { // PLP impl
		op: function() {
			this.regSet.sr = this._stackPopByte();
		},
		addressing: 'implied',
		cycles: 4,
		abbr: 'PLP',
		bytes: 1
	},

	0x29: { // AND #
		op: function() {
			this.regSet.ac &= this._fetchInstruction();
			this._statusSetFlagsNZ( this.regSet.ac );
		},
		addressing: 'immediate',
		cycles: 2,
		abbr: 'AND',
		bytes: 2
	},

	0x2a: { // ROL A
		op: function() {
			this.regSet.ac = this._rotateLeft( this.regSet.ac );
		},
		addressing: 'accumulator',
		cycles: 2,
		abbr: 'ROL',
		bytes: 1
	},

	0x2c: { // BIT abs
		op: this._BIT,
		addressing: 'absolute',
		cycles: 4,
		abbr: 'BIT',
		bytes: 3
	},

	0x2d: { // AND abs
		op: this._AND,
		addressing: 'absolute',
		cycles: 4,
		abbr: 'AND',
		bytes: 3
	},

	0x2e: { // ROL abs
		op: this._ROL,
		addressing: 'absolute',
		cycles: 6,
		abbr: 'ROL',
		bytes: 3
	},

	0x30: { // BMI rel
		op: function(fAddr) {
			var addr = fAddr();
			if ( this._statusIsSet( 'N' ) === true) {
				this.cycleCount += ( ( this.regSet.pc & 0xff00 ) === ( addr & 0xff00 ) ) ? 1 : 2;
				this.regSet.pc = addr;
			}
		},
		addressing: 'relative',
		cycles: 2,
		abbr: 'BMI',
		bytes: 2
	},

	0x31: { // AND ind,Y
		op: this._AND,
		addressing: 'indirectYIndexed',
		cycles: 5,
		abbr: 'AND',
		bytes: 2
	},

	0x35: { // AND zpg,X
		op: this._AND,
		addressing: 'zeroPageX',
		cycles: 4,
		abbr: 'AND',
		bytes: 2
	},

	0x36: { // ROL zpg,X
		op: this._ROL,
		addressing: 'zeroPageX',
		cycles: 6,
		abbr: 'ROL',
		bytes: 2
	},

	0x38: { // SEC impl
		op: function() {
			this._statusSet( 'C' );
		},
		addressing: 'implied',
		cycles: 2,
		abbr: 'SEC',
		bytes: 1
	},

	0x39: { // AND abs,Y
		op: this._AND,
		addressing: 'absoluteY',
		cycles: 4,
		abbr: 'AND',
		bytes: 3
	},

	0x3d: { // AND abs,Y
		op: this._AND,
		addressing: 'absoluteX',
		cycles: 4,
		abbr: 'AND',
		bytes: 3
	},

	0x3e: { // ROL abs,X
		op: this._ROL,
		addressing: 'absoluteX',
		cycles: 7,
		abbr: 'ROL',
		bytes: 3
	},

	0x40: { // RTI impl
		op: function() {
			this.regSet.sr = this._stackPopByte();
			this.regSet.pc = this._stackPopWord();
		},
		addressing: 'implied',
		cycles: 6,
		abbr: 'RTI',
		bytes: 1
	},

	0x41: { // EOR x,ind
		op: this._EOR,
		addressing: 'xIndexedIndirect',
		cycles: 6,
		abbr: 'EOR',
		bytes: 2
	},

	0x45: { // EOR zpg
		op: this._EOR,
		addressing: 'zeroPage',
		cycles: 3,
		abbr: 'EOR',
		bytes: 2
	},

	0x46: { // LSR zpg
		op: this._LSR,
		addressing: 'zeroPage',
		cycles: 5,
		abbr: 'LSR',
		bytes: 2
	},

	0x48: { // PHA A
		op: function() {
			this._stackPushByte( this.regSet.ac );
		},
		addressing: 'implied',
		cycles: 3,
		abbr: 'PHA',
		bytes: 1
	},

	0x49: { // EOR #
		op: function() {
			this.regSet.ac ^= this._fetchInstruction();
			this._statusSetFlagsNZ( this.regSet.ac );
		},
		addressing: 'immediate',
		cycles: 2,
		abbr: 'EOR',
		bytes: 2
	},

	0x4a: { // LSR A
		op: function() {
			this.regSet.ac = this._logicalShiftRight( this.regSet.ac );
		},
		addressing: 'accumulator',
		cycles: 2,
		abbr: 'LSR',
		bytes: 1
	},

	0x4c: { // JMP abs
		op: function(fAddr) {
			this.regSet.pc = fAddr();
		},
		addressing: 'absolute',
		cycles: 3,
		abbr: 'JMP',
		bytes: 3
	},

	0x4d: { // EOR abs
		op: this._EOR,
		addressing: 'absolute',
		cycles: 4,
		abbr: 'EOR',
		bytes: 3
	},

	0x4e: { // LSR abs
		op: this._LSR,
		addressing: 'absolute',
		cycles: 6,
		abbr: 'LSR',
		bytes: 3
	},

	0x50: { // BVC rel
		op: function(fAddr) {
			var addr = fAddr();
			if ( this._statusIsSet( 'V' ) === false ) {
				this.cycleCount += ( ( this.regSet.pc & 0xff00 ) === ( addr & 0xff00 ) ) ? 1 : 2;
				this.regSet.pc = addr;
			}
		},
		addressing: 'relative',
		cycles: 2,
		abbr: 'BVC',
		bytes: 2
	},

	0x51: { // EOR ind,Y
		op: this._EOR,
		addressing: 'indirectYIndexed',
		cycles: 5,
		abbr: 'EOR',
		bytes: 2
	},

	0x55: { // EOR zpg,X
		op: this._EOR,
		addressing: 'zeroPageX',
		cycles: 4,
		abbr: 'EOR',
		bytes: 2
	},

	0x56: { // LSR zpg,X
		op: this._LSR,
		addressing: 'zeroPageX',
		cycles: 6,
		abbr: 'LSR',
		bytes: 2
	},

	0x58: { // CLI impl
		op: function() {
			this._statusSet( 'I', false );
		},
		addressing: 'implied',
		cycles: 2,
		abbr: 'CLI',
		bytes: 1
	},

	0x59: { // EOR abs,Y
		op: this._EOR,
		addressing: 'absoluteY',
		cycles: 4,
		abbr: 'EOR',
		bytes: 3
	},

	0x5d: { // EOR abs,X
		op: this._EOR,
		addressing: 'absoluteX',
		cycles: 4,
		abbr: 'EOR',
		bytes: 3
	},

	0x5e: { // LSR abs,X
		op: this._LSR,
		addressing: 'absoluteX',
		cycles: 7,
		abbr: 'LSR',
		bytes: 3
	},

	0x60: { // RTS impl
		op: function() {
			this.regSet.pc = ( this._stackPopWord() + 1 ) & 0xffff;
		},
		addressing: 'implied',
		cycles: 6,
		abbr: 'RTS',
		bytes: 1
	},

	0x61: { // ADC X,ind
		op: this._ADC,
		addressing: 'xIndexedIndirect',
		cycles: 6,
		abbr: 'ADC',
		bytes: 2
	},

	0x65: { // ADC zpg
		op: this._ADC,
		addressing: 'zeroPage',
		cycles: 3,
		abbr: 'ADC',
		bytes: 2
	},

	0x66: { // ROR zpg
		op: this._ROR,
		addressing: 'zeroPage',
		cycles: 5,
		abbr: 'ROR',
		bytes: 2
	},

	0x68: { // PLA impl
		op: function() {
			this.regSet.ac = this._stackPopByte();
			this._statusSetFlagsNZ( this.regSet.ac );
		},
		addressing: 'implied',
		cycles: 4,
		abbr: 'PLA',
		bytes: 1
	},

	0x69: { // ADC #
		op: function() {
			this._addWithCarry( this._fetchInstruction() );
		},
		addressing: 'immediate',
		cycles: 2,
		abbr: 'ADC',
		bytes: 2
	},

	0x6a: { // ROR A
		op: function() {
			this.regSet.ac = this._rotateRight( this.regSet.ac );
		},
		addressing: 'accumulator',
		cycles: 2,
		abbr: 'ROR',
		bytes: 1
	},

	0x6c: { // JMP ind
		op: function() {
			var addr = this.mmap.readWord( this.regSet.pc );
			this.regSet.pc = this.mmap.readWord( addr );
		},
		addressing: 'indirect',
		cycles: 5,
		abbr: 'JMP',
		bytes: 3
	},

	0x6d: { // ADC abs
		op: this._ADC,
		addressing: 'absolute',
		cycles: 4,
		abbr: 'ADC',
		bytes: 3
	},

	0x6e: { // ROR abs
		op: this._ROR,
		addressing: 'absolute',
		cycles: 6,
		abbr: 'ROR',
		bytes: 3
	},

	0x70: { // BVS rel
		op: function(fAddr) {
			var addr = fAddr();
			if ( this._statusIsSet( 'V' ) === true ) {
				this.cycleCount += ( ( this.regSet.pc & 0xff00 ) === ( addr & 0xff00 ) ) ? 1 : 2;
				this.regSet.pc = addr;
			}
		},
		addressing: 'relative',
		cycles: 2,
		abbr: 'BVS',
		bytes: 2
	},

	0x71: { // ADC Y,ind
		op: this._ADC,
		addressing: 'indirectYIndexed',
		cycles: 5,
		abbr: 'ADC',
		bytes: 2
	},

	0x75: { // ADC zpg,X
		op: this._ADC,
		addressing: 'zeroPageX',
		cycles: 4,
		abbr: 'ADC',
		bytes: 2
	},

	0x76: { // ROR zpg,X
		op: this._ROR,
		addressing: 'zeroPageX',
		cycles: 6,
		abbr: 'ROR',
		bytes: 2
	},

	0x78: { // SEI impl
		op: function() {
			this._statusSet( 'I' );
		},
		addressing: 'implied',
		cycles: 2,
		abbr: 'SEI',
		bytes: 1
	},

	0x79: { // ADC abs,Y
		op: this._ADC,
		addressing: 'absoluteY',
		cycles: 4,
		abbr: 'ADC',
		bytes: 3
	},

	0x7d: { // ADC abs,X
		op: this._ADC,
		addressing: 'absoluteX',
		cycles: 4,
		abbr: 'ADC',
		bytes: 3
	},

	0x7e: { // ROR abs,X
		op: this._ROR,
		addressing: 'absoluteX',
		cycles: 7,
		abbr: 'ROR',
		bytes: 3
	},

	0x80: { // unsupported operation
		op: Utility.VOID,
		addressing: 'immediate',
		cycles: 2,
		abbr: 'nop',
		bytes: 2
	},

	0x81: { // STA X,ind
		op: this._STA,
		addressing: 'xIndexedIndirect',
		cycles: 6,
		abbr: 'STA',
		bytes: 2
	},

	0x84: { // STY zpg
		op: this._STY,
		addressing: 'zeroPage',
		cycles: 3,
		abbr: 'STY',
		bytes: 2
	},

	0x85: { // STA zpg
		op: this._STA,
		addressing: 'zeroPage',
		cycles: 3,
		abbr: 'STA',
		bytes: 2
	},

	0x86: { // STX zpg
		op: this._STX,
		addressing: 'zeroPage',
		cycles: 3,
		abbr: 'STX',
		bytes: 2
	},

	0x88: { // DEY impl
		op: function() {
			this.regSet.y = ( this.regSet.y - 1 ) & 0xff;
			this._statusSetFlagsNZ( this.regSet.y );
		},
		addressing: 'implied',
		cycles: 2,
		abbr: 'DEY',
		bytes: 1
	},

	0x8a: { // TXA impl
		op: function() {
			this.regSet.ac = this.regSet.x;
			this._statusSetFlagsNZ( this.regSet.ac );
		},
		addressing: 'implied',
		cycles: 2,
		abbr: 'TXA',
		bytes: 1
	},

	0x8c: { // STY abs
		op: this._STY,
		addressing: 'absolute',
		cycles: 4,
		abbr: 'STY',
		bytes: 3
	},

	0x8d: { // STA abs
		op: this._STA,
		addressing: 'absolute',
		cycles: 4,
		abbr: 'STA',
		bytes: 3
	},

	0x8e: { // STX abs
		op: this._STX,
		addressing: 'absolute',
		cycles: 4,
		abbr: 'STX',
		bytes: 3
	},

	0x90: { // BCC rel
		op: function(fAddr) {
			var addr = fAddr();
			if ( this._statusIsSet( 'C' ) === false ) {
				this.cycleCount += ( ( this.regSet.pc & 0xff00 ) === ( addr & 0xff00 ) ) ? 1 : 2;
				this.regSet.pc = addr;
			}
		},
		addressing: 'relative',
		cycles: 2,
		abbr: 'BCC',
		bytes: 2
	},

	0x91: { // STA ind,Y
		op: this._STA,
		addressing: 'indirectYIndexed',
		cycles: 6,
		abbr: 'STA',
		bytes: 2
	},

	0x94: { // STY zpg,X
		op: this._STY,
		addressing: 'zeroPageX',
		cycles: 4,
		abbr: 'STY',
		bytes: 2
	},

	0x95: { // STA zpg,X
		op: CPU6507._STA,
		addressing: 'zeroPageX',
		cycles: 4,
		abbr: 'STA',
		bytes: 2
	},

	0x96: { // STX zpg,Y
		op: this._STX,
		addressing: 'zeroPageY',
		cycles: 4,
		abbr: 'STX',
		bytes: 2
	},

	0x98: { // TYA impl
		op: function() {
			this.regSet.ac = this.regSet.y;
			this._statusSetFlagsNZ( this.regSet.ac );
		},
		addressing: 'implied',
		cycles: 2,
		abbr: 'TYA',
		bytes: 1
	},

	0x99: { // STA abs,Y
		op: this._STA,
		addressing: 'absoluteY',
		cycles: 5,
		abbr: 'STA',
		bytes: 3
	},

	0x9a: { // TXS impl
		op: function() {
			this.regSet.sp = this.regSet.x;
		},
		addressing: 'implied',
		cycles: 2,
		abbr: 'TXS',
		bytes: 1
	},

	0x9d: { // STA abs,X
		op: this._STA,
		addressing: 'absoluteX',
		cycles: 5,
		abbr: 'STA',
		bytes: 3
	},

	0x9f: { // unsupported operation
		op: Utility.VOID,
		addressing: 'absoluteY',
		cycles: 5,
		abbr: 'sha',
		bytes: 3
	},

	0xa0: { // LDY #
		op: function() {
			var val = this._fetchInstruction();
			this.regSet.y = val;
			this._statusSetFlagsNZ( val );
		},
		addressing: 'immediate',
		cycles: 2,
		abbr: 'LDY',
		bytes: 2
	},

	0xa1: { // LDA X,ind
		op: this._LDA,
		addressing: 'xIndexedIndirect',
		cycles: 6,
		abbr: 'LDA',
		bytes: 2
	},

	0xa2: { // LDX #
		op: function() {
			var val = CPU6507._fetchInstruction.call( this );
			this.regSet.x = val;
			this._statusSetFlagsNZ( val );
		},
		addressing: 'immediate',
		cycles: 2,
		abbr: 'LDX',
		bytes: 2
	},

	0xa4: { // LDY zpg
		op: this._LDY,
		addressing: 'zeroPage',
		cycles: 3,
		abbr: 'LDY',
		bytes: 2
	},

	0xa5: { // LDA zpg
		op: this._LDA,
		addressing: 'zeroPage',
		cycles: 3,
		abbr: 'LDA',
		bytes: 2
	},

	0xa6: { // LDX zpg
		op: this._LDX,
		addressing: 'zeroPage',
		cycles: 3,
		abbr: 'LDX',
		bytes: 2
	},

	0xa8: { // TAY impl
		op: function() {
			this.regSet.y = this.regSet.ac;
			this._statusSetFlagsNZ( this.regSet.y );
		},
		addressing: 'implied',
		cycles: 2,
		abbr: 'TAY',
		bytes: 1
	},

	0xa9: { // LDA #
		op: function() {
			var val = CPU6507._fetchInstruction.call( this );
			this.regSet.ac = val;
			this._statusSetFlagsNZ(val);
		},
		addressing: 'immediate',
		cycles: 2,
		abbr: 'LDA',
		bytes: 2
	},

	0xaa: { // TAX impl
		op: function() {
			this.regSet.x = this.regSet.ac;
			this._statusSetFlagsNZ( this.regSet.x );
		},
		addressing: 'implied',
		cycles: 2,
		abbr: 'TAX',
		bytes: 1
	},

	0xac: { // LDY abs
		op: this._LDY,
		addressing: 'absolute',
		cycles: 4,
		abbr: 'LDY',
		bytes: 3
	},

	0xad: { // LDA abs
		op: this._LDA,
		addressing: 'absolute',
		cycles: 4,
		abbr: 'LDA',
		bytes: 3
	},

	0xae: { // LDX abs
		op: this._LDX,
		addressing: 'absolute',
		cycles: 4,
		abbr: 'LDX',
		bytes: 3
	},

	0xb0: { // BCS rel
		op: function( fAddr ) {
			var addr = fAddr();
			if ( this._statusIsSet( 'C' ) === true ) {
				this.cycleCount += ( ( this.regSet.pc & 0xff00 ) === ( addr & 0xff00 ) ) ? 1 : 2;
				this.regSet.pc = addr;
			}
		},
		addressing: 'relative',
		cycles: 2,
		abbr: 'BCS',
		bytes: 2
	},

	0xb1: { // LDA ind,Y
		op: this._LDA,
		addressing: 'indirectYIndexed',
		cycles: 5,
		abbr: 'LDA',
		bytes: 2
	},

	0xb4: { // LDY zpg,X
		op: this._LDY,
		addressing: 'zeroPageX',
		cycles: 4,
		abbr: 'LDY',
		bytes: 2
	},

	0xb5: { // LDA zpg,X
		op: this._LDA,
		addressing: 'zeroPageX',
		cycles: 4,
		abbr: 'LDA',
		bytes: 2
	},

	0xb6: { // LDX zpg,Y
		op: this._LDX,
		addressing: 'zeroPageY',
		cycles: 4,
		abbr: 'LDX',
		bytes: 2

	},

	0xb8: { // CLV impl
		op: function() {
			this._statusSet( 'V', false );
		},
		addressing: 'implied',
		cycles: 2,
		abbr: 'CLV',
		bytes: 1
	},

	0xb9: { // LDA abs,Y
		op: this._LDA,
		addressing: 'absoluteY',
		cycles: 4,
		abbr: 'LDA',
		bytes: 3
	},

	0xba: { // TSX impl
		op: function() {
			this.regSet.x = this.regSet.sp;
			this._statusSetFlagsNZ( this.regSet.x );
		},
		addressing: 'implied',
		cycles: 2,
		abbr: 'TSX',
		bytes: 1
	},

	0xbc: { // LDY abs,X
		op: this._LDY,
		addressing: 'absoluteX',
		cycles: 4,
		abbr: 'LDY',
		bytes: 3
	},

	0xbd: { // LDA abs,X
		op: this._LDA,
		addressing: 'absoluteX',
		cycles: 4,
		abbr: 'LDA',
		bytes: 3
	},

	0xbe: { // LDX abs,Y
		op: this._LDX,
		addressing: 'absoluteY',
		cycles: 4,
		abbr: 'LDX',
		bytes: 3
	},

	0xc0: { // CPY #
		op: function() {
			this._compare( this.regSet.y, this._fetchInstruction() );
		},
		addressing: 'immediate',
		cycles: 2,
		abbr: 'CPY',
		bytes: 2
	},

	0xc1: { // CMP X,ind
		op: this._CMP,
		addressing: 'xIndexedIndirect',
		cycles: 6,
		abbr: 'CMP',
		bytes: 2
	},

	0xc4: { // CPY zpg
		op: this._CPY,
		addressing: 'zeroPage',
		cycles: 3,
		abbr: 'CPY',
		bytes: 2
	},

	0xc5: { // CMP zpg
		op: this._CMP,
		addressing: 'zeroPage',
		cycles: 3,
		abbr: 'CMP',
		bytes: 2
	},

	0xc6: { // DEC zpg
		op: this._DEC,
		addressing: 'zeroPage',
		cycles: 5,
		abbr: 'DEC',
		bytes: 2
	},

	0xc8: { // INY impl
		op: function() {
			this.regSet.y = ( this.regSet.y + 1 ) & 0xff;
			this._statusSetFlagsNZ( this.regSet.y );
		},
		addressing: 'implied',
		cycles: 2,
		abbr: 'INY',
		bytes: 1
	},

	0xc9: { // CMP #
		op: function() {
			this._compare( this.regSet.ac, this._fetchInstruction() );
		},
		addressing: 'immediate',
		cycles: 2,
		abbr: 'CMP',
		bytes: 2
	},

	0xca: { // DEX impl
		op: function() {
			this.regSet.x = ( this.regSet.x - 1 ) & 0xff;
			this._statusSetFlagsNZ( this.regSet.x );
		},
		addressing: 'implied',
		cycles: 2,
		abbr: 'DEX',
		bytes: 1
	},

	0xcc: { // CPY abs
		op: this._CPY,
		addressing: 'absolute',
		cycles: 4,
		abbr: 'CPY',
		bytes: 3
	},

	0xcd: { // CMP abs
		op: this._CMP,
		addressing: 'absolute',
		cycles: 4,
		abbr: 'CMP',
		bytes: 3
	},

	0xce: { // DEC abs
		op: this._DEC,
		addressing: 'absolute',
		cycles: 3,
		abbr: 'DEC',
		bytes: 3
	},

	0xd0: { // BNE rel
		op: function( fAddr ) {
			var addr = fAddr.call( this );
			if ( this._statusIsSet( 'Z' ) === false ) {
				this.cycleCount += ( ( this.regSet.pc & 0xff00 ) === ( addr & 0xff00 ) ) ? 1 : 2;
				this.regSet.pc = addr;
			}
		},
		addressing: 'relative',
		cycles: 2,
		abbr: 'BNE',
		bytes: 2
	},

	0xd1: { // CMP ind,Y
		op: this._CMP,
		addressing: 'indirectYIndexed',
		cycles: 5,
		abbr: 'CMP',
		bytes: 2
	},

	0xd5: { // CMP zpg,X
		op: this._CMP,
		addressing: 'zeroPageX',
		cycles: 4,
		abbr: 'CMP',
		bytes: 2
	},

	0xd6: { // DEC zpg,X
		op: this._DEC,
		addressing: 'zeroPageX',
		cycles: 6,
		abbr: 'DEC',
		bytes: 2
	},

	0xd8: { // CLD impl
		op: function() {
			this._statusSet( 'D', false );
		},
		addressing: 'implied',
		cycles: 2,
		abbr: 'CLD',
		bytes: 1
	},

	0xd9: { // CMP abs,Y
		op: this._CMP,
		addressing: 'absoluteY',
		cycles: 4,
		abbr: 'CMP',
		bytes: 3
	},

	0xdd: { // CMP abs,X
		op: this._CMP,
		addressing: 'absoluteX',
		cycles: 4,
		abbr: 'CMP',
		bytes: 3
	},

	0xde: { // DEC abs,X
		op: this._DEC,
		addressing: 'absoluteX',
		cycles: 7,
		abbr: 'DEC',
		bytes: 3
	},

	0xe0: { // CPX #
		op: function() {
			this._compare( this.regSet.x, this._fetchInstruction() );
		},
		addressing: 'immediate',
		cycles: 2,
		abbr: 'CPX',
		bytes: 2
	},

	0xe1: { // SBC X,ind
		op: this._SBC,
		addressing: 'xIndexedIndirect',
		cycles: 6,
		abbr: 'SBC',
		bytes: 2
	},

	0xe4: { // CPX zpg
		op: this._CPX,
		addressing: 'zeroPage',
		cycles: 3,
		abbr: 'CPX',
		bytes: 2
	},

	0xe5: { // SBC zpg
		op: this._SBC,
		addressing: 'zeroPage',
		cycles: 3,
		abbr: 'SBC',
		bytes: 2
	},

	0xe6: { // INC zpg
		op: this._INC,
		addressing: 'zeroPage',
		cycles: 5,
		abbr: 'INC',
		bytes: 2
	},

	0xe8: { // INX impl
		op: function() {
			this.regSet.x = ( this.regSet.x + 1 ) & 0xff;
			this._statusSetFlagsNZ( this.regSet.x );
		},
		addressing: 'implied',
		cycles: 2,
		abbr: 'INX',
		bytes: 1
	},

	0xe9: { // SBC #
		op: function() {
			this._subtractWithCarry( this._fetchInstruction() );
		},
		addressing: 'immediate',
		cycles: 2,
		abbr: 'SBC',
		bytes: 2
	},

	0xea: { // NOP impl
		op: Utility.VOID,
		addressing: 'implied',
		cycles: 2,
		abbr: 'NOP',
		bytes: 1
	},

	0xec: { // CPX abs
		op: this._CPX,
		addressing: 'absolute',
		cycles: 4,
		abbr: 'CPX',
		bytes: 3
	},

	0xed: { // SBC abs
		op: this._SBC,
		addressing: 'absolute',
		cycles: 4,
		abbr: 'SBC',
		bytes: 3
	},

	0xee: { // INC abs
		op: this._INC,
		addressing: 'absolute',
		cycles: 6,
		abbr: 'INC',
		bytes: 3
	},

	0xf0: { // BEQ rel
		op: function(fAddr) {
			var addr = fAddr();
			if ( this._statusIsSet( 'Z' ) === true ) {
				this.cycleCount += ( ( this.regSet.pc & 0xff00 ) === ( addr & 0xff00 ) ) ? 1 : 2;
				this.regSet.pc = addr;
			}
		},
		addressing: 'relative',
		cycles: 2,
		abbr: 'BEQ',
		bytes: 2
	},

	0xf1: { // SBC ind,Y
		op: this._SBC,
		addressing: 'indirectYIndexed',
		cycles: 5,
		abbr: 'SBC',
		bytes: 2
	},

	0xf5: { // SBC zpg,X
		op: this._SBC,
		addressing: 'zeroPageX',
		cycles: 4,
		abbr: 'SBC',
		bytes: 2
	},

	0xf6: { // INC zpg,X
		op: this._INC,
		addressing: 'zeroPageX',
		cycles: 6,
		abbr: 'INC',
		bytes: 2
	},

	0xf8: { // SED impl
		op: function() {
			this._statusSet( 'D' );
		},
		addressing: 'implied',
		cycles: 2,
		abbr: 'SED',
		bytes: 1
	},

	0xf9: { // SBC abs,Y
		op: this._SBC,
		addressing: 'absoluteY',
		cycles: 4,
		abbr: 'SBC',
		bytes: 3
	},

	0xfd: { // SBC abs,X
		op: this._SBC,
		addressing: 'absoluteX',
		cycles: 4,
		abbr: 'SBC',
		bytes: 3
	},

	0xfe: { // INC abs,X
		op: this._INC,
		addressing: 'absoluteX',
		cycles: 7,
		abbr: 'INC',
		bytes: 3
	}

};

CPU6507.prototype.executeInstruction = function() {
	var offset = this.regSet.pc,
		opcode = CPU6507._fetchInstruction.call( this ),
		inst = this._instruction[ opcode ],
		cycles0 = this.cycleCount,
		instCycles;

	// set the waiting flag
	this.waiting = true;

	// execute the operation -- memory map has not been committed
	inst.op.call( this, this._addrMode[ inst.addressing ]);
	//inst.op( this._addrMode[ inst.addressing ]);

	// increment the cycle counter
	this.cycleCount += inst.cycles;

	// the total number of cycles this operation took to execute
	instCycles = this.cycleCount - cycles0;

	// wait for how many cycles this operation took
	this.cyclesToWait = instCycles - 1;
};

CPU6507.prototype.cycle = function() {
	if ( this.waiting === true ) {
		if ( this.cyclesToWait > 0 ) {
			this.cyclesToWait--;
		} else {
			this.mmap.journalCommit();
			this.waiting = false;
		}
		return false;
	}

	this.executeInstruction();
	return true;
};

CPU6507.prototype.loadProgram = function( program ) {
	this.rom = new ROM( program, this.mmap );
	this.regSet.pc = this.rom.readStartAddress();
};

CPU6507.prototype.getProgram = function() {
//	return this._parseProgram();
};
