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
		activeROM    = null,
		debugWindow  = null;

	document.addEventListener('DOMContentLoaded', function() {

		// initialize the emulator system and pass in the canvas
		TIA.init(television);

		window.addEventListener('keydown', function(event) {
			switch (event.keyCode) {
				case 38: // up button
					RIOT.setJoystickValue(0, 'up', false);
					break;
				case 37: // left button
					RIOT.setJoystickValue(0, 'left', false);
					break;
				case 39: // right button
					RIOT.setJoystickValue(0, 'right', false);
					break;
				case 40: // down button
					RIOT.setJoystickValue(0, 'down', false);
					break;
				case 32: // fire button
					TIA.setInputValue(4, false);
					break;
				default:
					return;
			}

			event.preventDefault();
			event.stopPropagation();
		}, false);

		// toggle open the debugger window when the ` is pressed
		window.addEventListener('keyup', function(event) {
			switch(event.keyCode) {
				case 192: // ` -- open/close the debugger window
					if (!debugWindow || debugWindow.closed) {
						debugWindow = open('debug.html', 'Debugger',
							'width=960,height=800,resizable=yes,status=yes,centerscreen=yes');
					} else {
						debugWindow.close();
					}
					break;
				case 38: // up button
					RIOT.setJoystickValue(0, 'up', true);
					break;
				case 37: // left button
					RIOT.setJoystickValue(0, 'left', true);
					break;
				case 39: // right button
					RIOT.setJoystickValue(0, 'right', true);
					break;
				case 40: // down button
					RIOT.setJoystickValue(0, 'down', true);
					break;
				case  32: // fire button
					TIA.setInputValue(4, true);
					break;
				default:
					return;
			}

			event.preventDefault();
			event.stopPropagation();
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