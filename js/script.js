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

		// toggle open the debugger window when the ` is pressed
		window.addEventListener('keyup', function(event) {
			if (event.keyCode === 192) {
				if (!debugWindow || debugWindow.closed) {
					debugWindow = open('debug.html', 'Debugger',
						'resizable=yes,scrollbars=yes,status=yes,width=960,height=800');
				} else {
					debugWindow.close();
				}
			}
		}, false);

		// when this page is unloaded, close the debug window if open
		window.addEventListener('unload', function() {
			if (debugWindow && !debugWindow.closed) {
				debugWindow.close();
			}
		}, false);

		powerSwitch.addEventListener('input', function() {
			if (powerSwitch.value === '1') {
				RIOT.setConsoleSwitch('color',
					colorSwitch.value === '1' ? true : false);
				RIOT.setConsoleSwitch('select', true);
				RIOT.setConsoleSwitch('reset', true);
				RIOT.setConsoleSwitch('difficulty0', false);
				RIOT.setConsoleSwitch('difficulty1', false);
				TIA.start();
			} else {
				// turn the emulator off
				TIA.stop();

				// re-intialize the emulator
				TIA.init(television);

				// reload the ROM after initialization
				CPU6507.loadProgram(activeROM);
			}
		}, false);

		colorSwitch.addEventListener('input', function() {
			RIOT.setConsoleSwitch('color',
				colorSwitch.value === '1' ? true : false);
		}, false);

		selectSwitch.addEventListener('input', function() {
			RIOT.setConsoleSwitch('select',
				selectSwitch.value === '1' ? true : false);
		}, false);

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


		resetSwitch.addEventListener('input', function() {
			RIOT.setConsoleSwitch('reset',
				resetSwitch.value === '1' ? true : false);
		}, false);

		resetSwitch.addEventListener('mouseup', function() {
			setTimeout(function() {
				resetSwitch.value = 1;

				var e = document.createEvent('Events');
				e.initEvent('input', true, false);
				resetSwitch.dispatchEvent(e);
			}, 50);
		}, false);

		// when dragging over the cart-slot, change the border color
		cartSlot.addEventListener('dragover', function(event) {
			event.stopPropagation();
			event.preventDefault();
			cartSlot.classList.add('drag-over');
			event.dataTransfer.dropEffect = 'copy';
		}, false);

		// change the border color back
		cartSlot.addEventListener('dragleave', function(event) {
			event.stopPropagation();
			event.preventDefault();
			cartSlot.classList.remove('drag-over');
		}, false);

		cartSlot.addEventListener('drop', function(event) {
			var romFile, reader;

			event.stopPropagation();
			event.preventDefault();
			cartSlot.classList.remove('drag-over');
			
			if (event.dataTransfer.files.length !== 1) {
				return;
			}

			romFile = event.dataTransfer.files[0];
			if (romFile.size !== 2048 && romFile.size !== 4096) {
				alert('This file does not appear to be an acceptable ROM file.');
				return;
			}

			cartSlot.innerHTML = 'Loading ' + escape(romFile.name) + '&hellip;';
			reader = new FileReader();

			reader.onerror = function() {
				alert('There was an error loading this file as a ROM.');
				cartSlot.textContent = 'Drag \'n Drop your ROMs here';
			};

			reader.onabort = function() {
				cartSlot.textContent = 'Drag \'n Drop your ROMs here';
			};

			reader.onload = function(event) {
				activeROM = new Uint8Array(event.target.result);
				
				CPU6507.loadProgram(activeROM);

				powerSwitch.removeAttribute('disabled');
				colorSwitch.removeAttribute('disabled');
				selectSwitch.removeAttribute('disabled');
				resetSwitch.removeAttribute('disabled');

				cartSlot.classList.add('file-loaded');
				cartSlot.innerHTML = escape(romFile.name) + ' loaded';
			};

			reader.readAsArrayBuffer(romFile);

		}, false);

	}, false);

})();

/*
(function skipAhead() { if (CPU6507.getRegister('pc') !== 0xf3d6) { document.getElementById('step').click(); t = setTimeout(skipAhead, 10); } })();
*/