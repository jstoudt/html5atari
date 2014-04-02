/*global Utility:false,CPU6507:false,RIOT:false,MemoryMap:false*/

/**
 * tia.js -- Television Interface Adaptor
 * Author: Jason T. Stoudt
 * Date: 28 March 2012
 *
 * A javascript representation of the Television Interface Adaptor found in
 * the Atari 2600.
 */


function TIA( canvas ) {
	var self = this,
		MEM_LOCATIONS = Utility.MEM_LOCATIONS,
		VOID = Utility.VOID;

	// the memory map to be shared between TIA & CPU
	this.mmap = new MemoryMap();

	// the cpu to which this TIA is connnected
	this.cpu = new CPU6507( this.mmap );

	// the RIOT component to which this TIA is connected
	this.riot = new RIOT( this.mmap );

	// the 2D context of the canvas element for video output
	this.canvasContext = canvas.getContext( '2d' );

	// create a pixel buffer to hold the raw data
	this.pixelBuffer = this.canvasContext.createImageData(
		parseInt( canvas.width, 10 ),
		parseInt( canvas.height, 10 )
	);

	// the number of frames written to the canvas
	this.numFrames = 0;

	this.tiaCycles = 0;

	this.started = false;

	// a value that cycles between 0, 1 and 2 -- 6507 is cycled on 2
	this.tiaClock = false;

	// the position of the beam on the x-axis from -68 to 159
	this.x = -68;

	// the position of the beam on the y-axis
	this.y = 0;

	// when this is true, the CPU does not cycle
	this.RDY = false;

	// when set, a signal is being sent to reset the beam to the top of the frame
	this.VSYNC = false;

	this.vsyncCount = 0;

	this.yStart = 34;

	// horizontal positions for moveable game graphics
	this.p0Pos = 0;
	this.p1Pos = 0;
	this.m0Pos = 0;
	this.m1Pos = 0;
	this.blPos = 0;

	this.p0Clock = 0;
	this.p1Clock = 0;
	this.m0Clock = 0;
	this.m1Clock = 0;
	this.blClock = 0;

	this.PF0 = 0;
	this.PF1 = 0;
	this.PF2 = 0;

	this.p0Start = false;
	this.p1Start = false;
	this.m0Start = false;
	this.m1Start = false;

	// internal registers for the GRPx values
	this.oldGRP0 = 0;
	this.newGRP0 = 0;
	this.oldGRP1 = 0;
	this.newGRP1 = 0;

	// internal registers for the NUSIZx values
	this.NUSIZ0       = 0;
	this.NUSIZ1       = 0;
	this.MISSLE_SIZE0 = 1;
	this.MISSLE_SIZE1 = 1;

	// internal registers for the ENAMx values
	this.ENAM0 = false;
	this.ENAM1 = false;

	// internal registers for the ENABL value
	this.newENABL = false;
	this.oldENABL = false;

	// internal registers corresponding to the CTRLPF register
	this.BALL_SIZE = 1;
	this.REFLECT   = false;
	this.SCORE     = false;
	this.PRIORITY  = false;

	// internal color registers
	this.COLUBK = 0;
	this.COLUPF = 0;
	this.COLUP0 = 0;
	this.COLUP1 = 0;

	this.COLUBKrgb = [ 0, 0, 0 ];
	this.COLUPFrgb = [ 0, 0, 0 ];
	this.COLUP0rgb = [ 0, 0, 0 ];
	this.COLUP1rgb = [ 0, 0, 0 ];

	// internal registers for the player reflection values
	this.REFP0 = false;
	this.REFP1 = false;

	// internal registers for the graphics vertical delays
	this.VDELP0 = false;
	this.VDELP1 = false;
	this.VDELBL = false;

	// internal registers for the HMOVE values
	this.HMP0 = 0x00;
	this.HMP1 = 0x00;
	this.HMM0 = 0x00;
	this.HMM1 = 0x00;
	this.HMBL = 0x00;

	// internal registers for reset missle to player values
	this.RESMP0 = false;
	this.RESMP1 = false;

	// internal collision registers
	this.M0_P0 = false;
	this.M0_P1 = false;
	this.M1_P1 = false;
	this.M1_P0 = false;
	this.P0_BL = false;
	this.P0_PF = false;
	this.P1_BL = false;
	this.P1_PF = false;
	this.M0_BL = false;
	this.M0_PF = false;
	this.M1_BL = false;
	this.M1_PF = false;
	this.BL_PF = false;
	this.M0_M1 = false;
	this.P0_P1 = false;

	// internal registers for INPUT values
	this.INPT0 = true;
	this.INPT1 = true;
	this.INPT2 = true;
	this.INPT3 = true;
	this.INPT4 = true;
	this.INPT5 = true;

	// internal registers for the AUDIO values
	this.AUDC0 = 0;
	this.AUDF0 = 0;
	this.AUDV0 = 0;
	this.AUDC1 = 0;
	this.AUDF1 = 0;
	this.AUDV1 = 0;

	// start drawing static frames on the canvas
	window.requestAnimationFrame( function() {
		self.drawStaticFrame();
	});

	this.mmap.addReadWrite(MEM_LOCATIONS.VSYNC, this.readCXM0P, function( val ) {
		self.VSYNC = !!( val & 0x02 );
	});

	this.mmap.addReadWrite(MEM_LOCATIONS.VBLANK, this.readCXM1P, function( val ) {
		self.VBLANK = !!( val & 0x02 );
		if ( self.VBLANK === false ) {
			self.yStart = self.y;
		}
	});

	this.mmap.addReadWrite(MEM_LOCATIONS.WSYNC, this.readCXP0FB, function() {
		self.RDY = true;
	});

	this.mmap.addReadWrite(MEM_LOCATIONS.RSYNC, this.readCXP1FB, VOID);

	this.mmap.addReadWrite(MEM_LOCATIONS.NUSIZ0, this.readCXM0FB, function( val ) {
		self.NUSIZ0       = val & 0x07;
		self.MISSLE_SIZE0 = 0x01 << ((val >>> 4) & 0x03);
	});

	this.mmap.addReadWrite(MEM_LOCATIONS.NUSIZ1, this.readCXM1FB, function( val ) {
		self.NUSIZ1       = val & 0x07;
		self.MISSLE_SIZE1 = 0x01 << ((val >>> 4) & 0x03);
	});

	this.mmap.addReadWrite(MEM_LOCATIONS.COLUP0, this.readCXBLPF, function( val ) {
		self.COLUP0    = val;
		self.COLUP0rgb = TIA.COLOR_PALETTE[(val & 0xf0) >>> 4][(val & 0x0f) >>> 1];
	});

	this.mmap.addReadWrite(MEM_LOCATIONS.COLUP1, this.readCXPPMM, function( val ) {
		self.COLUP1    = val;
		self.COLUP1rgb = TIA.COLOR_PALETTE[(val & 0xf0) >>> 4][(val & 0x0f) >>> 1];
	});

	this.mmap.addReadWrite(MEM_LOCATIONS.COLUPF, this.readINPT0, function( val ) {
		self.COLUPF    = val;
		self.COLUPFrgb = TIA.COLOR_PALETTE[(val & 0xf0) >>> 4][(val & 0x0f) >>> 1];
	});

	this.mmap.addReadWrite(MEM_LOCATIONS.COLUBK, this.readINPT1, function( val ) {
		self.COLUBK    = val;
		self.COLUBKrgb = TIA.COLOR_PALETTE[(val & 0xf0) >>> 4][(val & 0x0f) >>> 1];
	});

	this.mmap.addReadWrite(MEM_LOCATIONS.CTRLPF, this.readINPT2, function( val ) {
		self.BALL_SIZE = 0x01 << ((val >>> 4) & 0x03);
		self.REFLECT   = !!(val & 0x01);
		self.SCORE     = !!(val & 0x02);
		self.PRIORITY  = !!(val & 0x04);
	});

	this.mmap.addReadWrite(MEM_LOCATIONS.REFP0, this.readINPT3, function( val ) {
		self.REFP0 = !!(val & 0x08);
	});

	this.mmap.addReadWrite(MEM_LOCATIONS.REFP1, this.readINPT4, function( val ) {
		self.REFP1 = !!(val & 0x08);
	});

	this.mmap.addReadWrite(MEM_LOCATIONS.PF0, this.readINPT5, function( val ) {
		self.PF0 = val >>> 4;
	});

	this.mmap.addReadWrite(MEM_LOCATIONS.PF1, VOID, function( val ) {
		self.PF1 = val;
	});

	this.mmap.addReadWrite(MEM_LOCATIONS.PF2, VOID, function( val ) {
		self.PF2 = val;
	});

	this.mmap.addReadWrite(MEM_LOCATIONS.RESP0, this.readCXM0P, function( val ) {
		self.p0Pos = self.x + 8;
		if ( self.p0Pos < 0 ) {
			self.p0Pos = 2;
		} else if ( self.p0Pos >= 160 ) {
			self.p0Pos -= 160;
		}
		self.p0Start = false;
	});

	this.mmap.addReadWrite(MEM_LOCATIONS.RESP1, this.readCXM1P, function( val ) {
		self.p1Pos = self.x + 8;
		if ( self.p1Pos < 0 ) {
			self.p1Pos = 2;
		} else if ( self.p1Pos >= 160 ) {
			self.p1Pos -= 160;
		}
		self.p1Start = false;
	});

	this.mmap.addReadWrite(MEM_LOCATIONS.RESM0, this.readCXP0FB, function( val ) {
		self.m0Pos = self.x + 7;
		if ( self.m0Pos < 0 ) {
			self.m0Pos = 2;
		} else if ( self.m0Pos >= 160 ) {
			self.m0Pos -= 160;
		}
		self.m0Start = false;
	});

	this.mmap.addReadWrite(MEM_LOCATIONS.RESM1, this.readCXP1FB, function( val ) {
		self.m1Pos = self.x + 7;
		if ( self.m1Pos < 0 ) {
			self.m1Pos = 2;
		} else if ( self.m1Pos >= 160 ) {
			self.m1Pos -= 160;
		}
		self.m1Start = false;
	});

	this.mmap.addReadWrite(MEM_LOCATIONS.RESBL, this.readCXM0FB, function( val ) {
		self.blPos = self.x + 7;
		if ( self.blPos < 0 ) {
			blPos = 2;
		} else if ( self.blPos >= 160 ) {
			blPos -= 160;
		}
	});

	this.mmap.addReadWrite(MEM_LOCATIONS.AUDC0, this.readCXM1FB, function( val ) {
		self.AUDC0 = val & 0x0f;
	});

	this.mmap.addReadWrite(MEM_LOCATIONS.AUDC1, this.readCXBLPF, function( val ) {
		self.AUDC1 = val & 0x0f;
	});

	this.mmap.addReadWrite(MEM_LOCATIONS.AUDF0, this.readCXPPMM, function( val ) {
		self.AUDF0 = val & 0x1f;
	});

	this.mmap.addReadWrite(MEM_LOCATIONS.AUDF1, this.readINPT0, function( val ) {
		self.AUDF1 = val & 0x1f;
	});

	this.mmap.addReadWrite(MEM_LOCATIONS.AUDV0, this.readINPT1, function( val ) {
		self.AUDV0 = val & 0x0f;
	});

	this.mmap.addReadWrite(MEM_LOCATIONS.AUDV1, this.readINPT2, function( val ) {
		self.AUDV1 = val & 0x0f;
	});

	this.mmap.addReadWrite(MEM_LOCATIONS.GRP0, this.readINPT3, function( val ) {
		self.newGRP0 = val;
		self.oldGRP1 = self.newGRP1;
	});

	this.mmap.addReadWrite(MEM_LOCATIONS.GRP1, this.readINPT4, function( val ) {
		self.newGRP1  = val;
		self.oldGRP0  = self.newGRP0;
		self.oldENABL = self.newENABL;
	});

	this.mmap.addReadWrite(MEM_LOCATIONS.ENAM0, this.readINPT5, function( val ) {
		self.ENAM0 = !!(val & 0x02);
	});

	this.mmap.addReadWrite(MEM_LOCATIONS.ENAM1, VOID, function( val ) {
		self.ENAM1 = !!(val & 0x02);
	});

	this.mmap.addReadWrite(MEM_LOCATIONS.ENABL, VOID, function( val ) {
		self.newENABL = !!(val & 0x02);
	});

	this.mmap.addReadWrite(MEM_LOCATIONS.HMP0, this.readCXM0P, function( val ) {
		self.HMP0 = val >>> 4;
	});

	this.mmap.addReadWrite(MEM_LOCATIONS.HMP1, this.readCXM1P, function( val ) {
		self.HMP1 = val >>> 4;
	});

	this.mmap.addReadWrite(MEM_LOCATIONS.HMM0, this.readCXP0FB, function( val ) {
		self.HMM0 = val >>> 4;
	});

	this.mmap.addReadWrite(MEM_LOCATIONS.HMM1, this.readCXP1FB, function( val ) {
		self.HMM1 = val >>> 4;
	});

	this.mmap.addReadWrite(MEM_LOCATIONS.HMBL, this.readCXM0FB, function( val ) {
		self.HMBL = val >>> 4;
	});

	this.mmap.addReadWrite(MEM_LOCATIONS.VDELP0, this.readCXM1FB, function( val ) {
		self.VDELP0 = !!(val & 0x01);
	});

	this.mmap.addReadWrite(MEM_LOCATIONS.VDELP1, this.readCXBLPF, function( val ) {
		self.VDELP1 = !!(val & 0x01);
	});

	this.mmap.addReadWrite(MEM_LOCATIONS.VDELBL, this.readCXPPMM, function( val ) {
		self.VDELBL = !!(val & 0x01);
	});

	this.mmap.addReadWrite(MEM_LOCATIONS.RESMP0, this.readINPT0, function( val ) {
		self.RESMP0 = !!(val & 0x02);
	});

	this.mmap.addReadWrite(MEM_LOCATIONS.RESMP1, this.readINPT1, function( val ) {
		self.RESMP1 = !!(val & 0x02);
	});

	this.mmap.addReadWrite(MEM_LOCATIONS.HMOVE, this.readINPT2, function() {
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

		self.p0Pos = hmove(self.p0Pos, self.HMP0);
		self.p1Pos = hmove(self.p1Pos, self.HMP1);
		self.m0Pos = hmove(self.m0Pos, self.HMM0);
		self.m1Pos = hmove(self.m1Pos, self.HMM1);
		self.blPos = hmove(self.blPos, self.HMBL);
	});

	this.mmap.addReadWrite(MEM_LOCATIONS.HMCLR, this.readINPT3, function() {
		self.HMP0 = 0;
		self.HMP1 = 0;
		self.HMM0 = 0;
		self.HMM1 = 0;
		self.HMBL = 0;
	});

	this.mmap.addReadWrite(MEM_LOCATIONS.CXCLR, this.readINPT4, function( val ) {
		self.M0_P0 = false;
		self.M0_P1 = false;
		self.M1_P1 = false;
		self.M1_P0 = false;
		self.P0_BL = false;
		self.P0_PF = false;
		self.P1_BL = false;
		self.P1_PF = false;
		self.M0_BL = false;
		self.M0_PF = false;
		self.M1_BL = false;
		self.M1_PF = false;
		self.BL_PF = false;
		self.M0_M1 = false;
		self.P0_P1 = false;
	});

	this.mmap.addReadWrite(0x2d, this.readINPT5, VOID);
	this.mmap.addReadWrite(0x2e, VOID, VOID);
	this.mmap.addReadWrite(0x2f, VOID, VOID);
	this.mmap.addReadWrite(0x30, this.readCXM0P, VOID);
	this.mmap.addReadWrite(0x31, this.readCXM1P, VOID);
	this.mmap.addReadWrite(0x32, this.readCXP0FB, VOID);
	this.mmap.addReadWrite(0x33, this.readCXP1FB, VOID);
	this.mmap.addReadWrite(0x34, this.readCXM0FB, VOID);
	this.mmap.addReadWrite(0x35, this.readCXM1FB, VOID);
	this.mmap.addReadWrite(0x36, this.readCXBLPF, VOID);
	this.mmap.addReadWrite(0x37, this.readCXPPMM, VOID);
	this.mmap.addReadWrite(0x38, this.readINPT0, VOID);
	this.mmap.addReadWrite(0x39, this.readINPT1, VOID);
	this.mmap.addReadWrite(0x3a, this.readINPT2, VOID);
	this.mmap.addReadWrite(0x3b, this.readINPT3, VOID);
	this.mmap.addReadWrite(0x3c, this.readINPT4, VOID);
	this.mmap.addReadWrite(0x3d, this.readINPT5, VOID);
	this.mmap.addReadWrite(0x3e, VOID, VOID);
	this.mmap.addReadWrite(0x3f, VOID, VOID);

	// Add mirrored memory addresses to Memory Map
	this.mmap.addMirror(0x40, 0x7f, 0x40);
	for (i = 0x100; i <= 0xf00; i += 0x100) {
		this.mmap.addMirror(i, i + 0x3f, i);
		this.mmap.addMirror(i + 0x40, i + 0x7f, i + 0x40);
	}
	for (i = 0x2000; i <= 0xef00; i += 0x100) {
		this.mmap.addMirror(i, i + 0x3f, i);
		this.mmap.addMirror(i + 0x40, i + 0x7f, i + 0x40);
	}
}

// the Atari 2600 NTSC color palette
TIA.COLOR_PALETTE = [
	[    // 0x0
		[0x00,0x00,0x00],[0x40,0x40,0x40],[0x6c,0x6c,0x6c],[0x90,0x90,0x90],
		[0xb0,0xb0,0xb0],[0xc8,0xc8,0xc8],[0xdc,0xdc,0xdc],[0xec,0xec,0xec]
	], [ // 0x1
		[0x44,0x44,0x00],[0x64,0x64,0x10],[0x84,0x84,0x24],[0xa0,0xa0,0x34],
		[0xb8,0xb8,0x40],[0xd0,0xd0,0x50],[0xe8,0xe8,0x5c],[0xfc,0xfc,0x68]
	], [ // 0x2
		[0x70,0x28,0x00],[0x84,0x44,0x14],[0x98,0x5c,0x28],[0xac,0x78,0x3c],
		[0xbc,0x8c,0x4c],[0xcc,0xa0,0x5c],[0xdc,0xb4,0x68],[0xec,0xc8,0x78]
	], [ // 0x3
		[0x84,0x18,0x00],[0x98,0x34,0x18],[0xac,0x50,0x30],[0xc0,0x68,0x48],
		[0xd0,0x80,0x5c],[0xe0,0x94,0x70],[0xec,0xa8,0x80],[0xfc,0xbc,0x94]
	], [ // 0x4
		[0x88,0x00,0x00],[0x9c,0x20,0x20],[0xb0,0x3c,0x3c],[0xc0,0x58,0x58],
		[0xd0,0x70,0x70],[0xe0,0x88,0x88],[0xec,0xa0,0xa0],[0xfc,0xb4,0xb4]
	], [ // 0x5
		[0x78,0x00,0x5c],[0x8c,0x20,0x74],[0xa0,0x3c,0x88],[0xb0,0x58,0x9c],
		[0xc0,0x70,0xb0],[0xd0,0x84,0xc0],[0xdc,0x9c,0xd0],[0xec,0xb0,0xe0]
	], [ // 0x6
		[0x48,0x00,0x78],[0x60,0x20,0x90],[0x78,0x3c,0xa4],[0x8c,0x58,0xb8],
		[0xa0,0x70,0xcc],[0xb4,0x84,0xdc],[0xc4,0x9c,0xec],[0xd4,0xb0,0xfc]
	], [ // 0x7
		[0x14,0x00,0x84],[0x30,0x20,0x98],[0x4c,0x3c,0xac],[0x68,0x58,0xc0],
		[0x7c,0x70,0xd0],[0x94,0x88,0xe0],[0xa8,0xa0,0xec],[0xbc,0xb4,0xfc]
	], [ // 0x8
		[0x00,0x00,0x88],[0x1c,0x20,0x9c],[0x38,0x40,0xb0],[0x50,0x5c,0xc0],
		[0x68,0x74,0xd0],[0x7c,0x8c,0xe0],[0x90,0xa4,0xec],[0xa4,0xb8,0xfc]
	], [ // 0x9
		[0x00,0x18,0x7c],[0x1c,0x38,0x90],[0x38,0x54,0xa8],[0x50,0x70,0xbc],
		[0x68,0x88,0xcc],[0x7c,0x9c,0xdc],[0x90,0xb4,0xec],[0xa4,0xc8,0xfc]
	], [ // 0xA
		[0x00,0x2c,0x5c],[0x1c,0x4c,0x78],[0x38,0x68,0x90],[0x50,0x84,0xac],
		[0x68,0x9c,0xc0],[0x7c,0xb4,0xd4],[0x90,0xcc,0xe8],[0xa4,0xe0,0xfc]
	], [ // 0xB
		[0x00,0x3c,0x2c],[0x1c,0x5c,0x48],[0x38,0x7c,0x64],[0x50,0x9c,0x80],
		[0x68,0xb4,0x94],[0x7c,0xd0,0xac],[0x90,0xe4,0xc0],[0xa4,0xfc,0xd4]
	], [ // 0xC
		[0x00,0x3c,0x00],[0x20,0x5c,0x20],[0x40,0x7c,0x40],[0x5c,0x9c,0x5c],
		[0x74,0xb4,0x74],[0x8c,0xd0,0x8c],[0xa4,0xe4,0xa4],[0xb8,0xfc,0xb8]
	], [ // 0xD
		[0x14,0x38,0x00],[0x34,0x5c,0x1c],[0x50,0x7c,0x38],[0x6c,0x98,0x50],
		[0x84,0xb4,0x68],[0x9c,0xcc,0x7c],[0xb4,0xe4,0x90],[0xc8,0xfc,0xa4]
	], [ // 0xE
		[0x2c,0x30,0x00],[0x4c,0x50,0x1c],[0x68,0x70,0x34],[0x84,0x8c,0x4c],
		[0x9c,0xa8,0x64],[0xb4,0xc0,0x78],[0xcc,0xd4,0x88],[0xe0,0xec,0x9c]
	], [ // 0xF
		[0x44,0x28,0x00],[0x64,0x48,0x18],[0x84,0x68,0x30],[0xa0,0x84,0x44],
		[0xb8,0x9c,0x58],[0xd0,0xb4,0x6c],[0xe8,0xcc,0x7c],[0xfc,0xe0,0x8c]
	]
];

TIA.prototype.readCXM0P = function() {
	var val = this.M0_P0 === true ? 0x40 : 0x00;
	if ( this.M0_P1 === true ) {
		val |= 0x80;
	}
	return val;
};

TIA.prototype.readCXM1P = function() {
	var val = this.M1_P1 === true ? 0x40 : 0x00;
	if ( this.M1_P0 === true ) {
		val |= 0x80;
	}
	return val;
};

TIA.prototype.readCXP0FB = function() {
	var val = this.P0_BL === true ? 0x40 : 0x00;
	if ( this.P0_PF === true ) {
		val |= 0x80;
	}
	return val;
};

TIA.prototype.readCXP1FB = function() {
	var val = this.P1_BL === true ? 0x40 : 0x00;
	if ( this.P1_PF === true ) {
		val |= 0x80;
	}
	return val;
};

TIA.prototype.readCXM0FB = function() {
	var val = this.M0_BL === true ? 0x40 : 0x00;
	if ( this.M0_PF === true ) {
		val |= 0x80;
	}
	return val;
};

TIA.prototype.readCXM1FB = function() {
	var val = this.M1_BL === true ? 0x40 : 0x00;
	if ( this.M1_PF === true ) {
		val |= 0x80;
	}
	return val;
};

TIA.prototype.readCXBLPF = function() {
	return this.BL_PF === true ? 0x80 : 0x00;
};

TIA.prototype.readCXPPMM = function() {
	var val = this.M0_M1 === true ? 0x40 : 0x00;
	if ( this.P0_P1 === true ) {
		val |= 0x80;
	}
	return val;
};

TIA.prototype.readINPT0 = function() {
	return this.INPT0 === true ? 0x80 : 0x00;
};

TIA.prototype.readINPT1 = function() {
	return this.INPT1 === true ? 0x80 : 0x00;
};

TIA.prototype.readINPT2 = function() {
	return this.INPT2 === true ? 0x80 : 0x00;
};

TIA.prototype.readINPT3 = function() {
	return this.INPT3 === true ? 0x80 : 0x00;
};

TIA.prototype.readINPT4 = function() {
	return this.INPT4 === true ? 0x80 : 0x00;
};

TIA.prototype.readINPT5 = function() {
	return this.INPT5 === true ? 0x80 : 0x00;
};

TIA.prototype.clearPixelBuffer = function() {
	var i = 0,
		buf = this.pixelBuffer.data,
		l = buf.length;

	while ( i < l ) {
		buf[i]     = 0;
		buf[i + 1] = 0;
		buf[i + 2] = 0;
		buf[i + 3] = 0;

		i += 4;
	}
};

TIA.prototype.drawStaticFrame = function() {
	var i    = 0,
		data = this.pixelBuffer.data,
		l  = data.length,
		self = this,
		color;

	for ( ; i < l; i += 4 ) {
		color = Math.floor( Math.random() * 0xff );

		data[i]     = color; // red channel
		data[i + 1] = color; // green channel
		data[i + 2] = color; // blue channel
		data[i + 3] = 255;   // alpha channel (always opaque)
	}

	this.canvasContext.putImageData( this.pixelBuffer, 0, 0 );

	this.numFrames++;

	this.rafId = window.requestAnimationFrame( function() {
		self.drawStaticFrame();
	});
};

TIA.prototype.isPlayfieldAt = function( x ) {
	if ( x >= 20 ) {
		x = this.REFLECT === true ? 39 - x : x - 20;
	}

	return !!( x >= 12 ? this.PF2 & ( 1 << ( x - 12 ) ) :
		x >= 4 ? this.PF1 & (0x80 >>> (x - 4)) :
		this.PF0 & (0x01 << x));
};

TIA.prototype.procPlayerClock = function( p ) {
	var draw = false,
		x = this.x,
		i, clock, start, nusiz, ref, gr;

	if ( p === 0 ) {
		if ( x === this.p0Pos ) {
			this.p0Clock = 0;
		}
		clock = this.p0Clock;
		start = this.p0Start;
		nusiz = this.NUSIZ0;
		ref   = this.REFP0;
		gr    = this.VDELP0 === true ? this.oldGRP0 : this.newGRP0;
	} else {
		if ( x === this.p1Start ) {
			this.p1Clock = 0;
		}
		clock = this.p1Clock;
		start = this.p1Start;
		nusiz = this.NUSIZ1;
		ref   = this.REFP1;
		gr    = this.VDELP1 === true ? this.oldGRP1 : this.newGRP1;
	}

	if ( clock === 0 && nusiz === 0x05 ) {
		if ( p === 0 && this.RESMP0 === true ) {
			this.m0Pos = x;
		} else if ( p === 1 && this.RESMP1 === true ) {
			this.m1Pos = x;
		}
	} else if ( clock === 12 && nusiz === 0x07 ) {
		if ( p === 0 && this.RESMP0 === true ) {
			this.m0Pos = x;
		} else if ( p === 1 && this.RESMP1 === true ) {
			this.m1Pos = x;
		}
	} else if ( clock === 4 ) {
		if ( p === 0 && this.RESMP0 === true ) {
			this.m0Pos = x;
		} else if ( p === 1 && this.RESMP1 === true ) {
			this.m1Pos = x;
		}
	}

	if ( start === false ) {
		if (( clock === 156 ) ||
			( clock === 12 && ( nusiz === 0x01 || nusiz === 0x03 )) ||
			( clock === 28 && ( nusiz === 0x02 || nusiz === 0x03 || nusiz === 0x06 )) ||
			( clock === 60 && ( nusiz === 0x04 || nusiz === 0x06 ))) {
			if ( p === 0 ) {
				this.p0Start = true;
			} else {
				this.p1Start = true;
			}
		}
	} else if ( gr !== 0x00 ) {
		if ( nusiz === 0x05 && clock >= 0 && clock < 16 ) {
			i = clock >>> 1;
			draw = gr & ( ref === true ? ( 0x01 << i ) : ( 0x80 >>> i ));
		} else if ( nusiz === 0x07 && clock >= 0 && clock < 32 ) {
			i = clock >>> 2;
			draw = gr & ( ref === true ? ( 0x01 << i ) : ( 0x80 >>> i ));
		} else if ( clock >= 0 && clock < 8 ) {
			draw = gr & ( ref === true ? ( 0x01 << clock ) : ( 0x80 >>> clock));
		} else if ( clock >= 16 && clock < 24 ) {
			if ( nusiz === 0x01 || nusiz === 0x03 ) {
				i = clock - 16;
				draw = gr & ( ref === true ? ( 0x01 << i ) : ( 0x80 >>> i ));
			}
		} else if ( clock >= 32 && clock < 40 ) {
			if ( nusiz === 0x02 || nusiz === 0x03 || nusiz === 0x06 ) {
				i = clock - 32;
				draw = gr & ( ref === true ? ( 0x01 << i ) : ( 0x80 >>> i ));
			}
		} else if ( clock >= 64 && clock < 72 ) {
			if (nusiz === 0x04 || nusiz === 0x06 ) {
				i = clock - 64;
				draw = gr & ( ref === true ? ( 0x01 << i ) : (0x80 >>> i ));
			}
		}
	}

	if ( p === 0 ) {
		this.p0Clock++;
	} else {
		this.p1Clock++;
	}

	return !!draw;
};

TIA.prototype.procMissleClock = function( p ) {
	var draw = false,
		x = this.x,
		enabled, start, clock, nusiz, size;

	if ( p === 0 ) {
		if ( this.m0Pos === x ) {
			this.m0Clock = 0;
		}
		clock   = this.m0Clock;
		start   = this.m0Start;
		enabled = !!( this.ENAM0 === true && this.RESMP0 === false );
		nusiz   = this.NUSIZ0;
		size    = this.MISSLE_SIZE0;
	} else {
		if ( this.m1Pos === x ) {
			this.m1Clock = 0;
		}
		clock = this.m1Clock;
		start = this.m1Start;
		enabled = !!( this.ENAM1 === true && this.RESMP1 === false );
		nusiz = this.NUSIZ1;
		size = this.MISSLE_SIZE1;
	}

	if ( start === false ) {
		if (( clock === 12 && ( nusiz === 0x01 || nusiz === 0x03 )) ||
			( clock === 28 && ( nusiz === 0x02 || nusiz === 0x03 || nusiz === 0x06 )) ||
			( clock === 60 && ( nusiz === 0x04 || nusiz === 0x06 )) ||
			( clock === 156 )) {
			if ( p === 0 ) {
				this.m0Start = true;
			} else {
				this.m1Start = true;
			}
		}
	} else if ( enabled === true ) {
		if ( clock >= 0 && clock < 8 ) {
			draw = clock < size;
		}
		else if ( clock >= 16 && clock < 24 ) {
			if ( nusiz === 0x01 || nusiz === 0x03 ) {
				draw = ( clock - 16 ) < size;
			}
		} else if ( clock >= 32 && clock < 40 ) {
			if ( nusiz === 0x02 || nusiz === 0x03 || nusiz === 0x06 ) {
				draw = ( clock - 32 ) < size;
			}
		} else if ( clock >= 64 && clock < 72 ) {
			if ( nusiz === 0x04 || nusiz === 0x06 ) {
				draw = ( clock - 64 ) < size;
			}
		}
	}

	if ( p === 0 ) {
		this.m0Clock++;
	} else {
		this.m1Clock++;
	}

	return !!draw;
};

TIA.prototype.procBallClock = function() {
	var draw = false,
		enabled = this.VDELBL === true ? this.oldENABL : this.newENABL;

	if ( this.blPos === this.x ) {
		this.blClock = 0;
	}

	if ( enabled === true && this.blClock < this.BALL_SIZE ) {
		draw = true;
	}

	this.blClock++;

	return draw;
};

TIA.prototype.writePixel = function( y ) {
	var i = this.pixelBufferIndex,
		data = this.pixelBuffer.data,
		pf = this.isPlayfieldAt( this.x >>> 2 ),
		p0 = this.procPlayerClock( 0 ),
		p1 = this.procPlayerClock( 1 ),
		m0 = this.procMissleClock( 0 ),
		m1 = this.procMissleClock( 1 ),
		bl = this.procBallClock(),
		color;

	if ( this.PRIORITY === true ) {
		if ( pf === true || bl === true ) {
			color = this.SCORE === false ? this.COLUPFrgb :
				this.x < 80 ? this.COLUP0rgb :
				this.COLUP1rgb;
		} else if ( p0 === true || m0 === true ) {
			color = this.COLUP0rgb;
		} else if ( p1 === true || m1 === true ) {
			color = this.COLUP1rgb;
		} else {
			color = this.COLUBKrgb;
		}
	} else {
		if ( p0 === true || m0 === true ) {
			color = this.COLUP0rgb;
		} else if ( p1 === true || m1 === true ) {
			color = this.COLUP1rgb;
		} else if ( pf === true || bl === true ) {
			color = this.SCORE === false ? this.COLUPFrgb :
				this.x < 80 ? this.COLUP0rgb :
				this.COLUP1rgb;
		} else {
			color = this.COLUBKrgb;
		}
	}

	data[i]     = color[0]; // red
	data[i + 1] = color[1]; // green
	data[i + 2] = color[2]; // blue
	data[i + 3] = 255;      // alpha

	// move the pixelBuffer index to the next pixel in the buffer
	this.pixelBufferIndex += 4;

	// now determine if there were collisions and set the correct registers
	if ( m0 === true ) {
		if ( p0 === true ) {
			this.M0_P0 = true;
		}
		if ( p1 === true ) {
			this.M0_P1 = true;
		}
		if ( pf === true ) {
			this.M0_PF = true;
		}
		if ( bl === true ) {
			this.M0_BL = true;
		}
		if ( m1 === true ) {
			this.M0_M1 = true;
		}
	}

	if ( m1 === true ) {
		if ( p0 === true ) {
			this.M1_P0 = true;
		}
		if ( p1 === true ) {
			this.M1_P1 = true;
		}
		if ( pf === true ) {
			this.M1_PF = true;
		}
		if ( bl === true ) {
			this.M1_BL = true;
		}
	}

	if ( p0 === true ) {
		if ( pf === true ) {
			this.P0_PF = true;
		}
		if ( bl === true ) {
			this.P0_BL = true;
		}
		if ( p1 === true ) {
			this.P0_P1 = true;
		}
	}

	if ( p1 === true ) {
		if ( pf === true ) {
			this.P1_PF = true;
		}
		if ( bl === true ) {
			this.P1_BL = true;
		}
	}

	if ( bl === true && pf === true ) {
		this.BL_PF = true;
	}

};

TIA.prototype.execClockCycle = function() {
	// if we are on a clock cycle divisible by 3 and RDY latch is
	// not set, cycle the 6507
	if ( this.tiaClock === 0 ) {
		if ( this.RDY === false ) {
			// if an instruction has been commited, check memory for
			// changes to TIA registers
			if ( this.cpu.cycle() === true ) {
				return true;
			}
		}

		// process a RIOT cycle
		this.riot.cycle();
	}

	// if we are not in VBLANK or HBLANK write the pixel to the
	// canvas at the current color clock
	if ( this.VBLANK === false && this.x >= 0 ) {
		this.writePixel ( this.y - this.yStart );
	}

	this.tiaCycles++;

	// increment the color clock to draw the pixel at the next position
	this.x++;

	// increment/cycle the TIA clock
	this.tiaClock = this.tiaClock === 0 ? 1 :
		this.tiaClock === 1 ? 2 : 0;

	// the beam is automatically reset back to HBLANK when
	// we get to the right edge of the frame
	if ( this.x > 159 ) {
		this.x = -68;

		// reset the RDY flag so the CPU can begin cycling again
		this.RDY = false;

		// start drawing on the next scanline
		this.y++;

		if ( this.VSYNC === true ) {
			this.vsyncCount++;
		}
	}

	// return true if this cycle contained a CPU execution completion
	return false;
};

TIA.prototype.runMainLoop = function() {
	// run the code until VSYNC is enabled, then reset the VSYNC
	// counters and scanline, draw the frame and request another
	// execution of this function
	while( 1 ) {
		this.execClockCycle();
		if ( this.vsyncCount > 0 && this.VSYNC === false ) {
			this.vsyncCount = 0;
			this.y = 0;
			this.pixelBufferIndex = 0;
			this.rafId = window.requestAnimationFrame( this.runMainLoop );
			this.canvasContext.putImageData( this.pixelBuffer, 0, 0 );
			this.numFrames++;
			this.clearPixelBuffer();
			break;
		}
	}
};

TIA.prototype.start = function() {
	window.cancelAnimationFrame( this.rafId );

	// reset the frame counter
	this.numFrames = 0;

	this.tiaCycles = 0;

	// schedule the start of the main loop
	this.runMainLoop();

	// set the flag to tell the external modules that the system has started
	this.started = true;
};

TIA.prototype.stop = function() {
	window.cancelAnimationFrame( this.rafId );

	this.started = false;
};

/*
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
*/
