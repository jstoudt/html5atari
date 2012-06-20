/**
 * script.js
 *
 * Date: 19 April 2012
 * Defines page functionality and ties the Atari 2600 script into
 * the page DOM.
 */

// A utility for encoding and decoding Base64 values to store ROMs
// in local storage (and maybe other purposes)
var Base64 = {
	encode: function( input ) {
		var output = '',
			len = input.length,
			i = 0;

		for (; i < len; i++) {
			output += String.fromCharCode(input[i]);
		}

		return window.btoa(output);
	},

	decode: function( input ) {
		var i = 0,
			len, output;

		input = window.atob(input);
		len = input.length;
		output = new Uint8Array(new ArrayBuffer(len));

		for (; i < len; i++) {
			output[i] = input.charCodeAt(i);
		}

		return output;
	}
};


(function() {

	var	television            = document.getElementById('television'),
		cartSlot              = document.getElementById('cart-slot'),
		powerSwitch           = document.getElementById('power-switch'),
		colorSwitch           = document.getElementById('color-switch'),
		leftDifficultySwitch  = document.getElementById('left-difficulty'),
		rightDifficultySwitch = document.getElementById('right-difficulty'),
		selectSwitch          = document.getElementById('select-switch'),
		resetSwitch           = document.getElementById('reset-switch'),
		keymap                = null,
		activeROM             = null,
		debugWindow           = null,
		defaultKeymap         = [
			{
				input: 'keyboard',
				fire:  {
					keyName: 'SPACE',
					keyCode: 32
				},
				up: {
					keyName: 'W',
					keyCode: 87
				},
				left: {
					keyName: 'A',
					keyCode: 65
				},
				right: {
					keyName: 'D',
					keyCode: 68
				},
				down: {
					keyName: 'S',
					keyCode: 83
				}
			}, {
				input: 'keyboard',
				fire:  13,
				up:    38,
				left:  37,
				right: 39,
				down:  40
			}
		];

	function handleGameKeys( event ) {
		var keyCode = event.keyCode,
			dirs = [ 'up', 'left', 'right', 'down' ],
			len = dirs.length,
			val = event.type === 'keydown' ? false : true,
			p = 0,
			i, map;

		for (; p <= 1; p++) {
			map = keymap[p];
			if (map.input === 'keyboard') {
				for (i = 0; i < len; i++) {
					if (keyCode === map[dirs[i]]) {
						event.preventDefault();
						event.stopPropagation();
						RIOT.setJoystickValue(p, dirs[i], val);
						return;
					}
				}

				if (keyCode === map.fire) {
					event.preventDefault();
					event.stopPropagation();
					TIA.setInputValue(p + 4, val);
					return;
				}
			}
		}
	}

	function addGameKeyListeners() {
		window.addEventListener('keydown', handleGameKeys, false);
		window.addEventListener('keyup', handleGameKeys, false);
	}

	function removeGameKeyListeners() {
		window.removeEventListener('keydown', handleGameKeys);
		window.removeEventListener('keyup', handleGameKeys);
	}

	function toggleDebugWindow() {
		if (!debugWindow || debugWindow.closed) {
			debugWindow = open('debug.html', 'Debugger',
				'width=960,height=850,resizable=yes,centerscreen=yes,status=yes');
		} else {
			debugWindow.close();
		}
	}

	function populateRomsList() {
		var ol = document.getElementById('roms-list'),
			p = ol.parentNode.getElementsByTagName('p')[0],
			roms, i, li, a;

		if (localStorage.roms) {
			roms = JSON.parse(localStorage.roms);
		} else {
			roms = [];
		}

		if (roms.length < 1) {
			ol.classList.add('hidden');
			p.classList.remove('hidden');
			return;
		}

		ol.classList.remove('hidden');
		p.classList.add('hidden');

		while (ol.childNodes.length) {
			ol.removeChild(ol.childNodes[0]);
		}

		for (i = 0; i < roms.length; i++) {
			li = document.createElement('li');
			a = document.createElement('a');
			a.textContent = roms[i].name;
			a.dataset.index = i;
			li.appendChild(a);
			ol.appendChild(li);
		}
	}

	function loadRom(name, rom) {
		var instructionElem = cartSlot.querySelector('.instructions'),
			romNameElem = cartSlot.querySelector('.rom-name'),
			roms, i, curRom;

		activeROM = rom;

		TIA.stop();
		TIA.init(television);

		CPU6507.loadProgram(activeROM);

		powerSwitch.removeAttribute('disabled');
		powerSwitch.value = 0;
		colorSwitch.removeAttribute('disabled');
		selectSwitch.removeAttribute('disabled');
		resetSwitch.removeAttribute('disabled');
		leftDifficultySwitch.removeAttribute('disabled');
		rightDifficultySwitch.removeAttribute('disabled');

		cartSlot.classList.add('file-loaded');
		instructionElem.classList.add('hidden');
		romNameElem.classList.remove('hidden');
		romNameElem.textContent = name + ' loaded';

		if (localStorage.roms) {
			roms = JSON.parse(localStorage.roms);
		} else {
			roms = [];
		}

		curRom = {
			name: name,
			data: Base64.encode(activeROM)
		};

		for (i = 0; i < roms.length; i++) {
			if (roms[i].name === name) {
				roms.splice(i, 1);
				break;
			}
		}

		roms.unshift(curRom);
		localStorage.roms = JSON.stringify(roms.slice(0, 10));

		populateRomsList();
	}

	function loadSavedRom(index) {
		var rom = JSON.parse(localStorage.roms)[index];
		
		loadRom(rom.name, Base64.decode(rom.data));
	}

	document.addEventListener('DOMContentLoaded', function() {
		var romToggleButton = document.getElementById('rom-toggle-btn'),
			romsList = document.getElementById('roms-list'),
			romPanel = romToggleButton.parentNode,
			controlsToggleButton = document.getElementById('controls-toggle-btn');

		// if a keymap has already been stored, load it
		if ('keymap' in localStorage) {
			keymap = JSON.parse(localStorage.keymap);
		} else {
			// otherwise, create a default map
			keymap = defaultKeymap;

			// put the default map in storage
			localStorage.keymap = JSON.stringify(keymap);
		}

		// initialize the emulator system and pass in the canvas
		TIA.init(television);

		populateRomsList();

		// ROMs panel toggle button
		romToggleButton.addEventListener('click', function( event ) {
			event.stopPropagation();
			event.preventDefault();
			this.parentNode.classList.toggle('open');
		}, false);

		// Controller config panel toggle button
		controlsToggleButton.addEventListener('click', function( event ) {
			event.preventDefault();
			event.stopPropagation();
			this.parentNode.classList.toggle('open');
		}, false);

		// Load the ROM from the recently loaded list when the user clicks on it
		romsList.addEventListener('click', function( event ) {
			if (event.target && event.target.dataset && event.target.dataset.index) {
				event.preventDefault();
				event.stopPropagation();
				loadSavedRom(event.target.dataset.index);
			}
		}, false);

		// toggle open the debugger window when the ` is pressed
		window.addEventListener('keyup', function( event ) {
			if (event.keyCode === 192) {
				event.preventDefault();
				event.stopPropagation();
				toggleDebugWindow();
			}
		}, false);

		// when this page is unloaded, close the debug window if open
		window.addEventListener('unload', function() {
			if (debugWindow) {
				debugWindow.close();
			}
		}, false);


		// start and stop the emulator when the power switch is toggled
		powerSwitch.addEventListener('input', function( event ) {
			event.stopPropagation();
			event.preventDefault();

			if (powerSwitch.value === '1') {
				if (!TIA.isStarted()) {
					// sync the console switches with the RIOT
					RIOT.setConsoleSwitch('color', colorSwitch.value === '1');
					RIOT.setConsoleSwitch('select', true);
					RIOT.setConsoleSwitch('reset', true);
					RIOT.setConsoleSwitch('difficulty0', false);
					RIOT.setConsoleSwitch('difficulty1', false);

					// add the key listeners to the DOM for game input
					addGameKeyListeners();

					// and start the emulator
					TIA.start();
				}
			} else {
				// turn the emulator off
				TIA.stop();

				// remove the game key listeners from the DOM
				removeGameKeyListeners();

				// re-intialize the emulator
				TIA.init(television);

				// reload the ROM after initialization
				CPU6507.loadProgram(activeROM);
			}
		}, false);

		// sync the UI color switch slider with the RIOT
		colorSwitch.addEventListener('input', function( event ) {
			event.stopPropagation();
			event.preventDefault();

			RIOT.setConsoleSwitch('color', colorSwitch.value === '1');
		}, false);

		leftDifficultySwitch.addEventListener('input', function( event ) {
			event.preventDefault();
			event.stopPropagation();

			RIOT.setConsoleSwitch('difficulty0', leftDifficultySwitch.value === '1');
		}, false);

		rightDifficultySwitch.addEventListener('input', function( event ) {
			event.stopPropagation();
			event.preventDefault();

			RIOT.setConsoleSwitch('difficulty1', rightDifficultySwitch.value === '1');
		}, false);

		// sync the UI select switch slider with the RIOT
		selectSwitch.addEventListener('input', function( event ) {
			event.stopPropagation();
			event.preventDefault();

			RIOT.setConsoleSwitch('select', selectSwitch.value === '1');
		}, false);

		// snap the select switch back to the normally open position
		// when the user lets go of it with the mouse
		selectSwitch.addEventListener('mouseup', function() {
			setTimeout(function() {
				// move the switch back to the normal position
				selectSwitch.value = 1;

				// create and fire an event to simulate a normal input change
				var e = document.createEvent('Events');
				e.initEvent('input', true, false);
				selectSwitch.dispatchEvent(e);
			}, 0);
		}, false);

		// sync the UI reset switch with the RIOT
		resetSwitch.addEventListener('input', function( e ) {
			e.stopPropagation();
			e.preventDefault();

			RIOT.setConsoleSwitch('reset', resetSwitch.value === '1');
		}, false);

		// snap the reset switch back to the normally closed position
		// when the users lets go of it with the mouse
		resetSwitch.addEventListener('mouseup', function() {
			setTimeout(function() {
				resetSwitch.value = 1;

				var e = document.createEvent('Events');
				e.initEvent('input', true, false);
				resetSwitch.dispatchEvent(e);
			}, 0);
		}, false);

		// when dragging over the cart slot, change the border color
		cartSlot.addEventListener('dragenter', function( e ) {
			e.stopPropagation();
			e.preventDefault();

			cartSlot.classList.add('drag-over');
			e.dataTransfer.dropEffect = 'copy';
		}, false);

		// change the border color back if the user drags the object
		// away from the cartridge slot
		cartSlot.addEventListener('dragleave', function( e ) {
			e.stopPropagation();
			e.preventDefault();

			cartSlot.classList.remove('drag-over');
		}, false);

		// the following is executed when the user drops a file on top
		// of the cart slot
		cartSlot.addEventListener('drop', function( event ) {
			var romFile, reader;

			event.stopPropagation();
			event.preventDefault();

			cartSlot.classList.remove('drag-over');
			
			if (event.dataTransfer.files.length !== 1) {
				alert('You can only drag one ROM file at a time.');
				return;
			}

			romFile = event.dataTransfer.files[0];
			if (romFile.size !== 2048 && romFile.size !== 4096) {
				alert('This file does not appear to be an acceptable ROM file.');
				return;
			}

			reader = new FileReader();

			reader.onerror = function() {
				var instructions = cartSlot.querySelector('.instructions');
				alert('There was an error loading this file as a ROM.');

				instructions.classList.remove('hidden');

//				cartSlot.textContent = 'Drag \'n Drop your ROMs here';
			};

			reader.onabort = function() {
				var instructions = cartSlot.querySelector('.instructions');
				alert('The ROM loading procedure has been aborted.');

				instructions.classList.remove('hidden');
//				cartSlot.textContent = 'Drag \'n Drop your ROMs here';
			};

			reader.onload = function( event ) {
				loadRom(romFile.name, new Uint8Array(event.target.result));
			};

			reader.readAsArrayBuffer(romFile);

		}, false);

	}, false);

})();
