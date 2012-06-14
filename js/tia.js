/**
 * "tia.js -- Television Interface Adaptor
 * Author: Jason T. Stoudt
 * Date: 28 March 2012
 *
 * A javascript representation of the Television Interface Adaptor found in
 * the Atari 2600.
 */

window.TIA = (function() {

	var mmap,          // the memory map to be shared between TIA & CPU

		pixelBuffer,   // the array of pixel colors representing the video output

		canvasContext, // the context of the canvas element for video output

		handlers = {
			start: [],
			stop: []
		},

		reqAnimFrame = window.requestAnimationFrame ||
			window.webkitRequestAnimationFrame ||
			window.mozRequestAnimationFrame ||
			window.oRequestAnimationFrame ||
			window.msRequestAnimationFrame,

		cancelAnimFrame = window.cancelAnimationFrame ||
			window.webkitCancelAnimationFrame ||
			window.mozCancelAnimationFrame ||
			window.oCancelAnimationFrame ||
			window.msCancelAnimationFrame,

		rafId = null,

		numFrames = 0, // the number of frames written to the canvas

		started = false,

		// a value that cycles between 0, 1 and 2 -- 6507 is cycled on 2
		tiaClock = 0,

		// the position of the beam on the x-axis from -68 to 159
		x = -68,

		// the position of the beam on the y-axis
		y = 0,

		// when this is true, the CPU does not cycle
		RDY = false,

		// when set, a signal is being sent to reset the beam to the top of the frame
		VSYNC = false,

		vsyncCount = 0,

		VBLANK = false,

		// horizontal positions for moveable game graphics
		p0Pos = 0,
		p1Pos = 0,
		m0Pos = 0,
		m1Pos = 0,
		blPos = 0,

		p0Clock = 0,
		p1Clock = 0,
		m0Clock = 0,
		m1Clock = 0,
		blClock = 0,

		p0Start = false,
		p1Start = false,
		m0Start = false,
		m1Start = false,

		// internal registers for the GRP0 and GRP1 values
		oldGRP0 = 0x00,
		newGRP0 = 0x00,
		oldGRP1 = 0x00,
		newGRP1 = 0x00,

//		TARGET_CYCLE_RATE = 3579.545, // frequency of the TIA clock in kHz

		// the dimensions of the output video buffer -- NTSC-only for now
		VIDEO_BUFFER_WIDTH  = 0,
		VIDEO_BUFFER_HEIGHT = 0,

		// locations of TIA registers on the system bus
		MEM_LOCATIONS = {
			// TIA Sync registers
			VSYNC:  0x00,		VBLANK: 0x01,
			WSYNC:  0x02,		RSYNC:  0x03,

			// TIA Graphics registers
			NUSIZ0: 0x04,		NUSIZ1: 0x05,
			COLUP0: 0x06,		COLUP1: 0x07,
			COLUPF: 0x08,		COLUBK: 0x09,
			CTRLPF: 0x0a,
			REFP0:  0x0b,		REFP1:  0x0c,
			PF0:    0x0d,		PF1:    0x0e,		PF2:    0x0f,
			RESP0:  0x10,		RESP1:  0x11,
			RESM0:  0x12,		RESM1:  0x13,
			RESBL:  0x14,
			AUDC0:  0x15,		AUDC1:  0x16,
			AUDF0:  0x17,		AUDF1:  0x18,
			AUDV0:  0x19,		AUDV1:  0x1a,
			GRP0:   0x1b,		GRP1:   0x1c,
			ENAM0:  0x1d,		ENAM1:  0x1e,
			ENABL:  0x1f,
			HMP0:   0x20,		HMP1:   0x21,
			HMM0:   0x22,		HMM1:   0x23,
			HMBL:   0x24,
			VDELP0: 0x25,		VDELP1: 0x26,
			VDELBL: 0x27,
			RESMP0: 0x28,		RESMP1: 0x29,
			HMOVE:  0x2a,		HMCLR:  0x2b,
			CXCLR:  0x2c,

			// These are TIA Collision Read Registers
			CXM0P:  0x40,		CXM1P:  0x41,
			CXP0FB: 0x42,		CXP1FB: 0x43,
			CXM0FB: 0x44,		CXM1FB: 0x45,
			CXBLPF: 0x46,		CXPPMM: 0x47,

			// These are TIA Input Read Registers
			INPT0:  0x48,		INPT1:  0x49,
			INPT2:  0x4a,		INPT3:  0x4b,
			INPT4:  0x4c,		INPT5:  0x4d
		},

		// the Atari 2600 NTSC color palette
		COLOR_PALETTE = [
			[    // 0
				[0x00,0x00,0x00],[0x40,0x40,0x40],[0x6c,0x6c,0x6c],[0x90,0x90,0x90],
				[0xb0,0xb0,0xb0],[0xc8,0xc8,0xc8],[0xdc,0xdc,0xdc],[0xec,0xec,0xec]
			], [ // 1
				[0x44,0x44,0x00],[0x64,0x64,0x10],[0x84,0x84,0x24],[0xa0,0xa0,0x34],
				[0xb8,0xb8,0x40],[0xd0,0xd0,0x50],[0xe8,0xe8,0x5c],[0xfc,0xfc,0x68]
			], [ // 2
				[0x70,0x28,0x00],[0x84,0x44,0x14],[0x98,0x5c,0x28],[0xac,0x78,0x3c],
				[0xbc,0x8c,0x4c],[0xcc,0xa0,0x5c],[0xdc,0xb4,0x68],[0xec,0xc8,0x78]
			], [ // 3
				[0x84,0x18,0x00],[0x98,0x34,0x18],[0xac,0x50,0x30],[0xc0,0x68,0x48],
				[0xd0,0x80,0x5c],[0xe0,0x94,0x70],[0xec,0xa8,0x80],[0xfc,0xbc,0x94]
			], [ // 4
				[0x88,0x00,0x00],[0x9c,0x20,0x20],[0xb0,0x3c,0x3c],[0xc0,0x58,0x58],
				[0xd0,0x70,0x70],[0xe0,0x88,0x88],[0xec,0xa0,0xa0],[0xfc,0xb4,0xb4]
			], [ // 5
				[0x78,0x00,0x5c],[0x8c,0x20,0x74],[0xa0,0x3c,0x88],[0xb0,0x58,0x9c],
				[0xc0,0x70,0xb0],[0xd0,0x84,0xc0],[0xdc,0x9c,0xd0],[0xec,0xb0,0xe0]
			], [ // 6
				[0x48,0x00,0x78],[0x60,0x20,0x90],[0x78,0x3c,0xa4],[0x8c,0x58,0xb8],
				[0xa0,0x70,0xcc],[0xb4,0x84,0xdc],[0xc4,0x9c,0xec],[0xd4,0xb0,0xfc]
			], [ // 7
				[0x14,0x00,0x84],[0x30,0x20,0x98],[0x4c,0x3c,0xac],[0x68,0x58,0xc0],
				[0x7c,0x70,0xd0],[0x94,0x88,0xe0],[0xa8,0xa0,0xec],[0xbc,0xb4,0xfc]
			], [ // 8
				[0x00,0x00,0x88],[0x1c,0x20,0x9c],[0x38,0x40,0xb0],[0x50,0x5c,0xc0],
				[0x68,0x74,0xd0],[0x7c,0x8c,0xe0],[0x90,0xa4,0xec],[0xa4,0xb8,0xfc]
			], [ // 9
				[0x00,0x18,0x7c],[0x1c,0x38,0x90],[0x38,0x54,0xa8],[0x50,0x70,0xbc],
				[0x68,0x88,0xcc],[0x7c,0x9c,0xdc],[0x90,0xb4,0xec],[0xa4,0xc8,0xfc]
			], [ // A
				[0x00,0x2c,0x5c],[0x1c,0x4c,0x78],[0x38,0x68,0x90],[0x50,0x84,0xac],
				[0x68,0x9c,0xc0],[0x7c,0xb4,0xd4],[0x90,0xcc,0xe8],[0xa4,0xe0,0xfc]
			], [ // B
				[0x00,0x3c,0x2c],[0x1c,0x5c,0x48],[0x38,0x7c,0x64],[0x50,0x9c,0x80],
				[0x68,0xb4,0x94],[0x7c,0xd0,0xac],[0x90,0xe4,0xc0],[0xa4,0xfc,0xd4]
			], [ // C
				[0x00,0x3c,0x00],[0x20,0x5c,0x20],[0x40,0x7c,0x40],[0x5c,0x9c,0x5c],
				[0x74,0xb4,0x74],[0x8c,0xd0,0x8c],[0xa4,0xe4,0xa4],[0xb8,0xfc,0xb8]
			], [ // D
				[0x14,0x38,0x00],[0x34,0x5c,0x1c],[0x50,0x7c,0x38],[0x6c,0x98,0x50],
				[0x84,0xb4,0x68],[0x9c,0xcc,0x7c],[0xb4,0xe4,0x90],[0xc8,0xfc,0xa4]
			], [ // E
				[0x2c,0x30,0x00],[0x4c,0x50,0x1c],[0x68,0x70,0x34],[0x84,0x8c,0x4c],
				[0x9c,0xa8,0x64],[0xb4,0xc0,0x78],[0xcc,0xd4,0x88],[0xe0,0xec,0x9c]
			], [ // F
				[0x44,0x28,0x00],[0x64,0x48,0x18],[0x84,0x68,0x30],[0xa0,0x84,0x44],
				[0xb8,0x9c,0x58],[0xd0,0xb4,0x6c],[0xe8,0xcc,0x7c],[0xfc,0xe0,0x8c]
			]
		],

		initMemoryMap = function() {
			function hmove(x, d) {
				// only bits D7 to D4 affect horizontal motion, so confine
				// just those bits
				d >>>= 4;

				// if d is negative, move that many pixels to the right
				if (d & 0x08) {
					x += (~d & 0x0f) + 1;

					// wrap around if we went passed the right of the canvas
					if (x > 159) {
						x -= 160;
					}
				} else { // d is nonnegative - move to the left
					x -= d;

					// wrap around if we passed the left side of the canvas
					if (x < 0) {
						x = 160 - x;
					}
				}

				return x;
			}

			var readonlyList = [
					'CXM0P', 'CXM1P', 'CXP0FB', 'CXP1FB', 'CXM0FB',
					'CXM1FB', 'CXBLPF', 'CXPPMM',
					'INPT0', 'INPT1', 'INPT2', 'INPT3', 'INPT4', 'INPT5'
				],
				i = 0,
				len = readonlyList.length;

			mmap = new MemoryMap(13);
			// add the readonly memory locations
			for (; i < len; i++) {
				mmap.addReadOnly(MEM_LOCATIONS[readonlyList[i]]);
			}

			// set the RDY latch when the WSYNC address is strobed
			mmap.addStrobeCallback(MEM_LOCATIONS.WSYNC, function() {
				RDY = true;
			});

			// reset the P0 graphics position when RESP0 is strobed
			mmap.addStrobeCallback(MEM_LOCATIONS.RESP0, function() {
				p0Pos = Math.max(0, x + 5);
				if (p0Pos >= 160) {
					p0Pos -= 160;
				}
				p0Start = false;
			});

			// reset the P1 graphics position when RESP1 is strobed
			mmap.addStrobeCallback(MEM_LOCATIONS.RESP1, function() {
				p1Pos = Math.max(0, x + 5);
				if (p1Pos >= 160) {
					p1Pos -= 160;
				}
				p1Start = false;
			});

			// reset the M0 graphics position when RESM0 is strobed
			mmap.addStrobeCallback(MEM_LOCATIONS.RESM0, function() {
				m0Pos = Math.max(0, x + 4);
				if (m0Pos >= 160) {
					m0Pos -= 160;
				}
				m0Start = false;
			});

			// reset the M1 graphics position when RESM1 is strobed
			mmap.addStrobeCallback(MEM_LOCATIONS.RESM1, function() {
				m1Pos = Math.max(0, x + 4);
				if (m1Pos >= 160) {
					m1Pos -= 160;
				}
				m1Start = false;
			});

			// reset the BL graphics position when RESBL is strobed
			mmap.addStrobeCallback(MEM_LOCATIONS.RESBL, function() {
				blPos = Math.max(0, x + 4);
				if (blPos >= 160) {
					blPos -= 160;
				}
			});

			// adjust the position of each of the graphics when the HMOVE
			// memory address is strobed
			mmap.addStrobeCallback(MEM_LOCATIONS.HMOVE, function() {
				p0Pos = hmove(p0Pos, mmap.readByte(MEM_LOCATIONS.HMP0));
				p1Pos = hmove(p1Pos, mmap.readByte(MEM_LOCATIONS.HMP1));
				m0Pos = hmove(m0Pos, mmap.readByte(MEM_LOCATIONS.HMM0));
				m1Pos = hmove(m1Pos, mmap.readByte(MEM_LOCATIONS.HMM1));
				blPos = hmove(blPos, mmap.readByte(MEM_LOCATIONS.HMBL));
			});

			// store the new GRP0 value and copy the old one
			mmap.addStrobeCallback(MEM_LOCATIONS.GRP0, function(val) {
				oldGRP0 = newGRP0;
				newGRP0 = val;
			});

			// store the new GRP1 value and copy the old one
			mmap.addStrobeCallback(MEM_LOCATIONS.GRP1, function(val) {
				oldGRP1 = newGRP1;
				newGRP1 = val;
			});

			// clear all the horizintal movement registers when HMCLR is strobed
			mmap.addStrobeCallback(MEM_LOCATIONS.HMCLR, function() {
				var i = 0,
					list = ['HMP0', 'HMP1', 'HMM0', 'HMM1', 'HMBL'],
					len = list.length;

				for (; i < len; i++) {
					mmap.writeByte(0, MEM_LOCATIONS[list[i]]);
				}
			});

			// clear all the collision registers when CXCLR is strobed
			mmap.addStrobeCallback(MEM_LOCATIONS.CXCLR, function() {
				var i = 0,
					list = ['CXM0P', 'CXM1P', 'CXP0FB', 'CXP1FB', 'CXM0FB', 'CXM1FB', 'CXBLPF', 'CXPPMM'],
					len = list.length;

				for (; i < len; i++) {
					mmap.writeByte(0, MEM_LOCATIONS[list[i]]);
				}
			});

		},

		drawStaticFrame = function() {
			var color,
				i = 0,
				data  = pixelBuffer.data,
				len   = data.length;

			for (; i < len; i += 4) {
				color = Math.floor(Math.random() * 0x100);

				data[i]     = color; // red channel
				data[i + 1] = color; // green channel
				data[i + 2] = color; // blue channel
				data[i + 3] = 255;   // alpha channel (always opaque)
			}

			canvasContext.putImageData(pixelBuffer, 0, 0);

			numFrames++;

			rafId = reqAnimFrame(drawStaticFrame);
		},

		isPlayfieldAt = function(x) {
			if (x >= 20) {
				x = mmap.readByte(MEM_LOCATIONS.CTRLPF) & 0x01 ? 39 - x :
					x - 20;
			}

			return !!(x >= 12 ? mmap.readByte(MEM_LOCATIONS.PF2) & (1 << (x - 12)) :
				x >= 4 ? mmap.readByte(MEM_LOCATIONS.PF1) & (0x80 >>> (x - 4)) :
				(mmap.readByte(MEM_LOCATIONS.PF0) >>> 4) & (0x01 << x));
		},

		procPlayerClock = function(p) {
			function startClock() {
				if (p === 0) {
					p0Start = true;
				} else {
					p1Start = true;
				}
			}

			var i, clock, start, nusiz, ref, gr,
				draw = false;

			if (p === 0) {
				if (x === p0Pos) {
					p0Clock = 0;
				}
				clock = p0Clock;
				start = p0Start;
				nusiz = mmap.readByte(MEM_LOCATIONS.NUSIZ0) & 0x07;
				ref   = mmap.readByte(MEM_LOCATIONS.REFP0) & 0x08;
				gr    = (mmap.readByte(MEM_LOCATIONS.VDELP0) & 0x08) ?
					oldGRP0 :
					newGRP0;
			} else {
				if (x === p1Pos) {
					p1Clock = 0;
				}
				clock = p1Clock;
				start = p1Start;
				nusiz = mmap.readByte(MEM_LOCATIONS.NUSIZ1) & 0x07;
				ref   = mmap.readByte(MEM_LOCATIONS.REFP1) & 0x08;
				gr    = (mmap.readByte(MEM_LOCATIONS.VDELP1) & 0x08) ?
					oldGRP1 :
					newGRP1;
			}
			
			if (start === false) {
				if (clock === 156) {
					startClock();
				} else if (clock === 12 && (nusiz === 0x01 || nusiz === 0x03)) {
					startClock();
				} else if (clock === 28 && (nusiz === 0x02 || nusiz === 0x03 || nusiz === 0x06)) {
					startClock();
				} else if (clock === 60 && (nusiz === 0x04 || nusiz === 0x06)) {
					startClock();
				}
			} else if (gr !== 0x00) {
				if (nusiz === 0x05 && clock >= 1 && clock <= 16) {
					i = (clock - 1) >>> 1;
					draw = gr & (ref ? (0x01 << i) : (0x80 >>> i));
				} else if (nusiz === 0x07 && clock >= 1 && clock <= 32) {
					i = (clock - 1) >>> 2;
					draw = gr & (ref ? (0x01 << i) : (0x80 >>> i));
				} else if (clock >= 1 && clock <= 8) {
					i = clock - 1;
					draw = gr & (ref ? (0x01 << i) : (0x80 >>> i));
				} else if (clock >= 17 && clock <= 24) {
					if (nusiz === 0x01 || nusiz === 0x03 || nusiz === 0x07) {
						i = clock - 17;
						draw = gr & (ref ? (0x01 << i) : (0x80 >>> i));
					}
				} else if (clock >= 33 && clock <= 40) {
					if (nusiz === 0x02 || nusiz === 0x03 || nusiz === 0x06) {
						i = clock - 33;
						draw = gr & (ref ? (0x01 << i) : (0x80 >>> i));
					}
				} else if (clock >= 65 && clock <= 72) {
					if (nusiz === 0x04 || nusiz === 0x06) {
						i = clock - 65;
						draw = gr & (ref ? (0x01 << i) : (0x80 >>> i));
					}
				}
			}


			// increment the clock, and reset at 160 color clocks
			if (p === 0) {
				p0Clock++;
			} else {
				p1Clock++;
			}

			return !!draw;
		},

		procMissleClock = function(p) {
			function startClock() {
				if (p === 0) {
					m0Start = true;
				} else {
					m1Start = true;
				}
			}

			var enabled, start, clock, nusiz, size,
				draw = false;

			if (p === 0) {
				if (m0Pos === x) {
					m0Clock = 0;
				}
				clock = m0Clock;
				start = m0Start;
				enabled = mmap.readByte(MEM_LOCATIONS.ENAM0) & 0x02;
				nusiz = mmap.readByte(MEM_LOCATIONS.NUSIZ0);
			} else {
				if (m1Pos === x) {
					m1Clock = 0;
				}
				clock = m1Clock;
				start = m1Start;
				enabled = mmap.readByte(MEM_LOCATIONS.ENAM1) & 0x02;
				nusiz = mmap.readByte(MEM_LOCATIONS.NUSIZ1);
			}

			if (start === false) {
				if (clock === 12 && (nusiz === 0x01 || nusiz === 0x03)) {
					startClock();
				} else if (clock === 28 && (nusiz === 0x02 || nusiz === 0x03 || nusiz === 0x06)) {
					startClock();
				} else if (clock === 60 && (nusiz === 0x04 || nusiz === 0x06)) {
					startClock();
				} else if (clock === 156) {
					startClock();
				}
			} else if (enabled) {
				size = 0x01 << ((nusiz >>> 4) & 0x03);
				nusiz &= 0x07;

				if (clock >= 0 && clock < 8) {
					draw = clock < size;
				}
				else if (clock >= 16 && clock < 24) {
					if (nusiz === 0x01 || nusiz === 0x03 || nusiz === 0x07) {
						draw = (clock - 16) < size;
					}
				} else if (clock >= 32 && clock < 40) {
					if (nusiz === 0x02 || nusiz === 0x03 || nusiz === 0x06) {
						draw = (clock - 32) < size;
					}
				} else if (clock >= 64 && clock < 72) {
					if (nusiz === 0x04 || nusiz === 0x06) {
						draw = (clock - 64) < size;
					}
				}
			}

			if (p === 0) {
				m0Clock++;
			} else {
				m1Clock++;
			}

			return !!draw;
		},


		procBallClock = function() {
			var size, vdel,
				draw = false;

			if (blPos === x) {
				blClock = 0;
			}

			if (mmap.readByte(MEM_LOCATIONS.ENABL) & 0x02) {
//				vdel = !!(mmap.readByte(MEM_LOCATIONS.VDELBL) & 0x01);
			
				size = 0x01 << ((mmap.readByte(MEM_LOCATIONS.CTRLPF) >>> 4) & 0x03);
				if (blClock < size) {
					draw = true;
				}
			}

			blClock++;

			return draw;
		},

		writePixel = function(y) {
			// determine what color the pixel at the present coordinates should be
			var i    = (y * VIDEO_BUFFER_WIDTH + x) << 2,
				data = pixelBuffer.data,
				pf   = isPlayfieldAt(x >>> 2),
				p0   = procPlayerClock(0),
				p1   = procPlayerClock(1),
				m0   = procMissleClock(0),
				m1   = procMissleClock(1),
				bl   = procBallClock(),
				color;

			if (VBLANK === true) {
				color = 0x00;
			} else if (mmap.readByte(MEM_LOCATIONS.CTRLPF) & 0x04) {
				if (pf === true || bl === true) {
					if (mmap.readByte(MEM_LOCATIONS.CTRLPF) & 0x02) {
						color = mmap.readByte(x < 80 ? MEM_LOCATIONS.COLUP0 :
							MEM_LOCATIONS.COLUP1);
					} else {
						color = mmap.readByte(MEM_LOCATIONS.COLUPF);
					}
				} else if (p0 === true || m0 === true) {
					color = mmap.readByte(MEM_LOCATIONS.COLUP0);
				} else if (p1 === true || m1 === true) {
					color = mmap.readByte(MEM_LOCATIONS.COLUP1);
				} else {
					color = mmap.readByte(MEM_LOCATIONS.COLUBK);
				}
			} else {
				if (p0 === true || m0 === true) {
					color = mmap.readByte(MEM_LOCATIONS.COLUP0);
				} else if (p1 === true || m1 === true) {
					color = mmap.readByte(MEM_LOCATIONS.COLUP1);
				} else if (pf === true || bl === true) {
					if (mmap.readByte(MEM_LOCATIONS.CTRLPF) & 0x02) {
						color = mmap.readByte(x < 80 ? MEM_LOCATIONS.COLUP0 :
							MEM_LOCATIONS.COLUP1);
					} else {
						color = mmap.readByte(MEM_LOCATIONS.COLUPF);
					}
				} else {
					color = mmap.readByte(MEM_LOCATIONS.COLUBK);
				}
			}

			color = COLOR_PALETTE[(color & 0xf0) >>> 4][(color & 0x0f) >>> 1];

			data[i]     = color[0]; // red
			data[i + 1] = color[1]; // green
			data[i + 2] = color[2]; // blue
			data[i + 3] = 255;      // alpha

			// now determine if there were collisions and set the
			// correct registers
			if (m0 === true) {
				if (p0 === true) {
					mmap.writeByte(mmap.readByte(MEM_LOCATIONS.CXM0P) | 0x40,
						MEM_LOCATIONS.CXM0P);
				}
				if (p1 === true) {
					mmap.writeByte(mmap.readByte(MEM_LOCATIONS.CXM0P) | 0x80,
						MEM_LOCATIONS.CXM0P);
				}

				if (pf === true) {
					mmap.writeByte(mmap.readByte(MEM_LOCATIONS.CXM0FB) | 0x80,
						MEM_LOCATIONS.CXM0FB);
				}
				if (bl === true) {
					mmap.writeByte(mmap.readByte(MEM_LOCATIONS.CXM0FB) | 0x40,
						MEM_LOCATIONS.CXM0FB);
				}

				if (m1 === true) {
					mmap.writeByte(mmap.readByte(MEM_LOCATIONS.CXPPMM) | 0x40,
						MEM_LOCATIONS.CXPPMM);
				}
			}

			if (m1 === true) {
				if (p0 === true) {
					mmap.writeByte(mmap.readByte(MEM_LOCATIONS.CXM1P) | 0x80,
						MEM_LOCATIONS.CXM1P);
				}
				if (p1 === true) {
					mmap.writeByte(mmap.readByte(MEM_LOCATIONS.CXM1P) | 0x40,
						MEM_LOCATIONS.CXM1P);
				}

				if (pf === true) {
					mmap.writeByte(mmap.readByte(MEM_LOCATIONS.CXM1FB) | 0x80,
						MEM_LOCATIONS.CXM1FB);
				}
				if (bl === true) {
					mmap.writeByte(mmap.readByte(MEM_LOCATIONS.CXM1FB) | 0x40,
						MEM_LOCATIONS.CXM1FB);
				}
			}

			if (p0 === true) {
				if (pf === true) {
					mmap.writeByte(mmap.readByte(MEM_LOCATIONS.CXP0FB) | 0x80,
						MEM_LOCATIONS.CXP0FB);
				}
				if (bl === true) {
					mmap.writeByte(mmap.readByte(MEM_LOCATIONS.CXP0FB) | 0x40,
						MEM_LOCATIONS.CXP0FB);
				}

				if (p1 === true) {
					mmap.writeByte(mmap.readByte(MEM_LOCATIONS.CXPPMM) | 0x80,
						MEM_LOCATIONS.CXPPMM);
				}
			}

			if (p1 === true) {
				if (pf === true) {
					mmap.writeByte(mmap.readByte(MEM_LOCATIONS.CXP1FB) | 0x80,
						MEM_LOCATIONS.CXP1FB);
				}
				if (bl === true) {
					mmap.writeByte(mmap.readByte(MEM_LOCATIONS.CXP1FB) | 0x40,
						MEM_LOCATIONS.CXP1FB);
				}
			}

			if (bl === true && pf === true) {
				mmap.writeByte(mmap.readByte(MEM_LOCATIONS.CXBLPF) | 0x80,
					MEM_LOCATIONS.CXBLPF);
			}
		},

		execClockCycle = function() {
			// if we are on a clock cycle divisible by 3 and RDY latch is
			// not set, cycle the 6507
			if (tiaClock === 0 && RDY === false) {
				// if an instruction has been commited, check memory for
				// changes to TIA registers
				if (CPU6507.cycle() === true) {
					// check if the VSYNC signal has been turned on or off
					VSYNC = !!(mmap.readByte(MEM_LOCATIONS.VSYNC) & 0x02);

					// check if the VBLANK signal has been altered
					VBLANK = !!(mmap.readByte(MEM_LOCATIONS.VBLANK) & 0x02);

					return true;
				}

				// cycle the RIOT, update the timer
				RIOT.cycle();
			}

			// if we are not in VBLANK or HBLANK write the pixel to the
			// canvas at the current color clock
			if (VBLANK === false && x >= 0) {
				writePixel(y - 34);
			}
			
			// increment to draw the next pixel
			x++;

			// increment/cycle the TIA clock
			tiaClock = tiaClock === 0 ? 1 :
				tiaClock === 1 ? 2 : 0;

			// the beam is automatically reset back to HBLANK when
			// we get to the right edge of the frame
			if (x > 159) {
				x = -68;

				// reset the RDY flag so the CPU can begin cycling again
				if (RDY === true) {
					RDY = false;
				}

				// start drawing on the next scanline
				y++;

				if (VSYNC === true) {
					vsyncCount++;
				}
			}


			// return true if this cycle contained a CPU execution completion
			return false;
		},

		runMainLoop = function() {
			// run the code until VSYNC is enabled, then reset the VSYNC
			// counters and scanline, draw the frame and request another
			// execution of this function
			while(1) {
				execClockCycle();
				if (vsyncCount === 3 && VSYNC === false) {
					vsyncCount = 0;
					y = 0;
					rafId = reqAnimFrame(runMainLoop);
					canvasContext.putImageData(pixelBuffer, 0, 0);
					numFrames++;
					break;
				}
			}
		};


	return {

		init: function(canvas) {
			
			// store a reference to the canvas's context
			canvasContext = canvas.getContext('2d');

			// set the video buffer dimensions to the canvas size
			VIDEO_BUFFER_WIDTH = parseInt(canvas.width, 10);
			VIDEO_BUFFER_HEIGHT = parseInt(canvas.height, 10);

			// create a pixel buffer to hold the raw data
			pixelBuffer = canvasContext.createImageData(
				VIDEO_BUFFER_WIDTH,
				VIDEO_BUFFER_HEIGHT
			);

			// reset the started flag
			started = false;

			// cancel any frame drawing taking place
			cancelAnimFrame(rafId);

			// start the drawing static on the canvas
			rafId = reqAnimFrame(drawStaticFrame);

			// Initialize the memory map
			initMemoryMap();

			// pass the memory map on to the CPU
			CPU6507.init(mmap);

			// initialize and pass the memory map to the RIOT
			RIOT.init(mmap);

			// initialize the TIA clock
			tiaClock = 0;

			// initialize the frame counter
			numFrames = 0;

			// initialize the electron beam position
			x = -68;
			y = 0;
			// reset VBLANK, RDY and VSYNC internal registers
			RDY    = false;
			VSYNC  = !!(mmap.readByte(MEM_LOCATIONS.VSYNC) & 0x02);
			VBLANK = !!(mmap.readByte(MEM_LOCATIONS.VBLANK) & 0x02);

			// initialize horizontal positions for players, missiles and ball
			p0Pos = 0;
			p1Pos = 0;
			m0Pos = 0;
			m1Pos = 0;
			blPos = 0;
		},

		start: function() {
			var i = 0,
				l = handlers.start.length;

			cancelAnimFrame(rafId);

			// loop through and execute each of the handlers that have been
			// binded to the start event
			for (; i < l; i++) {
				handlers.start[i]();
			}

			// schecule the start of the main loop
			rafId = reqAnimFrame(runMainLoop);

			started = true;
		},

		isStarted: function() {
			return started;
		},

		step: function() {
			while(1) {
				if (execClockCycle() === true) {
					cancelAnimFrame(rafId);
					canvasContext.putImageData(pixelBuffer, 0, 0);
					break;
				}
			}
		},

		stop: function() {
			var i = 0,
				len = handlers.stop.length;

			cancelAnimFrame(rafId);

			started = false;

			// run any handlers that were bound to the stop event
			for (; i < len; i++) {
				handlers.stop[i]();
			}
		},

		addEventListener: function(type, handler) {
			if (typeof handler !== 'function') {
				throw new Error('Parameter handler must be of type function.');
			}

			if (type in handlers) {
				handlers[type].push(handler);
			} else {
				throw new Error('Event type is invalid.');
			}
		},

		getMemoryCopy: function(offset, len) {
			return mmap.getCopy(offset, len);
		},

		getNumFrames: function() {
			return numFrames;
		},

		getBeamPosition: function() {
			return {
				x: x,
				y: y
			};
		},

		getPlayerInfo: function(p) {
			var color, rgb;

			if (p === 0) {
				color = mmap.readByte(MEM_LOCATIONS.COLUP0);
				rgb = COLOR_PALETTE[(color & 0xf0) >>> 4][(color & 0x0f) >>> 1];

				return {
					color:    color,
					rgb:      'rgb(' + rgb[0] + ',' + rgb[1] + ',' + rgb[2] + ')',
					graphics: newGRP0,
					reflect:  !!(mmap.readByte(MEM_LOCATIONS.REFP0) & 0x08),
					delay:    !!(mmap.readByte(MEM_LOCATIONS.VDELP0) & 0x01),
					nusiz:    mmap.readByte(MEM_LOCATIONS.NUSIZ0) & 0x07,
					position: p0Pos,
					hmove:    mmap.readByte(MEM_LOCATIONS.HMP0) >>> 4
				};
			}

			if (p === 1) {
				color = mmap.readByte(MEM_LOCATIONS.COLUP1);
				rgb = COLOR_PALETTE[(color & 0xf0) >>> 4][(color & 0x0f) >>> 1];

				return {
					color:    mmap.readByte(MEM_LOCATIONS.COLUP1),
					rgb:      'rgb(' + rgb[0] + ',' + rgb[1] + ',' + rgb[2] + ')',
					graphics: newGRP1,
					reflect:  !!(mmap.readByte(MEM_LOCATIONS.REFP1) & 0x08),
					delay:    !!(mmap.readByte(MEM_LOCATIONS.VDELP1) & 0x01),
					nusiz:    mmap.readByte(MEM_LOCATIONS.NUSIZ1) & 0x07,
					position: p1Pos,
					hmove:    mmap.readByte(MEM_LOCATIONS.HMP1) >>> 4
				};
			}
		},

		getPlayfieldInfo: function() {
			var ctrlpf = mmap.readByte(MEM_LOCATIONS.CTRLPF),
				color = mmap.readByte(MEM_LOCATIONS.COLUPF),
				rgb = COLOR_PALETTE[(color & 0xf0) >>> 4][(color & 0x0f) >>> 1];

			return {
				pf0:      mmap.readByte(MEM_LOCATIONS.PF0) >>> 4,
				pf1:      mmap.readByte(MEM_LOCATIONS.PF1),
				pf2:      mmap.readByte(MEM_LOCATIONS.PF2),
				reflect:  !!(ctrlpf & 0x01),
				score:    !!(ctrlpf & 0x02),
				priority: !!(ctrlpf & 0x04),
				color:    color,
				rgb:      'rgb(' + rgb[0] + ',' + rgb[1] + ',' + rgb[2] + ')'
			};
		},

		getBallInfo: function() {
			return {
				enabled:  !!(mmap.readByte(MEM_LOCATIONS.ENABL) & 0x02),
				position: blPos,
				hmove:    mmap.readByte(MEM_LOCATIONS.HMBL) >>> 4,
				size:     (mmap.readByte(MEM_LOCATIONS.CTRLPF) >>> 4) & 0x03,
				delay:    !!(mmap.readByte(MEM_LOCATIONS.VDELBL) & 0X01)
			};
		},

		getMissleInfo: function(p) {
			if (p === 0) {
				return {
					enabled:  !!(mmap.readByte(MEM_LOCATIONS.ENAM0) & 0x02),
					position: m0Pos,
					hmove:    mmap.readByte(MEM_LOCATIONS.HMM0) >>> 4,
					size:     (mmap.readByte(MEM_LOCATIONS.NUSIZ0) >>> 4) & 0x03,
					reset:    !!(mmap.readByte(MEM_LOCATIONS.RESMP0) & 0x02)
				};
			} else {
				return {
					enabled:  !!(mmap.readByte(MEM_LOCATIONS.ENAM1) & 0x02),
					position: m1Pos,
					hmove:    mmap.readByte(MEM_LOCATIONS.HMM1) >>> 4,
					size:     (mmap.readByte(MEM_LOCATIONS.NUSIZ1) >>> 4) & 0x03,
					reset:    !!(mmap.readByte(MEM_LOCATIONS.RESMP1) & 0x02)
				};
			}
		},

		getCollisionInfo: function() {
			var cxm0p  = mmap.readByte(MEM_LOCATIONS.CXM0P),
				cxm1p  = mmap.readByte(MEM_LOCATIONS.CXM1P),
				cxp0fb = mmap.readByte(MEM_LOCATIONS.CXP0FB),
				cxp1fb = mmap.readByte(MEM_LOCATIONS.CXP1FB),
				cxm0fb = mmap.readByte(MEM_LOCATIONS.CXM0FB),
				cxm1fb = mmap.readByte(MEM_LOCATIONS.CXM1FB),
				cxblpf = mmap.readByte(MEM_LOCATIONS.CXBLPF),
				cxppmm = mmap.readByte(MEM_LOCATIONS.CXPPMM);

			return {
				'p0-pf': !!(cxp0fb & 0x80),
				'p0-bl': !!(cxp0fb & 0x40),
				'p0-m1': !!(cxm1p & 0x80),
				'p0-m0': !!(cxm0p & 0x40),
				'p0-p1': !!(cxppmm & 0x80),
				'p1-pf': !!(cxp1fb & 0x80),
				'p1-bl': !!(cxp1fb & 0x40),
				'p1-m1': !!(cxm1p & 0x40),
				'p1-m0': !!(cxm0p & 0x80),
				'm0-pf': !!(cxm0fb & 0x80),
				'm0-bl': !!(cxm0fb & 0x40),
				'm0-m1': !!(cxppmm & 0x40),
				'm1-pf': !!(cxm1fb & 0x80),
				'm1-bl': !!(cxm1fb & 0x40),
				'bl-pf': !!(cxblpf & 0x80)
			};
		}

	};

})();