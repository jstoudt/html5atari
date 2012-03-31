/**
 * tia.js
 * Author: Jason T. Stoudt
 * Date: 28 March 2012
 *
 * A javascript representation of the Television Interface Adaptor found in
 * the Atari 2600.
 */

var TIA = (function() {

	var mmap,        // the memory map to be shared between TIA & CPU

		videoBuffer, // the array of pixel colors representing the video output

		canvasElement, // a reference to the canvas element for video output

		canvasContext, // the context of the canvas element for video output

		handlers = {
			start: [],
			stop: [],
			step: []
		},

		deltaQueue = [], // the pixels that need to be written to the canvas

		reqAnimFrame = window.requestAnimationFrame ||
			window.webkitRequestAnimationFrame ||
			window.mozRequestAnimationFrame,

		tiaCycles, // the number of cycles executed by the TIA

		numFrames, // the number of frames written to the canvas

		breakFlag = true, // set to stop the TIA execution loop

		TARGET_CYCLE_RATE = 3579.545, // frequency of the TIA clock in kHz

		VIDEO_BUFFER_WIDTH  = 160,
		VIDEO_BUFFER_HEIGHT = 192,

		PIXEL_WIDTH         = 2, // this is the base 2 exponent of the
		PIXEL_HEIGHT        = 1, // pixel width and height (cheaper mult)

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
				'#000000', '#404040', '#6C6C6C', '#909090',
				'#B0B0B0', '#C8C8C8', '#DCDCDC', '#ECECEC'
			], [ // 1
				'#444400', '#646410', '#848424', '#A0A034',
				'#B8B840', '#D0D050', '#E8E85C', '#FCFC68'
			], [ // 2
				'#702800', '#844414', '#985C28', '#AC783C',
				'#BC8C4C', '#CCA05C', '#DCB468', '#ECC878'
			], [ // 3
				'#841800', '#983418', '#AC5030', '#C06848',
				'#D0805C', '#E09470', '#ECA880', '#FCBC94'
			], [ // 4
				'#880000', '#9C2020', '#B03C3C', '#C05858',
				'#D07070', '#E08888', '#ECA0A0', '#FCB4B4'
			], [ // 5
				'#78005C', '#8C2074', '#A03C88', '#B0589C',
				'#C070B0', '#D084C0', '#DC9CD0', '#ECB0E0'
			], [ // 6
				'#480078', '#602090', '#783CA4', '#8C58B8',
				'#A070CC', '#B484DC', '#C49CEC', '#D4B0FC'
			], [ // 7
				'#140084', '#302098', '#4C3CAC', '#6858C0',
				'#7C70D0', '#9488E0', '#A8A0EC', '#BCB4FC'
			], [ // 8
				'#000088', '#1C209C', '#3840B0', '#505CC0',
				'#6874D0', '#7C8CE0', '#90A4EC', '#A4B8FC'
			], [ // 9
				'#00187C', '#1C3890', '#3854A8', '#5070BC',
				'#6888CC', '#7C9CDC', '#90B4EC', '#A4C8FC'
			], [ // 10
				'#002C5C', '#1C4C78', '#386890', '#5084AC',
				'#689CC0', '#7CB4D4', '#90CCE8', '#A4E0FC'
			], [ // 11
				'#003C2C', '#1C5C48', '#387C64', '#509C80',
				'#68B494', '#7CD0AC', '#90E4C0', '#A4FCD4'
			], [ // 12
				'#003C00', '#205C20', '#407C40', '#5C9C5C',
				'#74B474', '#8CD08C', '#A4E4A4', '#B8FCB8'
			], [ // 13
				'#143800', '#345C1C', '#507C38', '#6C9850',
				'#84B468', '#9CCC7C', '#B4E490', '#C8FCA4'
			], [ // 14
				'#2C3000', '#4C501C', '#687034', '#848C4C',
				'#9CA864', '#B4C078', '#CCD488', '#E0EC9C'
			], [ // 15
				'#442800', '#644818', '#846830', '#A08444',
				'#B89C58', '#D0B46C', '#E8CC7C', '#FCE08C'
			]
		],

		isPlayfieldAt = function(x) {
			var ctrlpf;

			if (x >= 20) {
				ctrlpf = mmap.readByte(MEM_LOCATIONS.CTRLPF);
				x = (ctrlpf & 0x01) ? 40 - x : x - 20;
			}

			return x < 4 ? (mmap.readByte(MEM_LOCATIONS.PF0) >>> 4) & (1 << x) :
				x < 12 ? mmap.readByte(MEM_LOCATIONS.PF1) & (0x80 >> (x - 4)) :
				mmap.readByte(MEM_LOCATIONS.PF2) & (1 << (x - 12));
		},

		writePixel = function(x, y) {
			// determine what color the pixel at the present coordinates should be
			var color = mmap.readByte(isPlayfieldAt(x >>> 2) ?
				MEM_LOCATIONS.COLUPF :
				MEM_LOCATIONS.COLUBK);

			if (videoBuffer[x][y] !== color) {
				if (!deltaQueue[color]) {
					deltaQueue[color] = [];
				}
				
				deltaQueue[color].push({ x: x, y: y });
				
				videoBuffer[x][y] = color;
			}
		},

		drawCanvas = function() {
			var color, i, colorQueue, len, delta;

			for (color in deltaQueue) {
				colorQueue = deltaQueue[color];
				len = colorQueue.length;
				canvasContext.fillStyle = COLOR_PALETTE[(color & 0xf0) >>> 4][(color & 0x0f) >>> 1];

				for (i = 0; i < len; i++) {
					delta = colorQueue[i];
					canvasContext.fillRect(
						delta.x << PIXEL_WIDTH,
						delta.y << PIXEL_HEIGHT,
						1 << PIXEL_WIDTH,
						1 << PIXEL_HEIGHT);
				}
			}

			// reset the queue
			deltaQueue = [];

			// increment the number of frames drawn
			numFrames++;

			// unless the TIA was stopped, schedule another canvas draw routine
			if (!breakFlag) {
				reqAnimFrame(drawCanvas);
			}
		},

		lastTime = 0,
		lastCycleCount = 0,

		execClockCycle = function() {
			var x,
				y = 0,             // the coordinates of the beam
				cpuWaitCycles = 0, // countdown until next CPU step
				vsync = 0,         // has the beam been reset to the top?
				wsync = false,     // should we lock the CPU until hblank?
				vblank = 0,        // has the beam been turned off for v reset?
				i,                 // generic couting variable
				curTime,           // time when done with frame
				cycleRate,         // the current rate of cycles/sec
				handlerLength;     // number of event handlers in queue

			// we are going to write one frame to the buffer before being
			// called again by the event queue
			while (!vsync) {
				// clear the wsync flag to start running CPU instructions again
				wsync = false;
				for (x = 0; x < 228; x++) {
					// if we're waiting for the CPU, decrement the counter
					if (!wsync) {
						if (cpuWaitCycles > 0) {
							cpuWaitCycles--;
						} else {
							// tell the CPU to execute the next instruction
							CPU6507.step();

							// calculate how long we need to wait to execute
							// the next CPU instruction
							cpuWaitCycles = CPU6507.queryNextInstruction().cycles * 3;

							// check if the vsync was enabled
							vsync = mmap.readByte(MEM_LOCATIONS.VSYNC) & 0x02;

							// check if wsync was enabled
							if (mmap.isStrobeActive(MEM_LOCATIONS.WSYNC)) {
								wsync = true;
								mmap.resetStrobe(MEM_LOCATIONS.WSYNC);
							}

							vblank = mmap.readByte(MEM_LOCATIONS.VBLANK) & 0x02;
						}
					} else {
						cpuWaitCycles = 0;
					}

					// if the beam is out of vertical and horizontal blank,
					// write a pixel at the beam's position to the video buffer
					if (!vblank && x >= 68 && y >= 37) {
						writePixel(x - 68, y - 37);
					}

					tiaCycles++;
				}
				y++;
			}

			if (!breakFlag) {

//				TARGET_CYCLE_RATE: 3579.545 kHz

				curTime = Date.now();
				cycleRate = (tiaCycles - lastCycleCount) / (curTime - lastTime);
				setTimeout(execClockCycle, cycleRate > TARGET_CYCLE_RATE ?
					1 / (cycleRate - TARGET_CYCLE_RATE) :
					0);
				lastTime = curTime;
				lastCycleCount = tiaCycles;
			} else {
				handlerLength = handlers.stop.length;
				for (i = 0; i < handlerLength; i++) {
					handlers.stop[i]();
				}
			}
		};


	return {

		init: function(canvas) {
			var i = 0;

			// set the canvas reference
			canvasElement = canvas;

			// store a reference to the canvas's context
			canvasContext = canvas.getContext('2d');

			// Initialize the memory map
			mmap = MemoryMap.createAtariMemoryMap();

			// create a data structure for the video frame buffer
			videoBuffer = [];
			for (; i < VIDEO_BUFFER_WIDTH; i++) {
				videoBuffer[i] = [];
			}

			// pass the memory map on to the CPU
			CPU6507.init(mmap);

			// initialize the TIA's cycle count
			tiaCycles = 0;

			// initialize the frame counter
			numFrames = 0;
		},

		start: function() {
			var i = 0,
				handlerLength = handlers.start.length;

			breakFlag = false;

			for (; i < handlerLength; i++) {
				handlers.start[i]();
			}

			drawCanvas();
			execClockCycle();
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
		}

	};

})();