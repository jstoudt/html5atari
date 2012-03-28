/**
 * 6507.js
 *
 * Author: Jason T. Stoudt
 * Date: 28 March 2012
 *
 * A javascript representation of the 6507 microprocessor found in the
 * Atari 2600.
 */

var CPU6507 = (function() {

	var regSet = {
			ac: 0,    // Accumulator
			x:  0,    // X Register
			y:  0,    // Y Register
			sr: 0,    // Status Register

//       bit ->   7                           0
//              +---+---+---+---+---+---+---+---+
//              | N | V |   | B | D | I | Z | C |  <-- flag, 0/1 = reset/set
//              +---+---+---+---+---+---+---+---+

			sp: 0,    // Stack Pointer
			pc: 0     // Program Counter
		},
		mmap = new MemoryMap(1 << 16),
		clockSpeed = 1.19, // speed of 6507 (Atari 2600)
		cyclesPerMs,       // the numbr of cycles per millisecond -- determined from clockSpeed
		cycleCount = 0, // number of CPU cycles executed -- for timing purposes

		breakFlag = true,  // set to halt execution of CPU

		startHandlers = [], // an array of functions to call before the CPU is started
		stopHandlers = [], // an array of functions to call after the CPU is stopped
		execloopHandlers = [], // an array of functions to call after each exec loop

		// retrieve the byte in memory at the address specified by the
		// program counter
		fetchInstruction = function() {
			var val = mmap.readByte(regSet.pc);
			regSet.pc = (regSet.pc + 1) & 0xffff;
			return val;
		},

		addrMode = {

			// #
			immediate: function() {
				return fetchInstruction();
			},

			// abs
			absolute: function() {
				var addr = mmap.readWord(regSet.pc);
				regSet.pc = (regSet.pc + 2) & 0xffff;
				return addr;
			},

			// abs,X
			absoluteX: function() {
				var pre = mmap.readWord(regSet.pc),
					post = (pre + regSet.x) & 0xffff;

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
					post = (pre + regSet.x) & 0xffff;

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
				var addr = (mmap.readByte(regSet.pc) + regSet.x) & 0xff;

				regSet.pc = (regSet.pc + 1) & 0xffff;

				return mmap.readWord(addr);
			},

			// ind,Y
			indirectYIndexed: function() {
				var pre = mmap.readWord(mmap.readByte(regSet.pc)),
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
				return fetchInstruction();
			},

			// zpg,X
			zeroPageX: function() {
				var addr = (mmap.readByte(regSet.pc) + regSet.x) & 0xff;

				regSet.pc = (regSet.pc + 1) & 0xffff;

				return addr;
			},

			// zpg,Y
			zeroPageY: function() {
				var addr = (mmap.readByte(regSet.pc) + regSet.y) & 0xff;

				regSet.pc = (regSet.pc + 1) & 0xffff;

				return addr;
			},

			// rel
			relative: function() {
				var addr = fetchInstruction();

				cycleCount++;

				addr = addr & 0xf0 ? regSet.pc - ((addr ^ 0xff) + 1) :
					regSet.pc + addr;

				// Fetching relative address across page boundries costs an
				// extra cycle
				if ((regSet.pc & 0xff00) !== (addr & 0xff00)) {
					cycleCount++;
				}

				return addr;
			}

		},

		// Stack specific operations
		stack = {

			pushByte: function(val) {
				mmap.writeByte(val, 0x0100 | regSet.sp);
				regSet.sp = (regSet.sp - 1) & 0xff;
			},

			popByte: function() {
				regSet = (regSet + 1) & 0xff;
				return mmap.readByte(0x0100 | regSet.sp);
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
					status.reset(register);
					return;
				}

				register = register.toUpperCase();

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
			},

			reset: function(register) {
				register = register.toUpperCase();

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
			},

			setFlagsNZ: function(val) {
				status.set('N', (val & 0x80));
				status.set('Z', (val === 0x00));
			}
		},

		arithmeticShiftLeft = function(val) {
			status.set('C', (val & 0x80));

			val = (val << 1) & 0xff;

			status.setFlagsNZ(val);

			return val;
		},

		logicalShiftRight = function(val) {
			status.set('C', (val & 0x80));

			val >>>= 1;

			status.setFlagsNZ(val);

			return val;
		},

		rotateLeft = function(val) {
			var c = status.isSet('C');

			status.set('C', (val & 0x80));

			val = (val << 1) & 0xff;

			if (c) {
				val |= 0x01;
			}

			status.setFlagsNZ(val);

			return val;
		},

		rotateRight = function(val) {
			var c = status.isSet('C');

			status.set('C', val & 0x01);

			val >>>= 1;

			if (c) {
				val |= 0x80;
			}

			status.setFlagsNZ(val);

			return val;
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

				mmap.writeByte(result, addr);
			},

			LSR: function(fAddr) {
				var addr = fAddr(),
					result = logicalShiftRight(mmap.readByte(fAddr()));

				mmap.writeByte(result, addr);
			},

			ROL: function(fAddr) {
				var addr = fAddr().
					result = rotateLeft(mmap.readByte(addr));

				mmap.writeByte(result, addr);
			},

			ROR: function(fAddr) {
				var addr = fAddr(),
					result = rotateRight(mmap.readByte(addr));

				mmap.writeByte(result, addr);
			},

			BIT: function(fAddr) {
				var val = mmap.readByte(fAddr());

				status.set('N', val & 0x80);
				status.set('V', val & 0x40);
				status.set('Z', (val & regSet.ac) === 0x00);
			},

			ADC: function(fAddr) {
				var val = mmap.readByte(fAddr()),
					v = regSet.ac & 0x80;

				val += regSet.ac + (status.isSet('C') ? 1 : 0);

				status.set('C', val > 0xff);

				status.setFlagsNZ(val);

				status.set('V', v !== (val & 0x80));

				regSet.ac = val & 0xff;
			},

			SBC: function(fAddr) {
				var val = mmap.readByte(fAddr()),
					valNegative = val & 0x80;

				if (!status.isSet('C')) {
					val++;
				}

				val = regSet.ac - val;

				status.setFlagsNZ(val);

				status.set('C', val >= 0);
				status.set('V', val < 0);

				regSet.ac = val & 0xff;
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
				mmap.writeByte(regSet.ac, fAddr());
			},

			STX: function(fAddr) {
				mmap.writeByte(regSet.x, fAddr());
			},

			STY: function(fAddr) {
				mmap.writeByte(regSet.y, fAddr());
			},

			DEC: function(fAddr) {
				var addr = fAddr(),
					val = (mmap.readByte(addr) - 1) & 0xff;

				status.setFlagsNZ(val);

				mmap.writeByte(val, addr);
			},

			INC: function(fAddr) {
				var addr = fAddr(),
					val = (mmap.readByte(addr) + 1) & 0xff;

				status.setFlagsNZ(val);

				mmap.writeByte(val, addr);
			},

			JSR: function(fAddr) {
				stack.pushWord(regSet.pc);
				regSet.pc = fAddr();
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
				},
				addressing: 'implied',
				cycles: 7,
				abbr: 'BRK'
			},

			0x01: { // ORA X,ind
				op: operation.ORA,
				addressing: 'xIndexedIndirect',
				cycles: 6,
				bytes: 2,
				abbr: 'ORA'
			},

			0x05: { // ORA zpg
				op: operation.ORA,
				addressing: 'zeroPage',
				cycles: 3,
				abbr: 'ORA'
			},

			0x06: { // ASL zpg
				op: operation.ASL,
				addressing: 'zeroPage',
				cycles: 2,
				abbr: 'ASL'
			},

			0x08: { // PHP impl
				op: function() {
					stack.pushByte(regSet.sr);
				},
				addressing: 'implied',
				cycles: 5,
				abbr: 'PHP'
			},

			0x09: { // ORA #
				op: function() {
					regSet.ac |= fetchInstruction();
					status.setFlagsNZ(regSet.ac);
				},
				addressing: 'immediate',
				cycles: 2,
				abbr: 'ORA'
			},

			0x0a: { // ASL A
				op: function() {
					regSet.ac = arithmeticShiftLeft(regSet.ac);
				},
				addressing: 'accumulator',
				cycles: 2,
				abbr: 'ASL'
			},

			0x0d: { // ORA abs
				op: operation.ORA,
				addressing: 'absolute',
				cycles: 4,
				abbr: 'ORA'
			},

			0x0e: { // ASL abs
				op: operation.ASL,
				addressing: 'absolute',
				cycles: 6,
				abbr: 'ASL'
			},

			0x10: { // BPL rel
				op: function(fAddr) {
					if (!status.isSet('N')) {
						regSet.pc = fAddr();
					} else {
						regSet.pc = (regSet.pc + 1) & 0xffff;
					}
				},
				addressing: 'relative',
				cycles: 2,
				abbr: 'BPL'
			},

			0x11: { // ORA ind,Y
				op: operation.ORA,
				addressing: 'indirectYIndexed',
				cycles: 5,
				abbr: 'ORA'
			},

			0x15: { // ORA zpg,X
				op: operation.ORA,
				addressing: 'zeroPageX',
				cycles: 4,
				abbr: 'ORA'
			},

			0x16: { // ASL zpg,X
				op: operation.ASL,
				addressing: 'zeroPageX',
				cycles: 6,
				abbr: 'ASL'
			},

			0x18: { // CLC impl
				op: function() {
					status.reset('C');
				},
				addressing: 'implied',
				cycles: 2,
				abbr: 'CLC'
			},

			0x19: { // ORA abs,Y
				op: operation.ORA,
				addressing: 'absoluteY',
				cycles: 4,
				abbr: 'ORA'
			},

			0x1d: { // ORA abs,X
				op: operation.ORA,
				addressing: 'absoluteX',
				cycles: 4,
				abbr: 'ORA'
			},

			0x1e: { // ASL abs,X
				op: operation.ASL,
				addressing: 'absoluteX',
				cycles: 7,
				abbr: 'ASL'
			},

			0x20: { // JSR abs
				op: function() {
					var pc = (regSet.pc + 1) & 0xffff;
					stack.pushWord(pc);
					regSet.pc = mmap.readWord(regSet.pc);
				},
				addressing: 'absolute',
				cycles: 6,
				abbr: 'JSR'
			},

			0x21: { // AND x,ind
				op: operation.AND,
				addressing: 'xIndexedIndirect',
				cycles: 6,
				abbr: 'AND'
			},

			0x24: { // BIT zpg
				op: operation.BIT,
				addressing: 'zeroPage',
				cycles: 3,
				abbr: 'BIT'
			},

			0x25: { // AND zpg
				op: operation.AND,
				addressing: 'zeroPage',
				cycles: 3,
				abbr: 'AND'
			},

			0x26: { // ROL zpg
				op: operation.ROL,
				addressing: 'zeroPage',
				cycles: 5,
				abbr: 'ROL'
			},

			0x28: { // PLP impl
				op: function() {
					regSet.sr = stack.popByte();
				},
				addressing: 'implied',
				cycles: 4,
				abbr: 'PLP'
			},

			0x29: { // AND #
				op: function() {
					regSet.ac &= fetchInstruction();
					status.setFlagsNZ(regSet.ac);
				},
				addressing: 'immediate',
				cycles: 2,
				abbr: 'AND'
			},

			0x2a: { // ROL A
				op: function() {
					regSet.ac = rotateLeft(regSet.ac);
				},
				addressing: 'accumulator',
				cycles: 2,
				abbr: 'ROL'
			},

			0x2c: { // BIT abs
				op: operation.BIT,
				addressing: 'absolute',
				cycles: 4,
				abbr: 'BIT'
			},

			0x2d: { // AND abs
				op: operation.AND,
				addressing: 'absolute',
				cycles: 4,
				abbr: 'AND'
			},

			0x2e: { // ROL abs
				op: operation.ROL,
				addressing: 'absolute',
				cycles: 6,
				abbr: 'ROL'
			},

			0x30: { // BMI rel
				op: function(fAddr) {
					if (status.isSet('N')) {
						regSet.pc = fAddr();
					} else {
						regSet.pc = (regSet.pc + 1) & 0xffff;
					}
				},
				addressing: 'relative',
				cycles: 2,
				abbr: 'BMI'
			},

			0x31: { // AND ind,Y
				op: operation.AND,
				addressing: 'indirectYIndexed',
				cycles: 5,
				abbr: 'AND'
			},

			0x35: { // AND zpg,X
				op: operation.AND,
				addressing: 'zeroPageX',
				cycles: 4,
				abbr: 'AND'
			},

			0x36: { // ROL zpg,X
				op: operation.ROL,
				addressing: 'zeroPageX',
				cycles: 6,
				abbr: 'ROL'
			},

			0x38: { // SEC impl
				op: function() {
					status.set('C');
				},
				addressing: 'implied',
				cycles: 2,
				abbr: 'SEC'
			},

			0x39: { // AND abs,Y
				op: operation.AND,
				addressing: 'absoluteY',
				cycles: 4
			},

			0x3d: { // AND abs,Y
				op: operation.AND,
				addressing: 'absoluteX',
				cycles: 4,
				abbr: 'AND'
			},

			0x3e: { // ROL abs,X
				op: operation.ROL,
				addressing: 'absoluteX',
				cycles: 7,
				abbr: 'ROL'
			},

			0x40: { // RTI impl
				op: function() {
					regSet.sr = stack.popByte();
					regSet.pc = stack.popWord();
				},
				addressing: 'implied',
				cycles: 6,
				abbr: 'RTI'
			},

			0x41: { // EOR x,ind
				op: operation.EOR,
				addressing: 'xIndexedIndirect',
				cycles: 6,
				abbr: 'EOR'
			},

			0x45: { // EOR zpg
				op: operation.EOR,
				addressing: 'zeroPage',
				cycles: 3,
				abbr: 'EOR'
			},

			0x46: { // LSR zpg
				op: operation.LSR,
				addressing: 'zeroPage',
				cycles: 5,
				abbr: 'LSR'
			},

			0x48: { // PHA A
				op: function() {
					stack.pushByte(regSet.ac);
				},
				addressing: 'implied',
				cycles: 3,
				abbr: 'PHA'
			},

			0x49: { // EOR #
				op: function() {
					regSet.ac ^= fetchInstruction();
					status.setFlagsNZ(regSet.ac);
				},
				addressing: 'immediate',
				cycles: 2,
				abbr: 'EOR'
			},

			0x4a: { // LSR A
				op: function() {
					regSet.ac = logicalShiftRight(regSet.ac);
				},
				addressing: 'accumulator',
				cycles: 2,
				abbr: 'LSR'
			},

			0x4c: { // JMP abs
				op: function(fAddr) {
					regSet.pc = fAddr();
				},
				addressing: 'absolute',
				cycles: 3,
				abbr: 'JMP'
			},

			0x4d: { // EOR abs
				op: operation.EOR,
				addressing: 'absolute',
				cycles: 4,
				abbr: 'EOR'
			},

			0x4e: { // LSR abs
				op: operation.LSR,
				addressing: 'absolute',
				cycles: 6,
				abbr: 'LSR'
			},

			0x50: { // BVC rel
				op: function(fAddr) {
					if (!status.isSet('V')) {
						regSet.pc = fAddr();
					} else {
						regSet.pc = (regSet.pc + 1) & 0xffff;
					}
				},
				addressing: 'relative',
				cycles: 2,
				abbr: 'BVC'
			},

			0x51: { // EOR ind,Y
				op: operation.EOR,
				addressing: 'indirectYIndexed',
				cycles: 5,
				abbr: 'EOR'
			},

			0x55: { // EOR zpg,X
				op: operation.EOR,
				addressing: 'zeroPageX',
				cycles: 4,
				abbr: 'EOR'
			},

			0x56: { // LSR zpg,X
				op: operation.LSR,
				addressing: 'zeroPageX',
				cycles: 6,
				abbr: 'LSR'
			},

			0x58: { // CLI impl
				op: function() {
					status.reset('I');
				},
				addressing: 'implied',
				cycles: 2,
				abbr: 'CLI'
			},

			0x59: { // EOR abs,Y
				op: operation.EOR,
				addressing: 'absoluteY',
				cycles: 4,
				abbr: 'EOR'
			},

			0x5d: { // EOR abs,X
				op: operation.EOR,
				addressing: 'absoluteX',
				cycles: 4,
				abbr: 'EOR'
			},

			0x5e: { // LSR abs,X
				op: operation.LSR,
				addressing: 'absoluteX',
				cycles: 7,
				abbr: 'LSR'
			},

			0x60: { // RTS impl
				op: function() {
					regSet.pc = stack.popWord();
				},
				addressing: 'implied',
				cycles: 6,
				abbr: 'RTS'
			},

			0x61: { // ADC X,ind
				op: operation.ADC,
				addressing: 'xIndexedIndirect',
				cycles: 6,
				abbr: 'ADC'
			},

			0x65: { // ADC zpg
				op: operation.ADC,
				addressing: 'zeroPage',
				cycles: 3,
				abbr: 'ADC'
			},

			0x66: { // ROR zpg
				op: operation.ROR,
				addressing: 'zeroPage',
				cycles: 5,
				abbr: 'ROR'
			},

			0x68: { // PLA impl
				op: function() {
					regSet.ac = stack.popByte();
				},
				addressing: 'implied',
				cycles: 4,
				abbr: 'PLA'
			},

			0x69: { // ADC #
				op: operation.ADC,
				addressing: 'immediate',
				cycles: 2,
				abbr: 'ADC'
			},

			0x6a: { // ROR A
				op: function() {
					regSet.ac = rotateRight(regSet.ac);
				},
				addressing: 'accumulator',
				cycles: 2,
				abbr: 'ROR'
			},

			0x6c: { // JMP ind
				op: function() {
					var addr = mmap.readWord(regSet.pc);
					regSet.pc = mmap.readWord(addr);
				},
				addressing: 'indirect',
				cycles: 5,
				abbr: 'JMP'
			},

			0x6d: { // ADC abs
				op: operation.ADC,
				addressing: 'absolute',
				cycles: 4,
				abbr: 'ADC'
			},

			0x6e: { // ROR abs
				op: operation.ROR,
				addressing: 'absolute',
				cycles: 6,
				abbr: 'ROR'
			},

			0x70: { // BVS rel
				op: function(fAddr) {
					if (status.isSet('V')) {
						regSet.pc = fAddr();
					} else {
						regSet.pc = (regSet.pc + 1) & 0xffff;
					}
				},
				addressing: 'relative',
				cycles: 2,
				abbr: 'BVS'
			},

			0x71: { // ADC Y,ind
				op: operation.ADC,
				addressing: 'indirectYIndexed',
				cycles: 5,
				abbr: 'ADC'
			},

			0x75: { // ADC zpg,X
				op: operation.ADC,
				addressing: 'zeroPageX',
				cycles: 4,
				abbr: 'ADC'
			},

			0x76: { // ROR zpg,X
				op: operation.ROR,
				addressing: 'zeroPageX',
				cycles: 6,
				abbr: 'ROR'
			},

			0x78: { // SEI impl
				op: function() {
					status.set('I');
				},
				addressing: 'implied',
				cycles: 2,
				abbr: 'SEI'
			},

			0x79: { // ADC abs,Y
				op: operation.ADC,
				addressing: 'absoluteY',
				cycles: 4,
				abbr: 'ADC'
			},

			0x7d: { // ADC abs,X
				op: operation.ADC,
				addressing: 'absoluteX',
				cycles: 4,
				abbr: 'ADC'
			},

			0x7e: { // ROR abs,X
				op: operation.ROR,
				addressing: 'absoluteX',
				cycles: 7,
				abbr: 'ROR'
			},

			0x81: { // STA X,ind
				op: operation.STA,
				addressing: 'xIndexedIndirect',
				cycles: 6,
				abbr: 'STA'
			},

			0x84: { // STY zpg
				op: operation.STY,
				addressing: 'zeroPage',
				cycles: 3,
				abbr: 'STY'
			},

			0x85: { // STA zpg
				op: operation.STA,
				addressing: 'zeroPage',
				cycles: 3,
				abbr: 'STA'
			},

			0x86: { // STX zpg
				op: operation.STX,
				addressing: 'zeroPage',
				cycles: 3,
				abbr: 'STX'
			},

			0x88: { // DEY impl
				op: function() {
					regSet.y = (regSet.y - 1) & 0xff;
					status.setFlagsNZ(regSet.y);
				},
				addressing: 'implied',
				cycles: 2,
				abbr: 'DEY'
			},

			0x8a: { // TXA impl
				op: function() {
					regSet.ac = regSet.x;
					status.setFlagsNZ(regSet.ac);
				},
				addressing: 'implied',
				cycles: 2,
				abbr: 'TXA'
			},

			0x8c: { // STY abs
				op: operation.STY,
				addressing: 'absolute',
				cycles: 4,
				abbr: 'STY'
			},

			0x8d: { // STA abs
				op: operation.STA,
				addressing: 'absolute',
				cycles: 4,
				abbr: 'STA'
			},

			0x8e: { // STX abs
				op: operation.STX,
				addressing: 'absolute',
				cycles: 4,
				abbr: 'STX'
			},

			0x90: { // BCC rel
				op: function(fAddr) {
					if (!status.isSet('C')) {
						regSet.pc = fAddr();
					} else {
						regSet.pc = (regSet + 1) & 0xffff;
					}
				},
				addressing: 'relative',
				cycles: 2,
				abbr: 'BCC'
			},

			0x91: { // STA ind,Y
				op: operation.STA,
				addressing: 'indirectYIndexed',
				cycles: 6,
				abbr: 'STA'
			},

			0x94: { // STY zpg,X
				op: operation.STY,
				addressing: 'zeroPageX',
				cycles: 4,
				abbr: 'STY'
			},

			0x95: { // STA zpg,X
				op: operation.STA,
				addressing: 'zeroPageX',
				cycles: 4,
				abbr: 'STA'
			},

			0x96: { // STX zpg,Y
				op: operation.STX,
				addressing: 'zeroPageY',
				cycles: 4,
				abbr: 'STX'
			},

			0x98: { // TYA impl
				op: function() {
					regSet.ac = regSet.y;
					status.setFlagsNZ(regSet.ac);
				},
				addressing: 'implied',
				cycles: 2,
				abbr: 'TYA'
			},

			0x99: { // STA abs,Y
				op: operation.STA,
				addressing: 'absoluteY',
				cycles: 5,
				abbr: 'STA'
			},

			0x9a: { // TXS impl
				op: function() {
					regSet.sp = regSet.x;
				},
				addressing: 'implied',
				cycles: 2,
				abbr: 'TXS'
			},

			0x9d: { // STA abs,X
				op: operation.STA,
				addressing: 'absoluteX',
				cycles: 5,
				abbr: 'STA'
			},

			0xa0: { // LDY #
				op: operation.LDY,
				addressing: 'immediate',
				cycles: 2,
				abbr: 'LDY'
			},

			0xa1: { // LDA X,ind
				op: operation.LDA,
				addressing: 'xIndexedIndirect',
				cycles: 6,
				abbr: 'LDA'
			},

			0xa2: { // LDX #
				op: operation.LDX,
				addressing: 'immediate',
				cycles: 2,
				abbr: 'LDX'
			},

			0xa4: { // LDY zpg
				op: operation.LDY,
				addressing: 'zeroPage',
				cycles: 3,
				abbr: 'LDY'
			},

			0xa5: { // LDA zpg
				op: operation.LDA,
				addressing: 'zeroPage',
				cycles: 3,
				abbr: 'LDA'
			},

			0xa6: { // LDX zpg
				op: operation.LDX,
				addressing: 'zeroPage',
				cycles: 3,
				abbr: 'LDX'
			},

			0xa8: { // TAY impl
				op: function() {
					regSet.y = regSet.ac;
					status.setFlagsNZ(regSet.y);
				},
				addressing: 'implied',
				cycles: 2,
				abbr: ''
			},

			0xa9: { // LDA #
				op: operation.LDA,
				addressing: 'immediate',
				cycles: 2,
				abbr: 'LDA'
			},

			0xaa: { // TAX impl
				op: function() {
					regSet.x = regSet.ac;
					status.setFlagsNZ(regSet.x);
				},
				addressing: 'implied',
				cycles: 2,
				abbr: 'TAX'
			},

			0xac: { // LDY abs
				op: operation.LDY,
				addressing: 'absolute',
				cycles: 4,
				abbr: 'LDY'
			},

			0xad: { // LDA abs
				op: operation.LDA,
				addressing: 'absolute',
				cycles: 4,
				abbr: 'LDA'
			},

			0xae: { // LDX abs
				op: operation.LDX,
				addressing: 'absolute',
				cycles: 5,
				abbr: 'LDX'
			},

			0xb0: { // BCS rel
				op: function(fAddr) {
					if (status.isSet('C')) {
						regSet.pc = fAddr();
					} else {
						regSet.pc = (regSet.pc + 1) & 0xffff;
					}
				},
				addressing: 'relative',
				cycles: 2,
				abbr: 'BCS'
			},

			0xb1: { // LDA ind,Y
				op: operation.LDY,
				addressing: 'indirectYIndexed',
				cycles: 5,
				abbr: 'LDA'
			},

			0xb4: { // LDY zpg,X
				op: operation.LDY,
				addressing: 'zeroPageX',
				cycles: 4,
				abbr: 'LDY'
			},

			0xb5: { // LDA zpg,X
				op: operation.LDA,
				addressing: 'zeroPageX',
				cycles: 4,
				abbr: 'LDA'
			},

			0xb6: { // LDX zpg,Y
				op: operation.LDX,
				addressing: 'zeroPageY',
				cycles: 4,
				abbr: 'LDX'

			},

			0xb8: { // CLV impl
				op: function() {
					status.reset('V');
				},
				addressing: 'implied',
				cycles: 2,
				abbr: 'CLV'
			},

			0xb9: { // LDA abs,Y
				op: operation.LDA,
				addressing: 'absoluteY',
				cycles: 4,
				abbr: 'LDA'
			},

			0xba: { // TSX impl
				op: function() {
					regSet.x = regSet.sp;
					status.setFlagsNZ(regSet.x);
				},
				addressing: 'implied',
				cycles: 2,
				abbr: 'TSX'
			},

			0xbc: { // LDY abs,X
				op: operation.LDY,
				addressing: 'absoluteX',
				cycles: 4,
				abbr: 'LDY'
			},

			0xbd: { // LDA abs,X
				op: operation.LDA,
				addressing: 'absoluteX',
				cycles: 4,
				abbr: 'LDA'
			},

			0xbe: { // LDX abs,Y
				op: operation.LDX,
				addressing: 'absoluteY',
				cycles: 4,
				abbr: 'LDX'
			},

			0xc0: { // CPY #
				op: operation.CPY,
				addressing: 'immediate',
				cycles: 2,
				abbr: 'CPY'
			},

			0xc1: { // CMP X,ind
				op: operation.CMP,
				addressing: 'xIndexedIndirect',
				cycles: 6,
				abbr: 'CMP'
			},

			0xc4: { // CPY zpg
				op: operation.CPY,
				addressing: 'zeroPage',
				cycles: 3,
				abbr: 'CPY'
			},

			0xc5: { // CMP zpg
				op: operation.CMP,
				addressing: 'zeroPage',
				cycles: 3,
				abbr: 'CMP'
			},

			0xc6: { // DEC zpg
				op: operation.DEC,
				addressing: 'zeroPage',
				cycles: 5,
				abbr: 'DEC'
			},

			0xc8: { // INY impl
				op: function() {
					regSet.y = (regSet.y + 1) & 0xff;
					status.setFlagsNZ(regSet.y);
				},
				addressing: 'implied',
				cycles: 2,
				abbr: 'INY'
			},

			0xc9: { // CMP #
				op: operation.CMP,
				addressing: 'immediate',
				cycles: 2,
				abbr: 'CMP'
			},

			0xca: { // DEX impl
				op: function() {
					regSet.x = (regSet.x - 1) & 0xff;
					status.setFlagsNZ(regSet.x);
				},
				addressing: 'implied',
				cycles: 2,
				abbr: 'DEX'
			},

			0xcc: { // CPY abs
				op: operation.CPY,
				addressing: 'absolute',
				cycles: 4,
				abbr: 'CPY'
			},

			0xcd: { // CMP abs
				op: operation.CMP,
				addressing: 'absolute',
				cycles: 4,
				abbr: 'CMP'
			},

			0xce: { // DEC abs
				op: operation.DEC,
				addressing: 'absolute',
				cycles: 3,
				abbr: 'DEC'
			},

			0xd0: { // BNE rel
				op: function(fAddr) {
					if (!status.isSet('Z')) {
						regSet.pc = fAddr();
					} else {
						regSet.pc = (regSet.pc + 1) & 0xffff;
					}
				},
				addressing: 'relative',
				cycles: 2,
				abbr: 'BNE'
			},

			0xd1: { // CMP ind,Y
				op: operation.CMP,
				addressing: 'indirectYIndexed',
				cycles: 5,
				abbr: 'CMP'
			},

			0xd5: { // CMP zpg,X
				op: operation.CMP,
				addressing: 'zeroPageX',
				cycles: 4,
				abbr: 'CMP'
			},

			0xd6: { // DEC zpg,X
				op: operation.DEC,
				addressing: 'zeroPageX',
				cycles: 6,
				abbr: 'DEC'
			},

			0xd8: { // CLD impl
				op: function() {
					status.reset('D');
				},
				addressing: 'implied',
				cycles: 2,
				abbr: 'CLD'
			},

			0xd9: { // CMP abs,Y
				op: operation.CMP,
				addressing: 'absoluteY',
				cycles: 4,
				abbr: 'CMP'
			},

			0xdd: { // CMP abs,X
				op: operation.CMP,
				addressing: 'absoluteX',
				cycles: 4,
				abbr: 'CMP'
			},

			0xde: { // DEC abs,X
				op: operation.DEC,
				addressing: 'absoluteX',
				cycles: 7,
				abbr: 'DEC'
			},

			0xe0: { // CPX #
				op: operation.CPX,
				addressing: 'immediate',
				cycles: 2,
				abbr: 'CPX'
			},

			0xe1: { // SBC X,ind
				op: operation.SBC,
				addressing: 'xIndexedIndirect',
				cycles: 6,
				abbr: 'SBC'
			},

			0xe4: { // CPX zpg
				op: operation.CPX,
				addressing: 'zeroPage',
				cycles: 3,
				abbr: 'CPX'
			},

			0xe5: { // SBC zpg
				op: operation.SBC,
				addressing: 'zeroPage',
				cycles: 3,
				abbr: 'SBC'
			},

			0xe6: { // INC zpg
				op: operation.INC,
				addressing: 'zeroPage',
				cycles: 5,
				abbr: 'INC'
			},

			0xe8: { // INX impl
				op: function() {
					regSet.x = (regSet.x + 1) & 0xff;
					status.setFlagsNZ(regSet.x);
				},
				addressing: 'implied',
				cycles: 2,
				abbr: 'INX'
			},

			0xe9: { // SBC #
				op: operation.SBC,
				addressing: 'immediate',
				cycles: 2,
				abbr: 'SBC'
			},

			0xea: { // NOP impl
				op: function() {},
				addressing: 'implied',
				cycles: 2,
				abbr: 'NOP'
			},

			0xec: { // CPX abs
				op: operation.CPX,
				addressing: 'absolute',
				cycles: 4,
				abbr: 'CPX'
			},

			0xed: { // SBC abs
				op: operation.SBC,
				addressing: 'absolute',
				cycles: 4,
				abbr: 'SBC'
			},

			0xee: { // INC abs
				op: operation.INC,
				addressing: 'absolute',
				cycles: 6,
				abbr: 'INC'
			},

			0xf0: { // BEQ rel
				op: function(fAddr) {
					if (status.isSet('Z')) {
						regSet.pc = fAddr();
					} else {
						regSet.pc = (regSet.pc + 1) & 0xffff;
					}
				},
				addressing: 'relative',
				cycles: 2,
				abbr: 'BEQ'
			},

			0xf1: { // SBC ind,Y
				op: operation.SBC,
				addressing: 'indirectYIndexed',
				cycles: 5,
				abbr: 'SBC'
			},

			0xf5: { // SBC zpg,X
				op: operation.SBC,
				addressing: 'zeroPageX',
				cycles: 4,
				abbr: 'SBC'
			},

			0xf6: { // INC zpg,X
				op: operation.INC,
				addressing: 'zeroPageX',
				cycles: 6,
				abbr: 'INC'
			},

			0xf8: { // SED impl
				op: function() {
					status.set('D');
				},
				addressing: 'implied',
				cycles: 2,
				abbr: 'SED'
			},

			0xf9: { // SBC abs,Y
				op: operation.SBC,
				addressing: 'absoluteY',
				cycles: 4,
				abbr: 'SBC'
			},

			0xfd: { // SBC abs,X
				op: operation.SBC,
				addressing: 'absoluteX',
				cycles: 4,
				abbr: 'SBC'
			},

			0xfe: { // INC abs,X
				op: operation.INC,
				addressing: 'absoluteX',
				cycles: 7,
				abbr: 'INC'
			}

		},

		getAddressString = function(addressing) {
			var ll = mmap.readByte(regSet.pc),
				hh = mmap.readByte((regSet.pc + 1) & 0xffff);
				twoHex = function(hex) {
					hex = hex.toString(16);
					while (hex.length < 2) {
						hex = '0' + hex;
					}
					return hex;
				};

			switch (addressing) {
				case 'accumulator':
					return 'A';
				case 'absolute':
					return '$' + twoHex(hh) + twoHex(ll);
				case 'absoluteX':
					return '$' + twoHex(hh) + twoHex(ll) + ',X';
				case 'absoluteY':
					return '$' + twoHex(hh) + twoHex(ll) + ',Y';
				case 'immediate':
					return '#$' + twoHex(ll);
				case 'implied':
					return 'impl';
				case 'indirect':
					return '($' + twoHex(hh) + twoHex(ll) + ')';
				case 'xIndexedIndirect':
					return '($' + twoHex(ll) + ',X)';
				case 'indirectYIndexed':
					return '($' + twoHex(ll) + '),Y';
				case 'relative':
					return '$' + twoHex(ll);
				case 'zeroPage':
					return '$' + twoHex(ll);
				case 'zeroPageX':
					return '$' + twoHex(ll) + ',X';
				case 'zeroPageY':
					return '$' + twoHex(ll) + ',Y';
				default:
					throw new Error('Illegal addressing mode detected.');
			}
		},

		execProcessorOnce = function() {
			var fAddr, inst,
				opcode = fetchInstruction(),
				handlerLength = execloopHandlers.length,
				i = 0;

			inst = instruction[opcode];

			if (inst.addressing in addrMode) {
				fAddr = addrMode[inst.addressing];
				inst.op(fAddr);
			} else {
				inst.op();
			}

			cycleCount += inst.cycles;

			for (; i < handlerLength; i++) {
				execloopHandlers[i](opcode, getAddressString(inst.addressing));
			}
		},

		execProcessorLoop = function() {
			var fAddr,
				opcode,
				i,
				handlerLength = execloopHandlers.length,
				inst,
				cycles = 0;
			
			while (cycles < 100000) {
				opcode = fetchInstruction();
				inst = instruction[opcode];

				if (inst.addressing in addrMode) {
					fAddr = addrMode[inst.addressing];
					inst.op(fAddr);
				} else {
					inst.op();
				}

				cycles += inst.cycles;
				cycleCount += inst.cycles;

				for (i = 0; i < handlerLength; i++) {
					execloopHandlers[i](opcode);
				}
			}

			if (breakFlag === false) {
				setTimeout(execProcessorLoop, 0);
			} else {
				handlerLength = stopHandlers.length;
				for (i = 0; i < handlerLength; i++) {
					stopHandlers[i]();
				}
			}
		};

	return {

		init: function() {

			// reset the cycle counter
			cycleCount = 0;

			// calculate how many calculations to perform before throttling
			// the proc loop to emulate the actual clock speed of the 2A03
			cyclesPerMs = clockSpeed * 1e+9;

			breakFlag = true;
		},

		start: function() {
			var i = 0,
				len = startHandlers.length;

			for (; i < len; i++) {
				startHandlers[i]();
			}

			breakFlag = false;
			execProcessorLoop();
		},

		stop: function() {
			breakFlag = true;
		},

		step: function() {
			if (breakFlag === true) {
				execProcessorOnce();
			}
		},

		addEventListener: function(type, handler) {
			if (typeof handler !== 'function') {
				throw new Error('Parameter handler must be of type function.');
			}

			if (type === 'execloop') {
				execloopHandlers.push(handler);
			} else if (type === 'start') {
				startHandlers.push(handler);
			} else if (type === 'stop') {
				stopHandlers.push(handler);
			} else {
				throw new Error('Event type is invalid.');
			}
		},

		loadProgram: function(program, offset, len) {
			var i = 0,
				memSize = mmap.length;

			if (typeof offset === 'undefined') {
				offset = 0;
			}

			if (typeof len === 'undefined') {
				len = program.length;
			}

			for (; i < len; i++) {
				if (i + offset >= memSize) {
					throw new Error('Program size is larger than memory size');
				}
				mmap.writeByte(program[i], i + offset);
			}

			regSet.pc = offset;
		},

		getRegister: function(name) {
			name = name.toLowerCase();

			if (name in regSet) {
				return regSet[name];
			}
			
			throw new Error('The specified register does not exist.');
		},

		getCycleCount: function() {
			return cycleCount;
		},

		getInstruction: function(opcode) {
			if (opcode in instruction) {
				inst = instruction[opcode];

				return {
					opcode: opcode,
					addressMode: inst.addressing,
					cycles: inst.cycles
				};
			}

			throw new Error('Illegal opcode has been specified.');
		},

		memory: mmap

	};

})();