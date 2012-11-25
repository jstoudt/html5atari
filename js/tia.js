/*global Utility:false, CPU6507:false,RIOT:false*/

/**
 * tia.js -- Television Interface Adaptor
 * Author: Jason T. Stoudt
 * Date: 28 March 2012
 *
 * A javascript representation of the Television Interface Adaptor found in
 * the Atari 2600.
 */

var TIA = (function(MEM_LOCATIONS, undefined) {

		// the memory map to be shared between TIA & CPU
	var mmap = null,

		riot,

		// the array of pixel colors representing the video output
		pixelBuffer,

		// the current pointer to write to within the pixel buffer array
		pixelBufferIndex,

		// the 2D context of the canvas element for video output
		canvasContext,

		handlers = {
			start: [],
			stop: []
		},

		rafId = null,

		// the number of frames written to the canvas
		numFrames = 0,

		tiaCycles = 0,

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

		yStart = 34,

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

		PF0 = 0x00,
		PF1 = 0x00,
		PF2 = 0x00,

		p0Start = false,
		p1Start = false,
		m0Start = false,
		m1Start = false,

		// internal registers for the GRPx values
		oldGRP0 = 0x00,
		newGRP0 = 0x00,
		oldGRP1 = 0x00,
		newGRP1 = 0x00,

		// internal registers for the NUSIZx values
		NUSIZ0       = 0x00,
		NUSIZ1       = 0x00,
		MISSLE_SIZE0 = 1,
		MISSLE_SIZE1 = 1,

		// internal registers for the ENAMx values
		ENAM0 = false,
		ENAM1 = false,

		// internal registers for the ENABL value
		newENABL = false,
		oldENABL = false,

		// internal registers corresponding to the CTRLPF register
		BALL_SIZE = 1,
		REFLECT   = false,
		SCORE     = false,
		PRIORITY  = false,

		// internal color registers
		COLUBK = 0x00,
		COLUPF = 0x00,
		COLUP0 = 0x00,
		COLUP1 = 0x00,

		COLUBKrgb = [ 0, 0, 0 ],
		COLUPFrgb = [ 0, 0, 0 ],
		COLUP0rgb = [ 0, 0, 0 ],
		COLUP1rgb = [ 0, 0, 0 ],

		// internal registers for the player reflection values
		REFP0 = false,
		REFP1 = false,

		// internal registers for the graphics vertical delays
		VDELP0 = false,
		VDELP1 = false,
		VDELBL = false,

		// internal registers for the HMOVE values
		HMP0 = 0x00,
		HMP1 = 0x00,
		HMM0 = 0x00,
		HMM1 = 0x00,
		HMBL = 0x00,

		// internal registers for reset missle to player values
		RESMP0 = false,
		RESMP1 = false,

		// internal collision registers
		M0_P0 = false,
		M0_P1 = false,
		M1_P1 = false,
		M1_P0 = false,
		P0_BL = false,
		P0_PF = false,
		P1_BL = false,
		P1_PF = false,
		M0_BL = false,
		M0_PF = false,
		M1_BL = false,
		M1_PF = false,
		BL_PF = false,
		M0_M1 = false,
		P0_P1 = false,

		// internal registers for INPUT values
		INPT0 = true,
		INPT1 = true,
		INPT2 = true,
		INPT3 = true,
		INPT4 = true,
		INPT5 = true,

		// internal registers for the AUDIO values
		AUDC0 = 0x00,
		AUDF0 = 0x00,
		AUDV0 = 0x00,
		AUDC1 = 0x00,
		AUDF1 = 0x00,
		AUDV1 = 0x00,

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

		readCXM0P = function() {
			var val = M0_P0 === true ? 0x40 : 0x00;
			if (M0_P1 === true) {
				val |= 0x80;
			}
			return val;
		},

		readCXM1P = function() {
			var val = M1_P1 === true ? 0x40 : 0x00;
			if (M1_P0 === true) {
				val |= 0x80;
			}
			return val;
		},

		readCXP0FB = function() {
			var val = P0_BL === true ? 0x40 : 0x00;
			if (P0_PF === true) {
				val |= 0x80;
			}
			return val;
		},

		readCXP1FB = function() {
			var val = P1_BL === true ? 0x40 : 0x00;
			if (P1_PF === true) {
				val |= 0x80;
			}
			return val;
		},

		readCXM0FB = function() {
			var val = M0_BL === true ? 0x40 : 0x00;
			if (M0_PF === true) {
				val |= 0x80;
			}
			return val;
		},

		readCXM1FB = function() {
			var val = M1_BL === true ? 0x40 : 0x00;
			if (M1_PF === true) {
				val |= 0x80;
			}
			return val;
		},

		readCXBLPF = function() {
			return BL_PF === true ? 0x80 : 0x00;
		},

		readCXPPMM = function() {
			var val = M0_M1 === true ? 0x40 : 0x00;
			if (P0_P1 === true) {
				val |= 0x80;
			}
			return val;
		},

		readINPT0 = function() {
			return INPT0 === true ? 0x80 : 0x00;
		},

		readINPT1 = function() {
			return INPT1 === true ? 0x80 : 0x00;
		},

		readINPT2 = function() {
			return INPT2 === true ? 0x80 : 0x00;
		},

		readINPT3 = function() {
			return INPT3 === true ? 0x80 : 0x00;
		},

		readINPT4 = function() {
			return INPT4 === true ? 0x80 : 0x00;
		},

		readINPT5 = function() {
			return INPT5 === true ? 0x80 : 0x00;
		},

		initMemoryMap = function() {
			var VOID = Utility.VOID,
				i;

			// create a new memory map object
			mmap = new MemoryMap();

			mmap.addReadWrite(MEM_LOCATIONS.VSYNC, readCXM0P, function( val ) {
				VSYNC = !!(val & 0x02);
			});

			mmap.addReadWrite(MEM_LOCATIONS.VBLANK, readCXM1P, function( val ) {
				VBLANK = !!(val & 0x02);
				if (VBLANK === false) {
					yStart = y;
				}
			});

			mmap.addReadWrite(MEM_LOCATIONS.WSYNC, readCXP0FB, function() {
				RDY = true;
			});

			mmap.addReadWrite(MEM_LOCATIONS.RSYNC, readCXP1FB, VOID);

			mmap.addReadWrite(MEM_LOCATIONS.NUSIZ0, readCXM0FB, function( val ) {
				NUSIZ0       = val & 0x07;
				MISSLE_SIZE0 = 0x01 << ((val >>> 4) & 0x03);
			});

			mmap.addReadWrite(MEM_LOCATIONS.NUSIZ1, readCXM1FB, function( val ) {
				NUSIZ1       = val & 0x07;
				MISSLE_SIZE1 = 0x01 << ((val >>> 4) & 0x03);
			});

			mmap.addReadWrite(MEM_LOCATIONS.COLUP0, readCXBLPF, function( val ) {
				COLUP0    = val;
				COLUP0rgb = COLOR_PALETTE[(val & 0xf0) >>> 4][(val & 0x0f) >>> 1];
			});

			mmap.addReadWrite(MEM_LOCATIONS.COLUP1, readCXPPMM, function( val ) {
				COLUP1    = val;
				COLUP1rgb = COLOR_PALETTE[(val & 0xf0) >>> 4][(val & 0x0f) >>> 1];
			});

			mmap.addReadWrite(MEM_LOCATIONS.COLUPF, readINPT0, function( val ) {
				COLUPF    = val;
				COLUPFrgb = COLOR_PALETTE[(val & 0xf0) >>> 4][(val & 0x0f) >>> 1];
			});

			mmap.addReadWrite(MEM_LOCATIONS.COLUBK, readINPT1, function( val ) {
				COLUBK    = val;
				COLUBKrgb = COLOR_PALETTE[(val & 0xf0) >>> 4][(val & 0x0f) >>> 1];
			});

			mmap.addReadWrite(MEM_LOCATIONS.CTRLPF, readINPT2, function( val ) {
				BALL_SIZE = 0x01 << ((val >>> 4) & 0x03);
				REFLECT   = !!(val & 0x01);
				SCORE     = !!(val & 0x02);
				PRIORITY  = !!(val & 0x04);
			});

			mmap.addReadWrite(MEM_LOCATIONS.REFP0, readINPT3, function( val ) {
				REFP0 = !!(val & 0x08);
			});

			mmap.addReadWrite(MEM_LOCATIONS.REFP1, readINPT4, function( val ) {
				REFP1 = !!(val & 0x08);
			});

			mmap.addReadWrite(MEM_LOCATIONS.PF0, readINPT5, function( val ) {
				PF0 = val >>> 4;
			});

			mmap.addReadWrite(MEM_LOCATIONS.PF1, VOID, function( val ) {
				PF1 = val;
			});

			mmap.addReadWrite(MEM_LOCATIONS.PF2, VOID, function( val ) {
				PF2 = val;
			});

			mmap.addReadWrite(MEM_LOCATIONS.RESP0, readCXM0P, function( val ) {
				p0Pos = x + 8;
				if (p0Pos < 0) {
					p0Pos = 2;
				} else if (p0Pos >= 160) {
					p0Pos -= 160;
				}
				p0Start = false;
			});

			mmap.addReadWrite(MEM_LOCATIONS.RESP1, readCXM1P, function( val ) {
				p1Pos = x + 8;
				if (p1Pos < 0) {
					p1Pos = 2;
				} else if (p1Pos >= 160) {
					p1Pos -= 160;
				}
				p1Start = false;
			});

			mmap.addReadWrite(MEM_LOCATIONS.RESM0, readCXP0FB, function( val ) {
				m0Pos = x + 7;
				if (m0Pos < 0) {
					m0Pos = 2;
				} else if (m0Pos >= 160) {
					m0Pos -= 160;
				}
				m0Start = false;
			});

			mmap.addReadWrite(MEM_LOCATIONS.RESM1, readCXP1FB, function( val ) {
				m1Pos = x + 7;
				if (m1Pos < 0) {
					m1Pos = 2;
				} else if (m1Pos >= 160) {
					m1Pos -= 160;
				}
				m1Start = false;
			});

			mmap.addReadWrite(MEM_LOCATIONS.RESBL, readCXM0FB, function( val ) {
				blPos = x + 7;
				if (blPos < 0) {
					blPos = 2;
				} else if (blPos >= 160) {
					blPos -= 160;
				}
			});

			mmap.addReadWrite(MEM_LOCATIONS.AUDC0, readCXM1FB, function( val ) {
				AUDC0 = val & 0x0f;
			});

			mmap.addReadWrite(MEM_LOCATIONS.AUDC1, readCXBLPF, function( val ) {
				AUDC1 = val & 0x0f;
			});

			mmap.addReadWrite(MEM_LOCATIONS.AUDF0, readCXPPMM, function( val ) {
				AUDF0 = val & 0x1f;
			});

			mmap.addReadWrite(MEM_LOCATIONS.AUDF1, readINPT0, function( val ) {
				AUDF1 = val & 0x1f;
			});

			mmap.addReadWrite(MEM_LOCATIONS.AUDV0, readINPT1, function( val ) {
				AUDV0 = val & 0x0f;
			});

			mmap.addReadWrite(MEM_LOCATIONS.AUDV1, readINPT2, function( val ) {
				AUDV1 = val & 0x0f;
			});

			mmap.addReadWrite(MEM_LOCATIONS.GRP0, readINPT3, function( val ) {
				newGRP0 = val;
				oldGRP1 = newGRP1;
			});

			mmap.addReadWrite(MEM_LOCATIONS.GRP1, readINPT4, function( val ) {
				newGRP1  = val;
				oldGRP0  = newGRP0;
				oldENABL = newENABL;
			});

			mmap.addReadWrite(MEM_LOCATIONS.ENAM0, readINPT5, function( val ) {
				ENAM0 = !!(val & 0x02);
			});

			mmap.addReadWrite(MEM_LOCATIONS.ENAM1, VOID, function( val ) {
				ENAM1 = !!(val & 0x02);
			});

			mmap.addReadWrite(MEM_LOCATIONS.ENABL, VOID, function( val ) {
				newENABL = !!(val & 0x02);
			});

			mmap.addReadWrite(MEM_LOCATIONS.HMP0, readCXM0P, function( val ) {
				HMP0 = val >>> 4;
			});

			mmap.addReadWrite(MEM_LOCATIONS.HMP1, readCXM1P, function( val ) {
				HMP1 = val >>> 4;
			});

			mmap.addReadWrite(MEM_LOCATIONS.HMM0, readCXP0FB, function( val ) {
				HMM0 = val >>> 4;
			});

			mmap.addReadWrite(MEM_LOCATIONS.HMM1, readCXP1FB, function( val ) {
				HMM1 = val >>> 4;
			});

			mmap.addReadWrite(MEM_LOCATIONS.HMBL, readCXM0FB, function( val ) {
				HMBL = val >>> 4;
			});

			mmap.addReadWrite(MEM_LOCATIONS.VDELP0, readCXM1FB, function( val ) {
				VDELP0 = !!(val & 0x01);
			});

			mmap.addReadWrite(MEM_LOCATIONS.VDELP1, readCXBLPF, function( val ) {
				VDELP1 = !!(val & 0x01);
			});

			mmap.addReadWrite(MEM_LOCATIONS.VDELBL, readCXPPMM, function( val ) {
				VDELBL = !!(val & 0x01);
			});

			mmap.addReadWrite(MEM_LOCATIONS.RESMP0, readINPT0, function( val ) {
				RESMP0 = !!(val & 0x02);
			});

			mmap.addReadWrite(MEM_LOCATIONS.RESMP1, readINPT1, function( val ) {
				RESMP1 = !!(val & 0x02);
			});

			mmap.addReadWrite(MEM_LOCATIONS.HMOVE, readINPT2, function() {
				function hmove(x, d) {
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
							x += 160;
						}
					}

					return x;
				}

				p0Pos = hmove(p0Pos, HMP0);
				p1Pos = hmove(p1Pos, HMP1);
				m0Pos = hmove(m0Pos, HMM0);
				m1Pos = hmove(m1Pos, HMM1);
				blPos = hmove(blPos, HMBL);
			});

			mmap.addReadWrite(MEM_LOCATIONS.HMCLR, readINPT3, function() {
				HMP0 = HMP1 = HMM0 = HMM1 = HMBL = 0;
			});

			mmap.addReadWrite(MEM_LOCATIONS.CXCLR, readINPT4, function( val ) {
				M0_P0 = false;
				M0_P1 = false;
				M1_P1 = false;
				M1_P0 = false;
				P0_BL = false;
				P0_PF = false;
				P1_BL = false;
				P1_PF = false;
				M0_BL = false;
				M0_PF = false;
				M1_BL = false;
				M1_PF = false;
				BL_PF = false;
				M0_M1 = false;
				P0_P1 = false;
			});

			mmap.addReadWrite(0x2d, readINPT5, VOID);
			mmap.addReadWrite(0x2e, VOID, VOID);
			mmap.addReadWrite(0x2f, VOID, VOID);
			mmap.addReadWrite(0x30, readCXM0P, VOID);
			mmap.addReadWrite(0x31, readCXM1P, VOID);
			mmap.addReadWrite(0x32, readCXP0FB, VOID);
			mmap.addReadWrite(0x33, readCXP1FB, VOID);
			mmap.addReadWrite(0x34, readCXM0FB, VOID);
			mmap.addReadWrite(0x35, readCXM1FB, VOID);
			mmap.addReadWrite(0x36, readCXBLPF, VOID);
			mmap.addReadWrite(0x37, readCXPPMM, VOID);
			mmap.addReadWrite(0x38, readINPT0, VOID);
			mmap.addReadWrite(0x39, readINPT1, VOID);
			mmap.addReadWrite(0x3a, readINPT2, VOID);
			mmap.addReadWrite(0x3b, readINPT3, VOID);
			mmap.addReadWrite(0x3c, readINPT4, VOID);
			mmap.addReadWrite(0x3d, readINPT5, VOID);
			mmap.addReadWrite(0x3e, VOID, VOID);
			mmap.addReadWrite(0x3f, VOID, VOID);

			// Add mirrored memory addresses to Memory Map
			mmap.addMirror(0x40, 0x7f, 0x40);
			for (i = 0x100; i <= 0xf00; i += 0x100) {
				mmap.addMirror(i, i + 0x3f, i);
				mmap.addMirror(i + 0x40, i + 0x7f, i + 0x40);
			}
			for (i = 0x2000; i <= 0xef00; i += 0x100) {
				mmap.addMirror(i, i + 0x3f, i);
				mmap.addMirror(i + 0x40, i + 0x7f, i + 0x40);
			}
		},

		clearPixelBuffer = function() {
			var i = 0,
				buf = pixelBuffer.data,
				l = buf.length;

			while (i < l) {
				buf[i]     = 0;
				buf[i + 1] = 0;
				buf[i + 2] = 0;
				buf[i + 3] = 255;

				i += 4;
			}
		},

		drawStaticFrame = function() {
			var i = 0,
				data  = pixelBuffer.data,
				len   = data.length,
				color;

			for ( ; i < len; i += 4 ) {
				color = Math.floor( Math.random() * 0xff );

				data[i]     = color; // red channel
				data[i + 1] = color; // green channel
				data[i + 2] = color; // blue channel
				data[i + 3] = 255;   // alpha channel (always opaque)
			}

			canvasContext.putImageData( pixelBuffer, 0, 0 );

			numFrames++;

			rafId = window.requestAnimationFrame( drawStaticFrame );
		},

		isPlayfieldAt = function( x ) {
			if ( x >= 20 ) {
				x = REFLECT === true ? 39 - x : x - 20;
			}

			return !!( x >= 12 ? PF2 & ( 1 << ( x - 12 ) ) :
				x >= 4 ? PF1 & (0x80 >>> (x - 4)) :
				PF0 & (0x01 << x));
		},

		procPlayerClock = function( p ) {
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
				nusiz = NUSIZ0;
				ref   = REFP0;
				gr    = VDELP0 === true ? oldGRP0 : newGRP0;
			} else {
				if (x === p1Pos) {
					p1Clock = 0;
				}
				clock = p1Clock;
				start = p1Start;
				nusiz = NUSIZ1;
				ref   = REFP1;
				gr    = VDELP1 === true ? oldGRP1 : newGRP1;
			}

			if (clock === 8 && nusiz === 0x05) {
				if (p === 0 && RESMP0 === true) {
					m0Pos = x;
				} else if (p === 1 && RESMP1 === true) {
					m1Pos = x;
				}
			} else if (clock === 12 && nusiz === 0x07) {
				if (p === 0 && RESMP0 === true) {
					m0Pos = x;
				} else if (p === 1 && RESMP1 === true) {
					m1Pos = x;
				}
			} else if (clock === 4) {
				if (p === 0 && RESMP0 === true) {
					m0Pos = x;
				} else if (p === 1 && RESMP1 === true) {
					m1Pos = x;
				}
			}

			if (start === false) {
				if ((clock === 156) ||
					(clock === 12 && (nusiz === 0x01 || nusiz === 0x03)) ||
					(clock === 28 && (nusiz === 0x02 || nusiz === 0x03 || nusiz === 0x06)) ||
					(clock === 60 && (nusiz === 0x04 || nusiz === 0x06))) {
					startClock();
				}
			} else if (gr !== 0x00) {
				if (nusiz === 0x05 && clock >= 0 && clock < 16) {
					i = clock >>> 1;
					draw = gr & (ref === true ? (0x01 << i) : (0x80 >>> i));
				} else if (nusiz === 0x07 && clock >= 0 && clock < 32) {
					i = clock >>> 2;
					draw = gr & (ref === true ? (0x01 << i) : (0x80 >>> i));
				} else if (clock >= 0 && clock < 8) {
					draw = gr & (ref === true ? (0x01 << clock) : (0x80 >>> clock));
				} else if (clock >= 16 && clock < 24) {
					if (nusiz === 0x01 || nusiz === 0x03) {
						i = clock - 16;
						draw = gr & (ref === true ? (0x01 << i) : (0x80 >>> i));
					}
				} else if (clock >= 32 && clock < 40) {
					if (nusiz === 0x02 || nusiz === 0x03 || nusiz === 0x06) {
						i = clock - 32;
						draw = gr & (ref === true ? (0x01 << i) : (0x80 >>> i));
					}
				} else if (clock >= 64 && clock < 72) {
					if (nusiz === 0x04 || nusiz === 0x06) {
						i = clock - 64;
						draw = gr & (ref === true ? (0x01 << i) : (0x80 >>> i));
					}
				}
			}

			// increment the clock
			if (p === 0) {
				p0Clock++;
			} else {
				p1Clock++;
			}

			return !!draw;
		},

		procMissleClock = function( p ) {

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
				clock   = m0Clock;
				start   = m0Start;
				enabled = (ENAM0 === true && RESMP0 === false) ? true : false;
				nusiz   = NUSIZ0;
				size    = MISSLE_SIZE0;
			} else {
				if (m1Pos === x) {
					m1Clock = 0;
				}
				clock   = m1Clock;
				start   = m1Start;
				enabled = (ENAM1 === true && RESMP1 === false) ? true : false;
				nusiz   = NUSIZ1;
				size    = MISSLE_SIZE1;
			}

			if (start === false) {
				if ((clock === 12 && (nusiz === 0x01 || nusiz === 0x03)) ||
					(clock === 28 && (nusiz === 0x02 || nusiz === 0x03 || nusiz === 0x06)) ||
					(clock === 60 && (nusiz === 0x04 || nusiz === 0x06)) ||
					(clock === 156)) {
					startClock();
				}
			} else if (enabled === true) {
				if (clock >= 0 && clock < 8) {
					draw = clock < size;
				}
				else if (clock >= 16 && clock < 24) {
					if (nusiz === 0x01 || nusiz === 0x03) {
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
			var enabled = VDELBL === true ? oldENABL : newENABL,
				draw = false;

			if (blPos === x) {
				blClock = 0;
			}

			if (enabled === true && blClock < BALL_SIZE) {
				draw = true;
			}

			blClock++;

			return draw;
		},

		writePixel = function( y ) {
			// determine what color the pixel at the present coordinates should be
			var i    = pixelBufferIndex,
				data = pixelBuffer.data,
				pf   = isPlayfieldAt(x >>> 2),
				p0   = procPlayerClock(0),
				p1   = procPlayerClock(1),
				m0   = procMissleClock(0),
				m1   = procMissleClock(1),
				bl   = procBallClock(),
				color;

			if (PRIORITY === true) {
				if (pf === true || bl === true) {
					color = SCORE === false ? COLUPFrgb :
						x < 80 ? COLUP0rgb :
						COLUP1rgb;
				} else if (p0 === true || m0 === true) {
					color = COLUP0rgb;
				} else if (p1 === true || m1 === true) {
					color = COLUP1rgb;
				} else {
					color = COLUBKrgb;
				}
			} else {
				if (p0 === true || m0 === true) {
					color = COLUP0rgb;
				} else if (p1 === true || m1 === true) {
					color = COLUP1rgb;
				} else if (pf === true || bl === true) {
					color = SCORE === false ? COLUPFrgb :
						x < 80 ? COLUP0rgb :
						COLUP1rgb;
				} else {
					color = COLUBKrgb;
				}
			}

			data[i]     = color[0]; // red
			data[i + 1] = color[1]; // green
			data[i + 2] = color[2]; // blue
			data[i + 3] = 255;      // alpha

			pixelBufferIndex += 4;

			// now determine if there were collisions and set the
			// correct registers
			if (m0 === true) {
				if (p0 === true) {
					M0_P0 = true;
				}
				if (p1 === true) {
					M0_P1 = true;
				}
				if (pf === true) {
					M0_PF = true;
				}
				if (bl === true) {
					M0_BL = true;
				}
				if (m1 === true) {
					M0_M1 = true;
				}
			}

			if (m1 === true) {
				if (p0 === true) {
					M1_P0 = true;
				}
				if (p1 === true) {
					M1_P1 = true;
				}
				if (pf === true) {
					M1_PF = true;
				}
				if (bl === true) {
					M1_BL = true;
				}
			}

			if (p0 === true) {
				if (pf === true) {
					P0_PF = true;
				}
				if (bl === true) {
					P0_BL = true;
				}
				if (p1 === true) {
					P0_P1 = true;
				}
			}

			if (p1 === true) {
				if (pf === true) {
					P1_PF = true;
				}
				if (bl === true) {
					P1_BL = true;
				}
			}

			if (bl === true && pf === true) {
				BL_PF = true;
			}
		},

		execClockCycle = function() {
			// if we are on a clock cycle divisible by 3 and RDY latch is
			// not set, cycle the 6507
			if (tiaClock === 0) {
				if (RDY === false) {
					// if an instruction has been commited, check memory for
					// changes to TIA registers
					if (CPU6507.cycle() === true) {
						return true;
					}
				}

				// process a RIOT cycle
				RIOT.cycle();
			}

			// if we are not in VBLANK or HBLANK write the pixel to the
			// canvas at the current color clock
			if (VBLANK === false && x >= 0) {
				writePixel(y - yStart);
			}

			tiaCycles++;

			// increment the color clock to draw the pixel at the next position
			x++;

			// increment/cycle the TIA clock
			tiaClock = tiaClock === 0 ? 1 :
				tiaClock === 1 ? 2 : 0;

			// the beam is automatically reset back to HBLANK when
			// we get to the right edge of the frame
			if (x > 159) {
				x = -68;

				// reset the RDY flag so the CPU can begin cycling again
				RDY = false;

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
				if (vsyncCount > 0 && VSYNC === false) {
					vsyncCount = 0;
					y = 0;
					pixelBufferIndex = 0;
					rafId = window.requestAnimationFrame( runMainLoop );
					canvasContext.putImageData(pixelBuffer, 0, 0);
					numFrames++;
					clearPixelBuffer();
					break;
				}
			}
		};


	return {

		init: function( canvas ) {

			var canvasWidth  = parseInt( canvas.width, 10 ),
				canvasHeight = parseInt( canvas.height, 10 );

			// store a reference to the canvas's context
			canvasContext = canvas.getContext( '2d' );

			// create a pixel buffer to hold the raw data
			pixelBuffer = canvasContext.createImageData( canvasWidth,
				canvasHeight );

			// reset the started flag
			started = false;

			// cancel any frame drawing taking place
			window.cancelAnimationFrame( rafId );

			// start drawing static frames on the canvas
			rafId = window.requestAnimationFrame( drawStaticFrame );

			// Initialize the memory map
			initMemoryMap();

			// pass the memory map on to the CPU
			CPU6507.init( mmap );

			// initialize and pass the memory map to the RIOT
			riot = new RIOT( mmap );
//			RIOT.init( mmap );

			// initialize the TIA clock
			tiaClock = 0;

			// initialize the frame counter
			numFrames = 0;

			tiaCycles = 0;

			// initialize the electron beam position
			x = -68;
			y = 0;

			// reset VBLANK, RDY and VSYNC internal registers
			RDY    = false;
			VSYNC  = false;
			VBLANK = false;

			yStart = 34;
		},

		start: function() {
			var i = 0,
				l = handlers.start.length;

			window.cancelAnimationFrame( rafId );

			// loop through and execute each of the handlers that have been
			// binded to the start event
			for (; i < l; i++) {
				handlers.start[ i ]();
			}

			// reset the frame counter
			numFrames = 0;

			tiaCycles = 0;

			// schecule the start of the main loop
			rafId = window.requestAnimationFrame( runMainLoop );

			// set the flag to tell the external modules that the system
			// has started
			started = true;
		},

		isStarted: function() {
			return started;
		},

		step: function() {
			while(1) {
				var proc = execClockCycle();
				if (vsyncCount > 0 && VSYNC === false) {
					vsyncCount = 0;
					y = 0;
					pixelBufferIndex = 0;
					numFrames++;
				}
				if (proc === true) {
					window.cancelAnimationFrame( rafId );
					canvasContext.putImageData(pixelBuffer, 0, 0);
					break;
				}
			}
		},

		stop: function() {
			var i = 0,
				l = handlers.stop.length;

			window.cancelAnimationFrame( rafId );

			started = false;

			// run any handlers that were bound to the stop event
			for (; i < l; i++) {
				handlers.stop[i]();
			}
		},

		addEventListener: function( type, handler ) {
			if (typeof handler !== 'function') {
				throw new Error('Parameter handler must be of type function.');
			}

			if (type in handlers) {
				handlers[type].push(handler);
			} else {
				throw new Error('Event type is invalid.');
			}
		},

		getNumFrames: function() {
			return numFrames;
		},

		getCycleCount: function() {
			return tiaCycles;
		},

		getBeamPosition: function() {
			return {
				x: x,
				y: y
			};
		},

		getPlayerInfo: function( p ) {
			if (p === 0) {
				return {
					color:       COLUP0,
					rgb:         COLUP0rgb,
					graphics:    newGRP0,
					oldGraphics: oldGRP0,
					reflect:     REFP0,
					delay:       VDELP0,
					nusiz:       NUSIZ0,
					position:    p0Pos,
					hmove:       HMP0
				};
			} else {
				return {
					color:       COLUP1,
					rgb:         COLUP1rgb,
					graphics:    newGRP1,
					oldGraphics: oldGRP1,
					reflect:     REFP1,
					delay:       VDELP1,
					nusiz:       NUSIZ1,
					position:    p1Pos,
					hmove:       HMP1
				};
			}
		},

		getPlayfieldInfo: function() {
			return {
				pf0:      PF0,
				pf1:      PF1,
				pf2:      PF2,
				reflect:  REFLECT,
				score:    SCORE,
				priority: PRIORITY,
				color:    COLUPF,
				rgb:      COLUPFrgb
			};
		},

		getBallInfo: function() {
			return {
				enabled:  newENABL,
				position: blPos,
				hmove:    HMBL,
				size:     BALL_SIZE,
				delay:    VDELBL
			};
		},

		getMissleInfo: function( p ) {
			if (p === 0) {
				return {
					enabled:  ENAM0,
					position: m0Pos,
					hmove:    HMM0,
					size:     MISSLE_SIZE0,
					reset:    RESMP0
				};
			} else {
				return {
					enabled:  ENAM1,
					position: m1Pos,
					hmove:    HMM1,
					size:     MISSLE_SIZE1,
					reset:    RESMP1
				};
			}
		},

		getCollisionInfo: function() {
			return {
				'p0-pf': P0_PF,
				'p0-bl': P0_BL,
				'p0-m1': M1_P0,
				'p0-m0': M0_P0,
				'p0-p1': P0_P1,
				'p1-pf': P1_PF,
				'p1-bl': P1_BL,
				'p1-m1': M1_P1,
				'p1-m0': M0_P1,
				'm0-pf': M0_PF,
				'm0-bl': M0_BL,
				'm0-m1': M0_M1,
				'm1-pf': M1_PF,
				'm1-bl': M1_BL,
				'bl-pf': BL_PF
			};
		},

		getInputInfo: function( p ) {
			return [ INPT0, INPT1, INPT2, INPT3, INPT4, INPT5 ];
		},

		setInputValue: function( input, val ) {
			switch (input) {
				case 0:
					INPT0 = val;
					break;
				case 1:
					INPT1 = val;
					break;
				case 2:
					INPT2 = val;
					break;
				case 3:
					INPT3 = val;
					break;
				case 4:
					INPT4 = val;
					break;
				case 5:
					INPT5 = val;
					break;
			}
		}

	};

})(Utility.MEM_LOCATIONS);
