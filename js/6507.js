/**
 * 6507.js
 *
 * Author: Jason T. Stoudt
 * Date: 28 March 2012
 *
 * A javascript representation of the 6507 microprocessor found in the
 * Atari 2600.
 */

window.CPU6507 = (function() {

	var ROM_TYPE = {
			'2K': 1,
			'4K': 2
		},

		// lookup tables for binary coded decimal math operations
		BCD_TO_DEC = [
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
		],
		
		DEC_TO_BCD = [
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
		],

		regSet = {
			ac: 0,       // Accumulator Register
			x:  0,       // X Register
			y:  0,       // Y Register
			sr: 0,       // Status Register

//       bit ->   7                           0
//              +---+---+---+---+---+---+---+---+
//              | N | V |   | B | D | I | Z | C |  <-- flag, 0/1 = reset/set
//              +---+---+---+---+---+---+---+---+

			sp: 0,      // Stack Pointer
			pc: 0       // Program Counter
		},
		mmap, // a reference to the memory map to be passed in by TIA

		romType, // the type of ROM cartridge that has been loaded
		
		cycleCount = 0, // number of CPU cycles executed -- for timing purposes

		handlers = {
			load: [],     // functions to call after a ROM has been loaded
			execloop: []  // an array of functions to call after each exec loop
		},

		// retrieve the byte in memory at the address specified by the
		// program counter
		fetchInstruction = function() {
			var val = mmap.readByte(regSet.pc);
			regSet.pc = (regSet.pc + 1) & 0xffff;
			return val;
		},

		waiting = false,  // false: read inst and wait some cycles

		cyclesToWait = 0, // the number of cycles until instruction is executed

		addrMode = {

			// abs
			absolute: function() {
				var addr = mmap.readWord(regSet.pc);
				regSet.pc = (regSet.pc + 2) & 0xffff;
	
				currentInstruction.operand = addr.toString(16);
	
				return addr;
			},

			// abs,X
			absoluteX: function() {
				var pre = mmap.readWord(regSet.pc),
					post = (pre + regSet.x) & 0xffff;

				currentInstruction.operand = pre.toString(16);

				regSet.pc = (regSet.pc + 2) & 0xffff;

				// if the indexed address crosses a page boundy, add
				// an extra cycle
				if ((pre & 0xff00) !== (post & 0xff00)) {
					cycleCount++;
				}
				return post;
			},

			// abs,Y
			absoluteY: function() {
				var pre = mmap.readWord(regSet.pc),
					post = (pre + regSet.y) & 0xffff;

				currentInstruction.operand = pre.toString(16);

				regSet.pc = (regSet.pc + 2) & 0xffff;

				// if the indexed address crosses a page boundy, add
				// an extra cycle
				if ((pre & 0xff00) !== (post & 0xff00)) {
					cycleCount++;
				}
				return post;
			},

			// X,ind
			xIndexedIndirect: function() {
				var addr = (mmap.readByte(regSet.pc));

				currentInstruction.operand = addr.toString(16);

				addr += regSet.x;

				regSet.pc = (regSet.pc + 1) & 0xffff;

				return mmap.readWord(addr & 0xff);
			},

			// ind,Y
			indirectYIndexed: function() {
				var pre = mmap.readByte(regSet.pc),
					post;

				currentInstruction.operand = pre.toString(16);

				pre = mmap.readWord(pre);
				post = (pre + regSet.y) & 0xffff;

				regSet.pc = (regSet.pc + 1) & 0xffff;

				// if the indexed address crosses a page boundy, add
				// an extra cycle
				if ((pre & 0xff00) !== (post & 0xff00)) {
					cycleCount++;
				}

				return post;
			},

			// zpg
			zeroPage: function() {
				var addr = fetchInstruction();

				currentInstruction.operand = addr.toString(16);

				return addr;
			},

			// zpg,X
			zeroPageX: function() {
				var addr = fetchInstruction();

				currentInstruction.operand = addr.toString(16);

				return (addr + regSet.x) & 0xff;
			},

			// zpg,Y
			zeroPageY: function() {
				var addr = fetchInstruction();

				currentInstruction.operand = addr.toString(16);

				return (addr + regSet.y) & 0xff;
			},

			// rel
			relative: function() {
				var addr = fetchInstruction();
				
				cycleCount++;

				addr = (addr & 0x80) ?
					regSet.pc - ((addr ^ 0xff) + 1) :
					regSet.pc + addr;

				// Fetching relative address across page boundries costs an
				// extra cycle
				if ((regSet.pc & 0xff00) !== (addr & 0xff00)) {
					cycleCount++;
				}

				currentInstruction.operand = addr.toString(16);

				return addr & 0xffff;
			}

		},

		// Stack specific operations
		stack = {

			pushByte: function(val) {
				mmap.journalAddByte(val, regSet.sp);
				regSet.sp = (regSet.sp - 1) & 0xff;
			},

			popByte: function() {
				regSet.sp = (regSet.sp + 1) & 0xff;
				return mmap.readByte(regSet.sp);
			},

			pushWord: function(val) {
				stack.pushByte((val >> 8) & 0xff);
				stack.pushByte(val & 0xff);
			},

			popWord: function() {
				var val = stack.popByte();
				return val | (stack.popByte() << 8);
			}

		},

		// Helper functions to set and reset processor status register bits
		status = {

			isSet: function(register) {
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

				return !!(regSet.sr & mask);
			},

			set: function(register, val) {
				if (typeof val === 'undefined') {
					val = true;
				}

				if (!val) {
				regSet.sr &= register === 'N' ? 0x7f :
					register === 'V' ? 0xbf :
					register === 'B' ? 0xef :
					register === 'D' ? 0xf7 :
					register === 'I' ? 0xfb :
					register === 'Z' ? 0xfd :
					register === 'C' ? 0xfe :
					(function() {
						throw new Error('An illegal status register has been specified.');
					})();
				} else {
					regSet.sr |= register === 'N' ? 0x80 :
						register === 'V' ? 0x40 :
						register === 'B' ? 0x10 :
						register === 'D' ? 0x08 :
						register === 'I' ? 0x04 :
						register === 'Z' ? 0x02 :
						register === 'C' ? 0x01 :
						(function() {
							throw new Error('An illegal status register has been specified.');
						})();
				}
			},

			setFlagsNZ: function(val) {

				if (val & 0x80) {
					regSet.sr |= 0x80;
				} else {
					regSet.sr &= 0x7f;
				}

				if (val === 0) {
					regSet.sr |= 0x02;
				} else {
					regSet.sr &= 0xfd;
				}
			}
		},

		arithmeticShiftLeft = function(val) {
			status.set('C', (val & 0x80));

			val = (val << 1) & 0xff;

			status.setFlagsNZ(val);

			return val;
		},

		logicalShiftRight = function(val) {
			status.set('C', (val & 0x01));

			val >>>= 1;

			status.setFlagsNZ(val);

			return val;
		},

		rotateLeft = function(val) {
			var c = status.isSet('C');

			status.set('C', (val & 0x80));

			val = (val << 1) & 0xff;

			if (c === true) {
				val |= 0x01;
			}

			status.setFlagsNZ(val);

			return val;
		},

		rotateRight = function(val) {
			var c = status.isSet('C');

			status.set('C', val & 0x01);

			val >>>= 1;

			if (c === true) {
				val |= 0x80;
			}

			status.setFlagsNZ(val);

			return val;
		},

		addWithCarry = function(val) {
			var v = regSet.ac & 0x80;

			// execute addition in binary coded decimal mode
			if (status.isSet('D')) {
				val = BCD_TO_DEC[val] + BCD_TO_DEC[regSet.ac];
				if (status.isSet('C') === true) {
					val++;
				}

				if (val > 99) {
					status.set('C');
					val = -100;
				} else {
					status.set('C', false);
				}

				val = DEC_TO_BCD[val];
			} else {
				val += regSet.ac + (status.isSet('C') === true ? 1 : 0);

				status.set('C', val > 0xff);
			}

			status.setFlagsNZ(val);

			status.set('V', v !== (val & 0x80));

			regSet.ac = val & 0xff;
		},

		subtractWithCarry = function(val) {
			var v = regSet.ac & 0x80;

			// execute subtraction in binary coded decimal mode
			if (status.isSet('D')) {
				val = BCD_TO_DEC[regSet.ac] - BCD_TO_DEC[val];
				if (status.isSet('C') === false) {
					val--;
				}

				status.set('C', val >= 0);

				if (val < 0) {
					val += 100;
				}

				val = DEC_TO_BCD[val];
			} else {
				val = regSet.ac - val - (status.isSet('C') === true ? 0 : 1);

				status.set('C', val >= 0);
			}

			status.setFlagsNZ(val);

			status.set('V', v && !(val & 0x80));

			regSet.ac = val & 0xff;
		},

		operation = {

			AND: function(fAddr) {
				regSet.ac &= mmap.readByte(fAddr());
				status.setFlagsNZ(regSet.ac);
			},

			ORA: function(fAddr) {
				regSet.ac |= mmap.readByte(fAddr());
				status.setFlagsNZ(regSet.ac);
			},

			EOR: function(fAddr) {
				regSet.ac ^= mmap.readByte(fAddr());
				status.setFlagsNZ(regSet.ac);
			},

			ASL: function(fAddr) {
				var addr = fAddr(),
					result = arithmeticShiftLeft(mmap.readByte(addr));

				mmap.journalAddByte(result, addr);
			},

			LSR: function(fAddr) {
				var addr = fAddr(),
					result = logicalShiftRight(mmap.readByte(addr));

				mmap.journalAddByte(result, addr);
			},

			ROL: function(fAddr) {
				var addr = fAddr(),
					result = rotateLeft(mmap.readByte(addr));

				mmap.journalAddByte(result, addr);
			},

			ROR: function(fAddr) {
				var addr = fAddr(),
					result = rotateRight(mmap.readByte(addr));

				mmap.journalAddByte(result, addr);
			},

			BIT: function(fAddr) {
				var val = mmap.readByte(fAddr());

				status.set('N', val & 0x80);
				status.set('V', val & 0x40);
				status.set('Z', (val & regSet.ac) === 0x00);
			},

			ADC: function(fAddr) {
				addWithCarry(mmap.readByte(fAddr()));
			},

			SBC: function(fAddr) {
				subtractWithCarry(mmap.readByte(fAddr()));
			},

			CMP: function(fAddr) {
				var val = mmap.readByte(fAddr());

				status.set('Z', regSet.ac === val);
				status.set('C', regSet.ac >= val);
				status.set('N', regSet.ac < val);
			},

			CPX: function(fAddr) {
				var val = mmap.readByte(fAddr());
				
				status.set('Z', regSet.x === val);
				status.set('C', regSet.x >= val);
				status.set('N', regSet.x < val);
			},

			CPY: function(fAddr) {
				var val = mmap.readByte(fAddr());

				status.set('Z', regSet.y === val);
				status.set('C', regSet.y >= val);
				status.set('N', regSet.y < val);
			},

			LDA: function(fAddr) {
				regSet.ac = mmap.readByte(fAddr());
				status.setFlagsNZ(regSet.ac);
			},

			LDX: function(fAddr) {
				regSet.x = mmap.readByte(fAddr());
				status.setFlagsNZ(regSet.x);
			},

			LDY: function(fAddr) {
				regSet.y = mmap.readByte(fAddr());
				status.setFlagsNZ(regSet.y);
			},

			STA: function(fAddr) {
				mmap.journalAddByte(regSet.ac, fAddr());
			},

			STX: function(fAddr) {
				mmap.journalAddByte(regSet.x, fAddr());
			},

			STY: function(fAddr) {
				mmap.journalAddByte(regSet.y, fAddr());
			},

			DEC: function(fAddr) {
				var addr = fAddr(),
					val = (mmap.readByte(addr) - 1) & 0xff;

				status.setFlagsNZ(val);

				mmap.journalAddByte(val, addr);
			},

			INC: function(fAddr) {
				var addr = fAddr(),
					val = (mmap.readByte(addr) + 1) & 0xff;

				status.setFlagsNZ(val);

				mmap.journalAddByte(val, addr);
			},

			JSR: function(fAddr) {
				var addr = fAddr();
				stack.pushWord((regSet.pc - 1) & 0xffff);
				regSet.pc = addr;
			}

		},

		instruction = {

			0x00: { // BRK impl
				op: function() {
					status.set('B', true);
					stack.pushWord(regSet.pc);
					stack.pushByte(regSet.sr);
					status.set('I', true);
					regSet.pc = 0x00; // need to figure this out

					currentInstruction.operand = 'impl';
				},
				addressing: 'implied',
				cycles: 7,
				abbr: 'BRK',
				bytes: 1
			},

			0x01: { // ORA X,ind
				op: operation.ORA,
				addressing: 'xIndexedIndirect',
				cycles: 6,
				abbr: 'ORA',
				bytes: 2
			},

			0x05: { // ORA zpg
				op: operation.ORA,
				addressing: 'zeroPage',
				cycles: 3,
				abbr: 'ORA',
				bytes: 2
			},

			0x06: { // ASL zpg
				op: operation.ASL,
				addressing: 'zeroPage',
				cycles: 2,
				abbr: 'ASL',
				bytes: 2
			},

			0x08: { // PHP impl
				op: function() {
					stack.pushByte(regSet.sr);
					currentInstruction.operand = 'impl';
				},
				addressing: 'implied',
				cycles: 5,
				abbr: 'PHP',
				bytes: 1
			},

			0x09: { // ORA #
				op: function() {
					var val = fetchInstruction();
					currentInstruction.operand = val.toString(16);
					regSet.ac |= val;
					status.setFlagsNZ(regSet.ac);
				},
				addressing: 'immediate',
				cycles: 2,
				abbr: 'ORA',
				bytes: 2
			},

			0x0a: { // ASL A
				op: function() {
					regSet.ac = arithmeticShiftLeft(regSet.ac);
					currentInstruction.operand = 'A';
				},
				addressing: 'accumulator',
				cycles: 2,
				abbr: 'ASL',
				bytes: 1
			},

			0x0d: { // ORA abs
				op: operation.ORA,
				addressing: 'absolute',
				cycles: 4,
				abbr: 'ORA',
				bytes: 3
			},

			0x0e: { // ASL abs
				op: operation.ASL,
				addressing: 'absolute',
				cycles: 6,
				abbr: 'ASL',
				bytes: 3
			},

			0x10: { // BPL rel
				op: function(fAddr) {
					var addr = fAddr();

					if (status.isSet('N') === false) {
						regSet.pc = addr;
					}
				},
				addressing: 'relative',
				cycles: 2,
				abbr: 'BPL',
				bytes: 2
			},

			0x11: { // ORA ind,Y
				op: operation.ORA,
				addressing: 'indirectYIndexed',
				cycles: 5,
				abbr: 'ORA',
				bytes: 2
			},

			0x15: { // ORA zpg,X
				op: operation.ORA,
				addressing: 'zeroPageX',
				cycles: 4,
				abbr: 'ORA',
				bytes: 2
			},

			0x16: { // ASL zpg,X
				op: operation.ASL,
				addressing: 'zeroPageX',
				cycles: 6,
				abbr: 'ASL',
				bytes: 2
			},

			0x18: { // CLC impl
				op: function() {
					status.set('C', false);
					currentInstruction.operand = 'impl';
				},
				addressing: 'implied',
				cycles: 2,
				abbr: 'CLC',
				bytes: 1
			},

			0x19: { // ORA abs,Y
				op: operation.ORA,
				addressing: 'absoluteY',
				cycles: 4,
				abbr: 'ORA',
				bytes: 3
			},

			0x1d: { // ORA abs,X
				op: operation.ORA,
				addressing: 'absoluteX',
				cycles: 4,
				abbr: 'ORA',
				bytes: 3
			},

			0x1e: { // ASL abs,X
				op: operation.ASL,
				addressing: 'absoluteX',
				cycles: 7,
				abbr: 'ASL',
				bytes: 3
			},

			0x20: { // JSR abs
				op: operation.JSR,
				addressing: 'absolute',
				cycles: 6,
				abbr: 'JSR',
				bytes: 3
			},

			0x21: { // AND x,ind
				op: operation.AND,
				addressing: 'xIndexedIndirect',
				cycles: 6,
				abbr: 'AND',
				bytes: 2
			},

			0x24: { // BIT zpg
				op: operation.BIT,
				addressing: 'zeroPage',
				cycles: 3,
				abbr: 'BIT',
				bytes: 2
			},

			0x25: { // AND zpg
				op: operation.AND,
				addressing: 'zeroPage',
				cycles: 3,
				abbr: 'AND',
				bytes: 2
			},

			0x26: { // ROL zpg
				op: operation.ROL,
				addressing: 'zeroPage',
				cycles: 5,
				abbr: 'ROL',
				bytes: 2
			},

			0x28: { // PLP impl
				op: function() {
					regSet.sr = stack.popByte();
					currentInstruction.operand = 'impl';
				},
				addressing: 'implied',
				cycles: 4,
				abbr: 'PLP',
				bytes: 1
			},

			0x29: { // AND #
				op: function() {
					var val = fetchInstruction();
					currentInstruction.operand = val.toString(16);
					regSet.ac &= val;
					status.setFlagsNZ(regSet.ac);
				},
				addressing: 'immediate',
				cycles: 2,
				abbr: 'AND',
				bytes: 2
			},

			0x2a: { // ROL A
				op: function() {
					regSet.ac = rotateLeft(regSet.ac);
					currentInstruction.operand = 'A';
				},
				addressing: 'accumulator',
				cycles: 2,
				abbr: 'ROL',
				bytes: 1
			},

			0x2c: { // BIT abs
				op: operation.BIT,
				addressing: 'absolute',
				cycles: 4,
				abbr: 'BIT',
				bytes: 3
			},

			0x2d: { // AND abs
				op: operation.AND,
				addressing: 'absolute',
				cycles: 4,
				abbr: 'AND',
				bytes: 3
			},

			0x2e: { // ROL abs
				op: operation.ROL,
				addressing: 'absolute',
				cycles: 6,
				abbr: 'ROL',
				bytes: 3
			},

			0x30: { // BMI rel
				op: function(fAddr) {
					var addr = fAddr();
					if (status.isSet('N') === true) {
						regSet.pc = addr;
					}
				},
				addressing: 'relative',
				cycles: 2,
				abbr: 'BMI',
				bytes: 2
			},

			0x31: { // AND ind,Y
				op: operation.AND,
				addressing: 'indirectYIndexed',
				cycles: 5,
				abbr: 'AND',
				bytes: 2
			},

			0x35: { // AND zpg,X
				op: operation.AND,
				addressing: 'zeroPageX',
				cycles: 4,
				abbr: 'AND',
				bytes: 2
			},

			0x36: { // ROL zpg,X
				op: operation.ROL,
				addressing: 'zeroPageX',
				cycles: 6,
				abbr: 'ROL',
				bytes: 2
			},

			0x38: { // SEC impl
				op: function() {
					status.set('C');
				},
				addressing: 'implied',
				cycles: 2,
				abbr: 'SEC',
				bytes: 1
			},

			0x39: { // AND abs,Y
				op: operation.AND,
				addressing: 'absoluteY',
				cycles: 4,
				bytes: 3
			},

			0x3d: { // AND abs,Y
				op: operation.AND,
				addressing: 'absoluteX',
				cycles: 4,
				abbr: 'AND',
				bytes: 3
			},

			0x3e: { // ROL abs,X
				op: operation.ROL,
				addressing: 'absoluteX',
				cycles: 7,
				abbr: 'ROL',
				bytes: 3
			},

			0x40: { // RTI impl
				op: function() {
					regSet.sr = stack.popByte();
					regSet.pc = stack.popWord();
					currentInstruction.operand = 'impl';
				},
				addressing: 'implied',
				cycles: 6,
				abbr: 'RTI',
				bytes: 1
			},

			0x41: { // EOR x,ind
				op: operation.EOR,
				addressing: 'xIndexedIndirect',
				cycles: 6,
				abbr: 'EOR',
				bytes: 2
			},

			0x45: { // EOR zpg
				op: operation.EOR,
				addressing: 'zeroPage',
				cycles: 3,
				abbr: 'EOR',
				bytes: 2
			},

			0x46: { // LSR zpg
				op: operation.LSR,
				addressing: 'zeroPage',
				cycles: 5,
				abbr: 'LSR',
				bytes: 2
			},

			0x48: { // PHA A
				op: function() {
					stack.pushByte(regSet.ac);
					currentInstruction.operand = 'A';
				},
				addressing: 'implied',
				cycles: 3,
				abbr: 'PHA',
				bytes: 1
			},

			0x49: { // EOR #
				op: function() {
					var val = fetchInstruction();
					regSet.ac ^= val;
					status.setFlagsNZ(regSet.ac);
					currentInstruction.operand = val.toString(16);
				},
				addressing: 'immediate',
				cycles: 2,
				abbr: 'EOR',
				bytes: 2
			},

			0x4a: { // LSR A
				op: function() {
					regSet.ac = logicalShiftRight(regSet.ac);
					currentInstruction.operand = 'A';
				},
				addressing: 'accumulator',
				cycles: 2,
				abbr: 'LSR',
				bytes: 1
			},

			0x4c: { // JMP abs
				op: function(fAddr) {
					regSet.pc = fAddr();
				},
				addressing: 'absolute',
				cycles: 3,
				abbr: 'JMP',
				bytes: 3
			},

			0x4d: { // EOR abs
				op: operation.EOR,
				addressing: 'absolute',
				cycles: 4,
				abbr: 'EOR',
				bytes: 3
			},

			0x4e: { // LSR abs
				op: operation.LSR,
				addressing: 'absolute',
				cycles: 6,
				abbr: 'LSR',
				bytes: 3
			},

			0x50: { // BVC rel
				op: function(fAddr) {
					var addr = fAddr();

					if (status.isSet('V') === false ) {
						regSet.pc = addr;
					}
				},
				addressing: 'relative',
				cycles: 2,
				abbr: 'BVC',
				bytes: 2
			},

			0x51: { // EOR ind,Y
				op: operation.EOR,
				addressing: 'indirectYIndexed',
				cycles: 5,
				abbr: 'EOR',
				bytes: 2
			},

			0x55: { // EOR zpg,X
				op: operation.EOR,
				addressing: 'zeroPageX',
				cycles: 4,
				abbr: 'EOR',
				bytes: 2
			},

			0x56: { // LSR zpg,X
				op: operation.LSR,
				addressing: 'zeroPageX',
				cycles: 6,
				abbr: 'LSR',
				bytes: 2
			},

			0x58: { // CLI impl
				op: function() {
					status.set('I', false);
					currentInstruction.operation = 'impl';
				},
				addressing: 'implied',
				cycles: 2,
				abbr: 'CLI',
				bytes: 1
			},

			0x59: { // EOR abs,Y
				op: operation.EOR,
				addressing: 'absoluteY',
				cycles: 4,
				abbr: 'EOR',
				bytes: 3
			},

			0x5d: { // EOR abs,X
				op: operation.EOR,
				addressing: 'absoluteX',
				cycles: 4,
				abbr: 'EOR',
				bytes: 3
			},

			0x5e: { // LSR abs,X
				op: operation.LSR,
				addressing: 'absoluteX',
				cycles: 7,
				abbr: 'LSR',
				bytes: 3
			},

			0x60: { // RTS impl
				op: function() {
					regSet.pc = (stack.popWord() + 1) & 0xffff;
					currentInstruction.operand = 'impl';
				},
				addressing: 'implied',
				cycles: 6,
				abbr: 'RTS',
				bytes: 1
			},

			0x61: { // ADC X,ind
				op: operation.ADC,
				addressing: 'xIndexedIndirect',
				cycles: 6,
				abbr: 'ADC',
				bytes: 2
			},

			0x65: { // ADC zpg
				op: operation.ADC,
				addressing: 'zeroPage',
				cycles: 3,
				abbr: 'ADC',
				bytes: 2
			},

			0x66: { // ROR zpg
				op: operation.ROR,
				addressing: 'zeroPage',
				cycles: 5,
				abbr: 'ROR',
				bytes: 2
			},

			0x68: { // PLA impl
				op: function() {
					regSet.ac = stack.popByte();
					currentInstruction.operand = 'impl';
				},
				addressing: 'implied',
				cycles: 4,
				abbr: 'PLA',
				bytes: 1
			},

			0x69: { // ADC #
				op: function() {
					var val = fetchInstruction();
					currentInstruction.operand = val.toString(16);
					addWithCarry(val);
				},
				addressing: 'immediate',
				cycles: 2,
				abbr: 'ADC',
				bytes: 2
			},

			0x6a: { // ROR A
				op: function() {
					regSet.ac = rotateRight(regSet.ac);
					currentInstruction.operand = 'A';
				},
				addressing: 'accumulator',
				cycles: 2,
				abbr: 'ROR',
				bytes: 1
			},

			0x6c: { // JMP ind
				op: function() {
					var addr = mmap.readWord(regSet.pc);
					currentInstruction.operand = addr.toString(16);
					regSet.pc = mmap.readWord(addr);
				},
				addressing: 'indirect',
				cycles: 5,
				abbr: 'JMP',
				bytes: 3
			},

			0x6d: { // ADC abs
				op: operation.ADC,
				addressing: 'absolute',
				cycles: 4,
				abbr: 'ADC',
				bytes: 3
			},

			0x6e: { // ROR abs
				op: operation.ROR,
				addressing: 'absolute',
				cycles: 6,
				abbr: 'ROR',
				bytes: 3
			},

			0x70: { // BVS rel
				op: function(fAddr) {
					var addr = fAddr();

					if (status.isSet('V') === true) {
						regSet.pc = addr;
					}
				},
				addressing: 'relative',
				cycles: 2,
				abbr: 'BVS',
				bytes: 2
			},

			0x71: { // ADC Y,ind
				op: operation.ADC,
				addressing: 'indirectYIndexed',
				cycles: 5,
				abbr: 'ADC',
				bytes: 2
			},

			0x75: { // ADC zpg,X
				op: operation.ADC,
				addressing: 'zeroPageX',
				cycles: 4,
				abbr: 'ADC',
				bytes: 2
			},

			0x76: { // ROR zpg,X
				op: operation.ROR,
				addressing: 'zeroPageX',
				cycles: 6,
				abbr: 'ROR',
				bytes: 2
			},

			0x78: { // SEI impl
				op: function() {
					status.set('I');
					currentInstruction.operand = 'impl';
				},
				addressing: 'implied',
				cycles: 2,
				abbr: 'SEI',
				bytes: 1
			},

			0x79: { // ADC abs,Y
				op: operation.ADC,
				addressing: 'absoluteY',
				cycles: 4,
				abbr: 'ADC',
				bytes: 3
			},

			0x7d: { // ADC abs,X
				op: operation.ADC,
				addressing: 'absoluteX',
				cycles: 4,
				abbr: 'ADC',
				bytes: 3
			},

			0x7e: { // ROR abs,X
				op: operation.ROR,
				addressing: 'absoluteX',
				cycles: 7,
				abbr: 'ROR',
				bytes: 3
			},

			0x81: { // STA X,ind
				op: operation.STA,
				addressing: 'xIndexedIndirect',
				cycles: 6,
				abbr: 'STA',
				bytes: 2
			},

			0x84: { // STY zpg
				op: operation.STY,
				addressing: 'zeroPage',
				cycles: 3,
				abbr: 'STY',
				bytes: 2
			},

			0x85: { // STA zpg
				op: operation.STA,
				addressing: 'zeroPage',
				cycles: 3,
				abbr: 'STA',
				bytes: 2
			},

			0x86: { // STX zpg
				op: operation.STX,
				addressing: 'zeroPage',
				cycles: 3,
				abbr: 'STX',
				bytes: 2
			},

			0x88: { // DEY impl
				op: function() {
					regSet.y = (regSet.y - 1) & 0xff;
					status.setFlagsNZ(regSet.y);
					currentInstruction.operand = 'impl';
				},
				addressing: 'implied',
				cycles: 2,
				abbr: 'DEY',
				bytes: 1
			},

			0x8a: { // TXA impl
				op: function() {
					regSet.ac = regSet.x;
					status.setFlagsNZ(regSet.ac);
					currentInstruction.operand = 'impl';
				},
				addressing: 'implied',
				cycles: 2,
				abbr: 'TXA',
				bytes: 1
			},

			0x8c: { // STY abs
				op: operation.STY,
				addressing: 'absolute',
				cycles: 4,
				abbr: 'STY',
				bytes: 3
			},

			0x8d: { // STA abs
				op: operation.STA,
				addressing: 'absolute',
				cycles: 4,
				abbr: 'STA',
				bytes: 3
			},

			0x8e: { // STX abs
				op: operation.STX,
				addressing: 'absolute',
				cycles: 4,
				abbr: 'STX',
				bytes: 3
			},

			0x90: { // BCC rel
				op: function(fAddr) {
					var addr = fAddr();

					if (status.isSet('C') === false) {
						regSet.pc = addr;
					}
				},
				addressing: 'relative',
				cycles: 2,
				abbr: 'BCC',
				bytes: 2
			},

			0x91: { // STA ind,Y
				op: operation.STA,
				addressing: 'indirectYIndexed',
				cycles: 6,
				abbr: 'STA',
				bytes: 2
			},

			0x94: { // STY zpg,X
				op: operation.STY,
				addressing: 'zeroPageX',
				cycles: 4,
				abbr: 'STY',
				bytes: 2
			},

			0x95: { // STA zpg,X
				op: operation.STA,
				addressing: 'zeroPageX',
				cycles: 4,
				abbr: 'STA',
				bytes: 2
			},

			0x96: { // STX zpg,Y
				op: operation.STX,
				addressing: 'zeroPageY',
				cycles: 4,
				abbr: 'STX',
				bytes: 2
			},

			0x98: { // TYA impl
				op: function() {
					regSet.ac = regSet.y;
					status.setFlagsNZ(regSet.ac);
					currentInstruction.operand = 'impl';
				},
				addressing: 'implied',
				cycles: 2,
				abbr: 'TYA',
				bytes: 1
			},

			0x99: { // STA abs,Y
				op: operation.STA,
				addressing: 'absoluteY',
				cycles: 5,
				abbr: 'STA',
				bytes: 3
			},

			0x9a: { // TXS impl
				op: function() {
					regSet.sp = regSet.x;
					currentInstruction.operand = 'impl';
				},
				addressing: 'implied',
				cycles: 2,
				abbr: 'TXS',
				bytes: 1
			},

			0x9d: { // STA abs,X
				op: operation.STA,
				addressing: 'absoluteX',
				cycles: 5,
				abbr: 'STA',
				bytes: 3
			},

			0xa0: { // LDY #
				op: function() {
					var val = fetchInstruction();
					currentInstruction.operand = val.toString(16);
					regSet.y = val;
					status.setFlagsNZ(val);
				},
				addressing: 'immediate',
				cycles: 2,
				abbr: 'LDY',
				bytes: 2
			},

			0xa1: { // LDA X,ind
				op: operation.LDA,
				addressing: 'xIndexedIndirect',
				cycles: 6,
				abbr: 'LDA',
				bytes: 2
			},

			0xa2: { // LDX #
				op: function() {
					var val = fetchInstruction();
					currentInstruction.operand = val.toString(16);
					regSet.x = val;
					status.setFlagsNZ(val);
				},
				addressing: 'immediate',
				cycles: 2,
				abbr: 'LDX',
				bytes: 2
			},

			0xa4: { // LDY zpg
				op: operation.LDY,
				addressing: 'zeroPage',
				cycles: 3,
				abbr: 'LDY',
				bytes: 2
			},

			0xa5: { // LDA zpg
				op: operation.LDA,
				addressing: 'zeroPage',
				cycles: 3,
				abbr: 'LDA',
				bytes: 2
			},

			0xa6: { // LDX zpg
				op: operation.LDX,
				addressing: 'zeroPage',
				cycles: 3,
				abbr: 'LDX',
				bytes: 2
			},

			0xa8: { // TAY impl
				op: function() {
					regSet.y = regSet.ac;
					status.setFlagsNZ(regSet.y);
					currentInstruction.operand = 'impl';
				},
				addressing: 'implied',
				cycles: 2,
				abbr: 'TAY',
				bytes: 1
			},

			0xa9: { // LDA #
				op: function() {
					var val = fetchInstruction();
					currentInstruction.operand = val.toString(16);
					regSet.ac = val;
					status.setFlagsNZ(val);
				},
				addressing: 'immediate',
				cycles: 2,
				abbr: 'LDA',
				bytes: 2
			},

			0xaa: { // TAX impl
				op: function() {
					regSet.x = regSet.ac;
					status.setFlagsNZ(regSet.x);
					currentInstruction.operand = 'impl';
				},
				addressing: 'implied',
				cycles: 2,
				abbr: 'TAX',
				bytes: 1
			},

			0xac: { // LDY abs
				op: operation.LDY,
				addressing: 'absolute',
				cycles: 4,
				abbr: 'LDY',
				bytes: 3
			},

			0xad: { // LDA abs
				op: operation.LDA,
				addressing: 'absolute',
				cycles: 4,
				abbr: 'LDA',
				bytes: 3
			},

			0xae: { // LDX abs
				op: operation.LDX,
				addressing: 'absolute',
				cycles: 5,
				abbr: 'LDX',
				bytes: 3
			},

			0xb0: { // BCS rel
				op: function(fAddr) {
					var addr = fAddr();

					if (status.isSet('C') === true) {
						regSet.pc = addr;
					}
				},
				addressing: 'relative',
				cycles: 2,
				abbr: 'BCS',
				bytes: 2
			},

			0xb1: { // LDA ind,Y
				op: operation.LDA,
				addressing: 'indirectYIndexed',
				cycles: 5,
				abbr: 'LDA',
				bytes: 2
			},

			0xb4: { // LDY zpg,X
				op: operation.LDY,
				addressing: 'zeroPageX',
				cycles: 4,
				abbr: 'LDY',
				bytes: 2
			},

			0xb5: { // LDA zpg,X
				op: operation.LDA,
				addressing: 'zeroPageX',
				cycles: 4,
				abbr: 'LDA',
				bytes: 2
			},

			0xb6: { // LDX zpg,Y
				op: operation.LDX,
				addressing: 'zeroPageY',
				cycles: 4,
				abbr: 'LDX',
				bytes: 2

			},

			0xb8: { // CLV impl
				op: function() {
					status.set('V', false);
					currentInstruction.operand = 'impl';
				},
				addressing: 'implied',
				cycles: 2,
				abbr: 'CLV',
				bytes: 1
			},

			0xb9: { // LDA abs,Y
				op: operation.LDA,
				addressing: 'absoluteY',
				cycles: 4,
				abbr: 'LDA',
				bytes: 3
			},

			0xba: { // TSX impl
				op: function() {
					regSet.x = regSet.sp;
					status.setFlagsNZ(regSet.x);
					currentInstruction.operand = 'impl';
				},
				addressing: 'implied',
				cycles: 2,
				abbr: 'TSX',
				bytes: 1
			},

			0xbc: { // LDY abs,X
				op: operation.LDY,
				addressing: 'absoluteX',
				cycles: 4,
				abbr: 'LDY',
				bytes: 3
			},

			0xbd: { // LDA abs,X
				op: operation.LDA,
				addressing: 'absoluteX',
				cycles: 4,
				abbr: 'LDA',
				bytes: 3
			},

			0xbe: { // LDX abs,Y
				op: operation.LDX,
				addressing: 'absoluteY',
				cycles: 4,
				abbr: 'LDX',
				bytes: 3
			},

			0xc0: { // CPY #
				op: function() {
					var val = fetchInstruction();

					status.set('Z', regSet.y === val);
					status.set('C', regSet.y >= val);
					status.set('N', regSet.y < val);

					currentInstruction.operand = val.toString(16);
				},
				addressing: 'immediate',
				cycles: 2,
				abbr: 'CPY',
				bytes: 2
			},

			0xc1: { // CMP X,ind
				op: operation.CMP,
				addressing: 'xIndexedIndirect',
				cycles: 6,
				abbr: 'CMP',
				bytes: 2
			},

			0xc4: { // CPY zpg
				op: operation.CPY,
				addressing: 'zeroPage',
				cycles: 3,
				abbr: 'CPY',
				bytes: 2
			},

			0xc5: { // CMP zpg
				op: operation.CMP,
				addressing: 'zeroPage',
				cycles: 3,
				abbr: 'CMP',
				bytes: 2
			},

			0xc6: { // DEC zpg
				op: operation.DEC,
				addressing: 'zeroPage',
				cycles: 5,
				abbr: 'DEC',
				bytes: 2
			},

			0xc8: { // INY impl
				op: function() {
					regSet.y = (regSet.y + 1) & 0xff;
					status.setFlagsNZ(regSet.y);
					currentInstruction.operand = 'impl';
				},
				addressing: 'implied',
				cycles: 2,
				abbr: 'INY',
				bytes: 1
			},

			0xc9: { // CMP #
				op: function() {
					var val = fetchInstruction();

					status.set('Z', regSet.ac === val);
					status.set('C', regSet.ac >= val);
					status.set('N', regSet.ac < val);

					currentInstruction.operand = val.toString(16);
				},
				addressing: 'immediate',
				cycles: 2,
				abbr: 'CMP',
				bytes: 2
			},

			0xca: { // DEX impl
				op: function() {
					regSet.x = (regSet.x - 1) & 0xff;
					status.setFlagsNZ(regSet.x);
					fetchInstruction.operand = 'impl';
				},
				addressing: 'implied',
				cycles: 2,
				abbr: 'DEX',
				bytes: 1
			},

			0xcc: { // CPY abs
				op: operation.CPY,
				addressing: 'absolute',
				cycles: 4,
				abbr: 'CPY',
				bytes: 3
			},

			0xcd: { // CMP abs
				op: operation.CMP,
				addressing: 'absolute',
				cycles: 4,
				abbr: 'CMP',
				bytes: 3
			},

			0xce: { // DEC abs
				op: operation.DEC,
				addressing: 'absolute',
				cycles: 3,
				abbr: 'DEC',
				bytes: 3
			},

			0xd0: { // BNE rel
				op: function(fAddr) {
					var addr = fAddr();

					if (status.isSet('Z') === false) {
						regSet.pc = addr;
					}
				},
				addressing: 'relative',
				cycles: 2,
				abbr: 'BNE',
				bytes: 2
			},

			0xd1: { // CMP ind,Y
				op: operation.CMP,
				addressing: 'indirectYIndexed',
				cycles: 5,
				abbr: 'CMP',
				bytes: 2
			},

			0xd5: { // CMP zpg,X
				op: operation.CMP,
				addressing: 'zeroPageX',
				cycles: 4,
				abbr: 'CMP',
				bytes: 2
			},

			0xd6: { // DEC zpg,X
				op: operation.DEC,
				addressing: 'zeroPageX',
				cycles: 6,
				abbr: 'DEC',
				bytes: 2
			},

			0xd8: { // CLD impl
				op: function() {
					status.set('D', false);
					currentInstruction.operand = 'impl';
				},
				addressing: 'implied',
				cycles: 2,
				abbr: 'CLD',
				bytes: 1
			},

			0xd9: { // CMP abs,Y
				op: operation.CMP,
				addressing: 'absoluteY',
				cycles: 4,
				abbr: 'CMP',
				bytes: 3
			},

			0xdd: { // CMP abs,X
				op: operation.CMP,
				addressing: 'absoluteX',
				cycles: 4,
				abbr: 'CMP',
				bytes: 3
			},

			0xde: { // DEC abs,X
				op: operation.DEC,
				addressing: 'absoluteX',
				cycles: 7,
				abbr: 'DEC',
				bytes: 3
			},

			0xe0: { // CPX #
				op: function() {
					var val = fetchInstruction();

					status.set('Z', regSet.x === val);
					status.set('C', regSet.x >= val);
					status.set('N', regSet.x < val);

					currentInstruction.operand = val;
				},
				addressing: 'immediate',
				cycles: 2,
				abbr: 'CPX',
				bytes: 2
			},

			0xe1: { // SBC X,ind
				op: operation.SBC,
				addressing: 'xIndexedIndirect',
				cycles: 6,
				abbr: 'SBC',
				bytes: 2
			},

			0xe4: { // CPX zpg
				op: operation.CPX,
				addressing: 'zeroPage',
				cycles: 3,
				abbr: 'CPX',
				bytes: 2
			},

			0xe5: { // SBC zpg
				op: operation.SBC,
				addressing: 'zeroPage',
				cycles: 3,
				abbr: 'SBC',
				bytes: 2
			},

			0xe6: { // INC zpg
				op: operation.INC,
				addressing: 'zeroPage',
				cycles: 5,
				abbr: 'INC',
				bytes: 2
			},

			0xe8: { // INX impl
				op: function() {
					regSet.x = (regSet.x + 1) & 0xff;
					status.setFlagsNZ(regSet.x);
					currentInstruction.operand = 'impl';
				},
				addressing: 'implied',
				cycles: 2,
				abbr: 'INX',
				bytes: 1
			},

			0xe9: { // SBC #
				op: function() {
					var val = fetchInstruction();
					subtractWithCarry(val);
					currentInstruction.operand = val.toString(16);
				},
				addressing: 'immediate',
				cycles: 2,
				abbr: 'SBC',
				bytes: 2
			},

			0xea: { // NOP impl
				op: function() {},
				addressing: 'implied',
				cycles: 2,
				abbr: 'NOP',
				bytes: 1
			},

			0xec: { // CPX abs
				op: operation.CPX,
				addressing: 'absolute',
				cycles: 4,
				abbr: 'CPX',
				bytes: 3
			},

			0xed: { // SBC abs
				op: operation.SBC,
				addressing: 'absolute',
				cycles: 4,
				abbr: 'SBC',
				bytes: 1
			},

			0xee: { // INC abs
				op: operation.INC,
				addressing: 'absolute',
				cycles: 6,
				abbr: 'INC',
				bytes: 3
			},

			0xf0: { // BEQ rel
				op: function(fAddr) {
					var addr = fAddr();

					if (status.isSet('Z') === true) {
						regSet.pc = addr;
					}
				},
				addressing: 'relative',
				cycles: 2,
				abbr: 'BEQ',
				bytes: 2
			},

			0xf1: { // SBC ind,Y
				op: operation.SBC,
				addressing: 'indirectYIndexed',
				cycles: 5,
				abbr: 'SBC',
				bytes: 2
			},

			0xf5: { // SBC zpg,X
				op: operation.SBC,
				addressing: 'zeroPageX',
				cycles: 4,
				abbr: 'SBC',
				bytes: 2
			},

			0xf6: { // INC zpg,X
				op: operation.INC,
				addressing: 'zeroPageX',
				cycles: 6,
				abbr: 'INC',
				bytes: 2
			},

			0xf8: { // SED impl
				op: function() {
					status.set('D');
					currentInstruction.operand = 'impl';
				},
				addressing: 'implied',
				cycles: 2,
				abbr: 'SED',
				bytes: 1
			},

			0xf9: { // SBC abs,Y
				op: operation.SBC,
				addressing: 'absoluteY',
				cycles: 4,
				abbr: 'SBC',
				bytes: 3
			},

			0xfd: { // SBC abs,X
				op: operation.SBC,
				addressing: 'absoluteX',
				cycles: 4,
				abbr: 'SBC',
				bytes: 3
			},

			0xfe: { // INC abs,X
				op: operation.INC,
				addressing: 'absoluteX',
				cycles: 7,
				abbr: 'INC',
				bytes: 3
			}

		},

		parseProgram = function() {
			var initAddr,
				instructionList = [],
				toHex = function(arg, len) {
					arg = arg.toString(16).toUpperCase();
					while (arg.length < len) {
						arg = '0' + arg;
					}
					return arg;
				};

			function parseInstruction(addr) {
				var opcode, operand, inst, item;

				while(1) {

					if (addr in instructionList) {
						return;
					}

					opcode = mmap.readByte(addr);

					if (!(opcode in instruction)) {
						return;
					}

					inst = instruction[opcode];
					item = {
						offset: addr,
						offset_str: '$' + toHex(addr, 4),
						opcode: toHex(opcode, 2),
						op_abbr: inst.abbr,
						bytes: inst.bytes,
						cycles: inst.cycles
					};

					operand = 0;
					addr = (addr + 1) & 0xffff;

					if (inst.bytes === 2) { // instruction has 2 bytes
						operand = mmap.readByte(addr);
						addr = (addr + 1) & 0xffff;
					}

					if (inst.bytes === 3) { // instruction has 3 bytes
						operand = mmap.readWord(addr);
						addr = (addr + 2) & 0xffff;
					}

					// Determine how to display the instruction's operand
					switch (inst.addressing) {
						case 'implied':
							item.operand = 'impl';
							break;
						case 'accumulator':
							item.operand = 'A';
							break;
						case 'absolute':
							item.operand = '$' + toHex(operand, 4);
							break;
						case 'absoluteX':
							item.operand = '$' + toHex(operand, 4) + ',X';
							break;
						case 'absoluteY':
							item.operand = '$' + toHex(operand, 4) + ',Y';
							break;
						case 'immediate':
							item.operand = '#$' + toHex(operand, 2);
							break;
						case 'indirect':
							item.operand = '($' + toHex(operand, 4) + ')';
							break;
						case 'xIndexedIndirect':
							item.operand = '($' + toHex(operand, 2) + ',X)';
							break;
						case 'indirectYIndexed':
							item.operand = '($' + toHex(operand, 2) + '),Y';
							break;
						case 'relative':
							operand = operand & 0x80 ?
								addr - ((operand ^ 0xff) + 1) :
								addr + operand;
							operand &= 0xffff;
							item.operand = '$' + toHex(operand, 4);
							break;
						case 'zeroPage':
							item.operand = '$' + toHex(operand, 2);
							break;
						case 'zeroPageX':
							item.operand = '$' + toHex(operand, 2) + ',X';
							break;
						case 'zeroPageY':
							item.operand = '$' + toHex(operand, 2) + ',Y';
							break;
						default:
							throw new Error('Addressing mode unknown: ' + inst.addressing);
					}

					instructionList[item.offset] = item;

					// determine the next address
					switch (inst.abbr) {
						// a branch instruction causes recursion
						case 'BCC':
						case 'BCS':
						case 'BEQ':
						case 'BMI':
						case 'BNE':
						case 'BPL':
						case 'BVC':
						case 'BVS':
							parseInstruction(operand);
							break;

						case 'JMP':
							if (inst.addressing === 'absolute') {
								parseInstruction(operand);
							}
							if (inst.addressing === 'indirect') {
								parseInstruction(mmap.readWord(operand));
							}
							break;

						case 'JSR':
							parseInstruction(operand);
							break;

						case 'RTS':
							return;
					}

				}

			}

			// seed the function with the first instruction address
			if (romType === ROM_TYPE['2K']) {
				initAddr = mmap.readByte(0xf7fc) | mmap.readByte(0xf7fd) << 8;
			} else if (romType === ROM_TYPE['4K']) {
				initAddr = mmap.readByte(0xfffc) | mmap.readByte(0xfffd) << 8;
			} else {
				return [];
			}

			parseInstruction(initAddr);

			return instructionList;

		},

		currentInstruction = null,

		executeInstruction = function() {
			var offset = regSet.pc,
				opcode = fetchInstruction(),
				inst = instruction[opcode],
				cycles0 = cycleCount,
				instCycles;

			// set the waiting flag
			waiting = true;

			// save some information about the current operation
			currentInstruction = {
				offset: offset,
				opcode: opcode,
				addressing: inst.addressing,
				abbr: inst.abbr
			};

			// execute the operation -- memory map has not been committed
			inst.op(addrMode[inst.addressing]);

			// increment the cycle counter
			cycleCount += inst.cycles;

			// the total number of cycles this operation took to execute
			instCycles = cycleCount - cycles0;

			// wait for how many cycles this operation took
			cyclesToWait = instCycles - 2;

			// update the instruction info with the number of cycles
			// the execution actually required
			currentInstruction.cycles = instCycles;
		},

		commitOperation = function() {
			var handlerLength = handlers.execloop.length,
				i = 0;

			mmap.journalCommit();

			waiting = false; // reset the waiting flag

			for (; i < handlerLength; i++) {
				handlers.execloop[i](currentInstruction);
			}

			currentInstruction = null;
		};

	return {

		init: function(map) {
			// use the memory map we are sharing with the TIA
			mmap = map;

			// initialize the register values
			regSet.ac = 0;
			regSet.x  = 0;
			regSet.y  = 0;
			regSet.sp = 0xff;
			regSet.sr = 0x30;
			regSet.pc = 0xff;

			// reset the cycle counter
			cycleCount = 0;
		},

		// execute a single cycle
		cycle: function() {
			if (waiting === true) {
				if (cyclesToWait > 0) {
					cyclesToWait--;
					return false;
				} else {
					commitOperation();
					return true;
				}
			}

			executeInstruction();
			return false;
		},

		addEventListener: function(type, handler) {
			if (typeof handler !== 'function') {
				throw new Error('Parameter handler must be of type function.');
			}

			if (type in handlers) {
				handlers[type].push(handler);
			} else {
				throw new Error('Unrecognized event type.');
			}
		},

		removeEventListener: function(type, handler) {
			var i = 0,
				handlerList = handlers[type],
				l = handlerList.length;

			for (; i < l; i++) {
				if (handlerList[i] === handler) {
					handlerList.splice(i, 1);
				}
			}
		},

		loadProgram: function(program) {
			var i, progList,
				len = program.length,
				l = handlers.load.length;

			romType = len === 2048 ? ROM_TYPE['2K'] :
				len === 4096 ? ROM_TYPE['4K'] :
				(function() {
					throw new Error('Unsupported ROM type.');
				})();

			if (!(mmap instanceof MemoryMap)) {
				throw new Error('The TIA must be initialized prior to loading a program.');
			}

			for (i = 0; i < len; i++) {
				mmap.writeByte(program[i], (i + 0xf000));
			}

			// set the program counter register to the reset address
			// at the end of the ROM
			if (romType === ROM_TYPE['2K']) {
				regSet.pc = mmap.readByte(0xf7fc) | mmap.readByte(0xf7fd) << 8;
			} else if (romType === ROM_TYPE['4K']) {
				regSet.pc = mmap.readByte(0xfffc) | mmap.readByte(0xfffd) << 8;
			}

			// execute any handlers bound to the load event
			if (l > 0) {
				progList = parseProgram();
				for (i = 0; i < l; i++) {
					handlers.load[i](progList);
				}
			}
		},

		getRegister: function(name) {
			return regSet[name];
		},

		getCycleCount: function() {
			return cycleCount;
		},

		getProgram: function() {
			return parseProgram();
		}

	};

})();