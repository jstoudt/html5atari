/**
 * tia.js
 * Author: Jason T. Stoudt
 * Date: 28 March 2012
 *
 * A javascript representation of the Television Interface Adaptor found in
 * the Atari 2600.
 */

var TIA = (function() {

	var mmap = null,  // the memory map to be shared between TIA & CPU
		videoBuffer = null,
		clockSpeed = 3.579545, // frequency of the tia clock in MHz

		handlers = {
			start: [],
			stop: []
		},

		breakFlag = true, // set to stop the TIA execution loop

		colorPalette = [
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

		translateColor = function(color, luminosity) {
			var i = color & 0xf,
				j = (luminosity & 0xff) >>> 1;

			return colorPalette[i][j];
		},

		writePixel = function(x, y) {

		},

		execClockCycle = function() {
			var tiaCycles = 0,
				y = 0,  // vertical position of the beam
				x = 0,  // horizontal posiiton of the beam
				cyclesPerFrame = 59736,
				cpuWaitCycles = 0,
				vsync = false,
				wsync = false,
				instruction,
				handlerLength;

			// we are going to write one frame to the buffer before being
			// called again by the event queue
			while (!vsync) {
				// clear the wsync flag to start running CPU instructions again
				wsync = false;
				for (x = 0; x < 228; x++) {
					// if we're waiting for the CPU, decrement the counter
					if (wsync === false) {
						if (cpuWaitCycles > 0) {
							cpuWaitCycles--;
						} else {
							// tell the CPU to execute the next instruction
							CPU6507.step();

							instruction = CPU6507.queryNextInstruction();
							cpuWaitCycles = instruction.cycles * 3;
						}
					} else {
						cpuWaitCycles = 0;
					}

					// if the beam is out of vertical and horizontal blank,
					// write a pixel at the beam's position to the video buffer
					if (x > 68 && y > 37) {
						writePixel(x - 68, y - 37);
					}
				}
				y++;
			}

			if (breakFlag) {
				setTimeout(execClockCycle, 0);
			} else {
				handlerLength = handlers.stop.length;
				for (i = 0; i < handlerLength; i++) {
					handlers.stop[i]();
				}
			}
		};


	return {

		init: function() {
			// Initialize the memory map
			mmap = new MemoryMap(1 << 13);
			mmap.addStrobe(0x0002);

			// pass the memory map on to the CPU
			CPU6507.init(mmap);
		},

		start: function() {
			var i = 0,
				handlerLength = handlers.start.length;

			breakFlag = false;

			for (; i < handlerLength; i++) {
				handlers.start[i]();
			}

			execClockCycle();
		},

		stop: function() {
			breakFlag = true;
		},

		getMemoryCopy: function(offset, len) {
			return mmap.getCopy(offset, len);
		}

	};

})();