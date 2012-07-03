/**
 * script.js
 *
 * Date: 19 April 2012
 * Defines page functionality and ties the Atari 2600 script into
 * the page DOM.
 */

(function( window, document, KEYCODES, undefined ) {

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
		rafId                 = null;

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

	function pollGamepads() {
		var p, i, gamepads, map, pad, btn,
			dirs = [ 'up', 'left', 'right', 'down' ];

		if (navigator.webkitGamepads) {
			rafId = reqAnimFrame(pollGamepads);
			gamepads = navigator.webkitGamepads;

			for (p = 0; p <= 1; p++) {
				map = keymap[p];
				if (map.input === 'gamepad') {
					pad = map.fire.pad;
					btn = map.fire.btn;

					TIA.setInputValue(p + 4, !gamepads[pad].buttons[btn]);

					for (i = 0; i < dirs.length; i++) {
						pad = map[dirs[i]].pad;
						btn = map[dirs[i]].btn;

						RIOT.setJoystickValue(p, dirs[i], !gamepads[pad].buttons[btn]);
					}
				}
			}
		}
	}

	function addGameKeyListeners() {
		window.addEventListener('keydown', handleGameKeys, false);
		window.addEventListener('keyup', handleGameKeys, false);
		rafId = reqAnimFrame(pollGamepads);
	}

	function removeGameKeyListeners() {
		window.removeEventListener('keydown', handleGameKeys);
		window.removeEventListener('keyup', handleGameKeys);
		cancelAnimFrame(rafId);
	}

	function toggleDebugWindow() {
		if (!debugWindow || debugWindow.closed) {
			debugWindow = open('debug.html', 'Debugger',
				'width=960,height=850,resizable=yes,centerscreen=yes,status=yes');
		} else {
			debugWindow.close();
		}
	}

	function cleanRomName( name ) {
		if (/\.bin$/i.test(name)) {
			name = name.substr(0, name.length - 4);
		}

		if (name.length > 70) {
			name = name.substring(0, 69) + '&hellip;';
		}

		return name;
	}

	function populateRomsList() {
		var ol = document.getElementById('roms-list'),
			p = $(ol).siblings('p').get(0),
			roms = localStorage.roms ? JSON.parse(localStorage.roms) : [],
			i, li, a;

		if (roms.length < 1) {
			$(ol).addClass('hidden');
			$(p).removeClass('hidden');
			return;
		}

		$(ol).removeClass('hidden').empty();
		$(p).addClass('hidden');

		for (i = 0; i < roms.length; i++) {
			li = document.createElement('li');
			a = document.createElement('a');
			a.textContent = roms[i].name;
			a.dataset.index = i;
			li.appendChild(a);
			ol.appendChild(li);
		}
	}

	function populateKeymaps() {
		var keymap = JSON.parse(localStorage.keymap),
			map = keymap[0];
		
		$('#p0-source').text(map.input);
		if (map.input === 'keyboard') {
			$('#p0-fire').text(KEYCODES[map.fire]);
			$('#p0-up').text(KEYCODES[map.up]);
			$('#p0-left').text(KEYCODES[map.left]);
			$('#p0-right').text(KEYCODES[map.right]);
			$('#p0-down').text(KEYCODES[map.down]);
		} else {
			$('#p0-fire').text('JOY:' + map.fire.pad + ' BTN:' + map.fire.btn);
			$('#p0-up').text('JOY:' + map.up.pad + ' BTN:' + map.up.btn);
			$('#p0-left').text('JOY:' + map.left.pad + ' BTN:' + map.left.btn);
			$('#p0-right').text('JOY:' + map.right.pad + ' BTN:' + map.right.btn);
			$('#p0-down').text('JOY:' + map.down.pad + ' BTN:' + map.down.btn);
		}
		
		map = keymap[1];

		$('#p1-source').text(map.input);
		if (map.input === 'keyboard') {
			$('#p1-fire').text(KEYCODES[map.fire]);
			$('#p1-up').text(KEYCODES[map.up]);
			$('#p1-left').text(KEYCODES[map.left]);
			$('#p1-right').text(KEYCODES[map.right]);
			$('#p1-down').text(KEYCODES[map.down]);
		} else {
			$('#p1-fire').text('JOY:' + map.fire.pad + ' BTN:' + map.fire.btn);
			$('#p1-up').text('JOY:' + map.up.pad + ' BTN:' + map.up.btn);
			$('#p1-left').text('JOY:' + map.left.pad + ' BTN:' + map.left.btn);
			$('#p1-right').text('JOY:' + map.right.pad + ' BTN:' + map.right.btn);
			$('#p1-down').text('JOY:' + map.down.pad + ' BTN:' + map.down.btn);
		}
	}

	function populateGamepads() {
		var count = 0,
			ol = document.getElementById('gamepad-list'),
			i = 0,
			gamepad;

		$(ol).empty();

		if (navigator.webkitGamepads) {
			for (; i < navigator.webkitGamepads.length; i++) {
				gamepad = navigator.webkitGamepads[i];
				if (typeof gamepad !== 'undefined') {
					$(ol).append('<li>' + gamepad.id + '</li>');
					count++;
				}
			}
		}

		$('#no-gamepads').css('display', count ? 'none' : 'block');
	}

	function loadRom( name, rom ) {
		var roms, i, curRom;

		activeROM = rom;

		TIA.stop();
		TIA.init(television);

		CPU6507.loadProgram(activeROM);

		powerSwitch.value = 0;

		$('.switch input[type=range]').removeAttr('disabled');

		$(cartSlot)
			.addClass('file-loaded')
			.html(cleanRomName(name) + ' loaded');

		roms = localStorage.roms ? JSON.parse(localStorage.roms) : [];

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
		localStorage.roms = JSON.stringify(roms.slice(0, 25));

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
			keymap = DEFAULT_KEYMAP;

			// put the default map in storage
			localStorage.keymap = JSON.stringify(keymap);
		}

		// initialize the emulator system and pass in the canvas
		TIA.init(television);

		populateRomsList();
		populateKeymaps();
		populateGamepads();

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
			if (event.target && event.target.dataset &&
					event.target.dataset.index) {
				event.preventDefault();
				event.stopPropagation();

				// close the panel when a ROM is loaded
				romsList.parentNode.classList.remove('open');

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
			var p0EditKeymap = document.getElementById('p0-edit-keymap'),
				p1EditKeymap = document.getElementById('p1-edit-keymap');

			event.stopPropagation();
			event.preventDefault();

			if (powerSwitch.value === '1') {
				if (!TIA.isStarted()) {
					// sync the console switches with the RIOT
					RIOT.setConsoleSwitch('color', colorSwitch.value === '1');
					RIOT.setConsoleSwitch('select', selectSwitch.value === '1');
					RIOT.setConsoleSwitch('reset', resetSwitch.value === '1');
					RIOT.setConsoleSwitch('difficulty0',
						leftDifficultySwitch.value === '1');
					RIOT.setConsoleSwitch('difficulty1',
						rightDifficultySwitch.value === '1');

					// don't allow users to edit keymaps while game is running
					p0EditKeymap.style.display = 'none';
					p1EditKeymap.style.display = 'none';

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

				p0EditKeymap.style.display = 'block';
				p1EditKeymap.style.display = 'block';


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
				var event = document.createEvent('Events');
				event.initEvent('input', true, false);
				selectSwitch.dispatchEvent(event);
			}, 0);
		}, false);

		// sync the UI reset switch with the RIOT
		resetSwitch.addEventListener('input', function( event ) {
			event.stopPropagation();
			event.preventDefault();

			RIOT.setConsoleSwitch('reset', resetSwitch.value === '1');
		}, false);

		// snap the reset switch back to the normally closed position
		// when the users lets go of it with the mouse
		resetSwitch.addEventListener('mouseup', function() {
			setTimeout(function() {
				resetSwitch.value = 1;

				var event = document.createEvent('Events');
				event.initEvent('input', true, false);
				resetSwitch.dispatchEvent(event);
			}, 0);
		}, false);

		// when dragging over the cart slot, change the border color
		cartSlot.addEventListener('dragenter', function( event ) {
			event.stopPropagation();
			event.preventDefault();

			cartSlot.classList.add('drag-over');
			event.dataTransfer.dropEffect = 'copy';
		}, false);

		// change the border color back if the user drags the object
		// away from the cartridge slot
		cartSlot.addEventListener('dragleave', function( event ) {
			event.stopPropagation();
			event.preventDefault();

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
				alert('There was an error loading this file as a ROM.');

				cartSlot.textContent = 'Drag \'n Drop your ROMs here';
			};

			reader.onabort = function() {
				alert('The ROM loading procedure has been aborted.');

				cartSlot.textContent = 'Drag \'n Drop your ROMs here';
			};

			reader.onload = function( event ) {
				loadRom(romFile.name, new Uint8Array(event.target.result));
			};

			reader.readAsArrayBuffer(romFile);

		}, false);

		$('#wizard').overlay({
			top: '20%',

			mask: {
				color: '#000',
				loadSpeed: 300,
				opacity: 0.8
			},

			// keep the overlay open when the user clicks around it
			closeOnClick: false,

			// stop polling for gamepad data while the overlay is open
			onBeforeLoad: function() {
				cancelAnimFrame(rafId);
			},

			// start polling the gamepads for input again when the overlay closes
			onClose: function() {
				rafId = reqAnimFrame(pollGamepads);
				populateKeymaps();
			}
		});

		$('#p0-edit-keymap').click(function() {
			$('#wizard').overlay().load();
			return false;
		});

		$('#p1-edit-keymap').click(function() {
			$('#wizard').overlay().load();
			return false;
		});

		$('#cancel-wizard').click(function() {
			$('#wizard').overlay().close();
			return false;
		});

	}, false);

})(window, document, KEYCODES);


// Included script for Twitter buttons
!function(d,s,id){var js,fjs=d.getElementsByTagName(s)[0];if(!d.getElementById(id)){js=d.createElement(s);js.id=id;js.src="//platform.twitter.com/widgets.js";fjs.parentNode.insertBefore(js,fjs);}}(document,"script","twitter-wjs");