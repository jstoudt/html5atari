/**
 * script.js
 *
 * Date: 19 April 2012
 * Defines page functionality and ties the Atari 2600 script into
 * the page DOM.
 */


(function() {

	var	television   = document.getElementById('television'),
		cartSlot     = document.getElementById('cart-slot'),
		powerSwitch  = document.getElementById('power-switch'),
		colorSwitch  = document.getElementById('color-switch'),
		selectSwitch = document.getElementById('select-switch'),
		resetSwitch  = document.getElementById('reset-switch'),
		keymap       = null,
		activeROM    = null,
		debugWindow  = null;

	document.addEventListener('DOMContentLoaded', function() {

		if ('keymap' in localStorage) {
			keymap = JSON.parse(localStorage.keymap);
		} else {
			keymap = {
				p0: {
					input: 'keyboard',
					fire:  13,
					up:    38,
					left:  37,
					right: 39,
					down:  40
				},

				p1: {
					input: 'keyboard',
					fire:  32,
					up:    87,
					left:  65,
					right: 68,
					down:  83
				}
			};
			localStorage.keymap = JSON.stringify(keymap);
		}

		// initialize the emulator system and pass in the canvas
		TIA.init(television);

		window.addEventListener('keydown', function(event) {
			var keyCode = event.keyCode,
				dirs = [ 'up', 'left', 'right', 'down' ],
				len = dirs.length,
				i;
			if (keymap.p0.input === 'keyboard') {
				for (i = 0; i < len; i++) {
					if (keyCode === keymap.p0[dirs[i]]) {
						event.preventDefault();
						event.stopPropagation();
						RIOT.setJoystickValue(0, dirs[i], false);
						return;
					}
				}

				if (keyCode === keymap.p0.fire) {
					event.preventDefault();
					event.stopPropagation();
					TIA.setInputValue(4, false);
				}
			}

			if (keymap.p1.input === 'keyboard') {
				for (i = 0; i < len; i++) {
					if (keyCode === keymap.p1[dirs[i]]) {
						event.preventDefault();
						event.stopPropagation();
						RIOT.setJoystickValue(1, dirs[i], false);
						return;
					}
				}

				if (keyCode === keymap.p1.fire) {
					event.preventDefault();
					event.stopPropagation();
					TIA.setInputValue(5, false);
					return;
				}
			}
		}, false);

		// toggle open the debugger window when the ` is pressed
		window.addEventListener('keyup', function(event) {
			var keyCode = event.keyCode,
				dirs = ['up', 'left', 'right', 'down'],
				len = dirs.length;
				i;

			if (keymap.p0.input === 'keyboard') {
				for (i = 0; i < len; i++) {
					if (keyCode === keymap.p0[dirs[i]]) {
						event.preventDefault();
						event.stopPropagation();
						RIOT.setJoystickValue(0, dirs[i], true);
						return;
					}
				}

				if (keyCode === keymap.p0.fire) {
					event.preventDefault();
					event.stopPropagation();
					TIA.setInputValue(4, true);
					return;
				}
			}

			if (keymap.p1.input === 'keyboard') {
				for (i = 0; i < len; i++) {
					if (keyCode === keymap.p1[dirs[i]]) {
						event.preventDefault();
						event.stopPropagation();
						RIOT.setJoystickValue(1, dirs[i], true);
						return;
					}
				}

				if (keyCode === keymap.p1.fire) {
					event.preventDefault();
					event.stopPropagation();
					TIA.setInputValue(5, true);
					return;
				}
			}
		}, false);

		// when this page is unloaded, close the debug window if open
		window.addEventListener('unload', function() {
			if (debugWindow && !debugWindow.closed) {
				debugWindow.close();
			}
		}, false);


		// start and stop the emulator when the power switch is toggled
		powerSwitch.addEventListener('input', function(e) {
			e.stopPropagation();
			e.preventDefault();

			if (powerSwitch.value === '1') {
				if (!TIA.isStarted()) {
					// sync the console switches with the RIOT
					RIOT.setConsoleSwitch('color',
						colorSwitch.value === '1' ? true : false);
					RIOT.setConsoleSwitch('select', true);
					RIOT.setConsoleSwitch('reset', true);
					RIOT.setConsoleSwitch('difficulty0', false);
					RIOT.setConsoleSwitch('difficulty1', false);

					// and start the emulator
					TIA.start();
				}
			} else {
				// turn the emulator off
				TIA.stop();

				// re-intialize the emulator
				TIA.init(television);

				// reload the ROM after initialization
				CPU6507.loadProgram(activeROM);
			}
		}, false);

		// sync the UI color switch slider with the RIOT
		colorSwitch.addEventListener('input', function(e) {
			e.stopPropagation();
			e.preventDefault();

			RIOT.setConsoleSwitch('color',
				colorSwitch.value === '1' ? true : false);
		}, false);

		// sync the UI select switch slider with the RIOT
		selectSwitch.addEventListener('input', function(e) {
			e.stopPropagation();
			e.preventDefault();

			RIOT.setConsoleSwitch('select',
				selectSwitch.value === '1' ? true : false);
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
			}, 50);
		}, false);

		// sync the UI reset switch with the RIOT
		resetSwitch.addEventListener('input', function(e) {
			e.stopPropagation();
			e.preventDefault();

			RIOT.setConsoleSwitch('reset',
				resetSwitch.value === '1' ? true : false);
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

		// when dragging over the cart-slot, change the border color
		cartSlot.addEventListener('dragover', function(e) {
			e.stopPropagation();
			e.preventDefault();

			cartSlot.classList.add('drag-over');
			e.dataTransfer.dropEffect = 'copy';
		}, false);

		// change the border color back
		cartSlot.addEventListener('dragleave', function(e) {
			e.stopPropagation();
			e.preventDefault();

			cartSlot.classList.remove('drag-over');
		}, false);

		// the following is executed when the user drops a file on top
		// of the cart slot
		cartSlot.addEventListener('drop', function(e) {
			var romFile, reader;

			e.stopPropagation();
			e.preventDefault();

			cartSlot.classList.remove('drag-over');
			
			if (e.dataTransfer.files.length !== 1) {
				return;
			}

			romFile = e.dataTransfer.files[0];
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
				cartSlot.textContent = 'Drag \'n Drop your ROMs here';
			};

			reader.onload = function(e) {
				activeROM = new Uint8Array(e.target.result);
				
				CPU6507.loadProgram(activeROM);

				powerSwitch.removeAttribute('disabled');
				powerSwitch.value = 0;
				colorSwitch.removeAttribute('disabled');
				selectSwitch.removeAttribute('disabled');
				resetSwitch.removeAttribute('disabled');

				cartSlot.classList.add('file-loaded');
				cartSlot.innerHTML = romFile.name + ' loaded';
			};

			reader.readAsArrayBuffer(romFile);

		}, false);

	}, false);

})();

/*
(function skipAhead() { if (CPU6507.getRegister('pc') !== 0xf3d6) { document.getElementById('step').click(); t = setTimeout(skipAhead, 10); } })();
*/