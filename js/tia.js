/**
 * "tia.js -- Television Interface Adaptor
 * Author: Jason T. Stoudt
 * Date: 28 March 2012
 *
 * A javascript representation of the Television Interface Adaptor found in
 * the Atari 2600.
 */

var TIA = (function() {

	var mmap,          // the memory map to be shared between TIA & CPU

		pixelBuffer,   // the array of pixel colors representing the video output

		canvasElement, // a reference to the canvas element for video output

		canvasContext, // the context of the canvas element for video output

		handlers = {
			start: [],
			stop: []
		},

		reqAnimFrame = window.requestAnimationFrame ||
			window.webkitRequestAnimationFrame ||
			window.mozRequestAnimationFrame,

		tiaCycles, // the number of cycles executed by the TIA

		numFrames, // the number of frames written to the canvas

		breakFlag, // set to stop the TIA execution loop

		TARGET_CYCLE_RATE = 3579.545, // frequency of the TIA clock in kHz

		// the dimensions of the output video buffer -- NTSC only for now
		VIDEO_BUFFER_WIDTH  = 160,
		VIDEO_BUFFER_HEIGHT = 192,

		// locations of TIA registers on the system bus
		MEM_LOCATIONS = {
			VSYNC:  0x00,		VBLANK: 0x01,
			WSYNC:  0x02,		RSYNC:  0x03,
			NUSIZ0: 0x04,		NUSIZ1: 0x05,
			COLUP0: 0x06,		COLUP1: 0x07,
			COLUPF: 0x08,		COLUBK: 0x09,
			CTRLPF: 0x0a,		REFP0:  0x0b,
			REFP1:  0x0c,		PF0:    0x0d,
			PF1:    0x0e,		PF2:    0x0f
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
			], [ // 10
				[0x00,0x2c,0x5c],[0x1c,0x4c,0x78],[0x38,0x68,0x90],[0x50,0x84,0xac],
				[0x68,0x9c,0xc0],[0x7c,0xb4,0xd4],[0x90,0xcc,0xe8],[0xa4,0xe0,0xfc]
			], [ // 11
				[0x00,0x3c,0x2c],[0x1c,0x5c,0x48],[0x38,0x7c,0x64],[0x50,0x9c,0x80],
				[0x68,0xb4,0x94],[0x7c,0xd0,0xac],[0x90,0xe4,0xc0],[0xa4,0xfc,0xd4]
			], [ // 12
				[0x00,0x3c,0x00],[0x20,0x5c,0x20],[0x40,0x7c,0x40],[0x5c,0x9c,0x5c],
				[0x74,0xb4,0x74],[0x8c,0xd0,0x8c],[0xa4,0xe4,0xa4],[0xb8,0xfc,0xb8]
			], [ // 13
				[0x14,0x38,0x00],[0x34,0x5c,0x1c],[0x50,0x7c,0x38],[0x6c,0x98,0x50],
				[0x84,0xb4,0x68],[0x9c,0xcc,0x7c],[0xb4,0xe4,0x90],[0xc8,0xfc,0xa4]
			], [ // 14
				[0x2c,0x30,0x00],[0x4c,0x50,0x1c],[0x68,0x70,0x34],[0x84,0x8c,0x4c],
				[0x9c,0xa8,0x64],[0xb4,0xc0,0x78],[0xcc,0xd4,0x88],[0xe0,0xec,0x9c]
			], [ // 15
				[0x44,0x28,0x00],[0x64,0x48,0x18],[0x84,0x68,0x30],[0xa0,0x84,0x44],
				[0xb8,0x9c,0x58],[0xd0,0xb4,0x6c],[0xe8,0xcc,0x7c],[0xfc,0xe0,0x8c]
			]
		],

		isPlayfieldAt = function(x) {
			if (x >= 20) {
				x = (mmap.readByte(MEM_LOCATIONS.CTRLPF) & 0x01) ? 40 - x : x - 20;
			}

			return x >= 12 ? mmap.readByte(MEM_LOCATIONS.PF2) & (1 << (x - 12)) :
				x >= 4 ? mmap.readByte(MEM_LOCATIONS.PF1) & (0x80 >> (x - 4)) :
				(mmap.readByte(MEM_LOCATIONS.PF0) >>> 4) & (1 << x);
		},

		writePixel = function(x, y) {
			// determine what color the pixel at the present coordinates should be
			var index = (y * VIDEO_BUFFER_WIDTH + x) << 2,
				color = mmap.readByte(isPlayfieldAt(x >>> 2) ?
					MEM_LOCATIONS.COLUPF : MEM_LOCATIONS.COLUBK);

			color = COLOR_PALETTE[(color & 0xf0) >>> 4][(color & 0x0f) >>> 1];
			pixelBuffer.data[index]     = color[0]; // red
			pixelBuffer.data[index + 1] = color[1]; // green
			pixelBuffer.data[index + 2] = color[2]; // blue
			pixelBuffer.data[index + 3] = 255;      // alpha
		},

		drawCanvas = function() {
			// draw the current pixel buffer to the canvas
			canvasContext.putImageData(pixelBuffer, 0, 0);

			// increment the number of frames drawn
			numFrames++;
		},

		// the position of the beam on the x-axis from -68 to 160
		x,

		// the position of the beam on the y-axis
		y,

		// when this is true, the CPU does not cycle
		RDY,

		// the beam is turned off when this flag is set
		VBLANK,

		// when set, a signal is being sent to reset the beam to the top of the frame
		VSYNC,

		execClockCycle = function() {
			var proc;

			// the beam is automatically reset back to HBLANK when
			// we get to the right edge of the frame
			if (x >= 160) {
				x = -68;

				// reset the RDY flag so the CPU can begin cycling again
				RDY = false;

				// start drawing on the next scanline
				y++;
			}

			if (tiaCycles % 3 === 0) {
				// cycle the RIOT, update the timer
				RIOT.cycle();

				if (RDY === false) {
					proc = CPU6507.cycle();

					// set the RDY latch if the WSYNC byte was written to
					if (mmap.isStrobeActive(MEM_LOCATIONS.WSYNC) === true) {
						RDY = true;
						mmap.resetStrobe(MEM_LOCATIONS.WSYNC);
					}

					// check if VBLANK was turned on or off
					VBLANK = !!(mmap.readByte(MEM_LOCATIONS.VBLANK) & 0x02);

					// check if the VSYCN signal has been turned on or off
					VSYNC = !!(mmap.readByte(MEM_LOCATIONS.VSYNC) & 0x02);
				}
			}

			if (VBLANK === false && x >= 0 && y >= 37) {
				writePixel(x, y - 37);
			}
			
			// draw the next pixel
			x++;

			// incremennt the TIA clock counter
			tiaCycles++;

			// reset the beam to the top of the frame when VSYNC has been detected
			if (VSYNC === true) {
				y = 0;
			}

			return proc;
		},

		runMainLoop = function() {
			var y0, i, l;

			// if the main loop was stopped, run any handlers that were bound
			// to the stop event and return
			if (breakFlag === true) {
				l = handlers.stop.length;
				for (i = 0; i < l; i++) {
					handlers.stop[i]();
				}
				return;
			}

			// run the code until VSYNC is enabled, then draw the frame
			// and request another execution of this function
			while(1) {
				y0 = y;
				execClockCycle();
				if (VSYNC === true && y0 > 0) {
					drawCanvas();
					reqAnimFrame(runMainLoop);
					break;
				}
			}
			
		};


	return {

		init: function(canvas) {
			// set the canvas reference
			canvasElement = canvas;

			// store a reference to the canvas's context
			canvasContext = canvas.getContext('2d');

			// create a pixel buffer to hold the raw data
			pixelBuffer = canvasContext.createImageData(
				VIDEO_BUFFER_WIDTH,
				VIDEO_BUFFER_HEIGHT
			);

			// Initialize the memory map
			mmap = MemoryMap.createAtariMemoryMap();

			// pass the memory map on to the CPU
			CPU6507.init(mmap);

			// initialize and pass the memory map to the RIOT
			RIOT.init(mmap);

			// initialize the TIA's cycle count
			tiaCycles = 0;

			// initialize the frame counter
			numFrames = 0;

			// initialize the TIA as being in the off state
			breakFlag = true;

			// reset the beam position
			x = 0;
			y = 0;

			// reset VBLANK and RDY and VSYNC
			VBLANK = !!(mmap.readByte(MEM_LOCATIONS.VBLANK) & 0x02);
			RDY = false;
			VSYNC = !!(mmap.readByte(MEM_LOCATIONS.VSYNC) & 0x02);
		},

		start: function() {
			var i = 0,
				l = handlers.start.length;

			// reset the break flag
			breakFlag = false;

			// loop through and execute each of the handlers that have been
			// binded to the start event
			for (; i < l; i++) {
				handlers.start[i]();
			}

			// start running the main loop
			runMainLoop();
		},

		step: function() {
			var y0;

			while(1) {
				if (execClockCycle() === true) {
					drawCanvas();
					break;
				}
			}
		},

		stop: function() {
			breakFlag = true;
		},

		addEventHandler: function(type, handler) {
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

		getCycleCount: function() {
			return tiaCycles;
		},

		getNumFrames: function() {
			return numFrames;
		},

		getBeamPosition: function() {
			return {
				x: x,
				y: y
			};
		}

	};

})();