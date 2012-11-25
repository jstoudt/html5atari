/*global $:false,TIA:false,RIOT:false,CPU6507:false,Utility:false*/

/**
 * script.js
 *
 * Date: 19 April 2012
 * Defines page functionality and ties the Atari 2600 script into
 * the page DOM.
 */

(function( window, document, undefined ) {

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

	function handleGameKeys( e ) {
		var keyCode = e.keyCode,
			dirs = [ 'up', 'left', 'right', 'down' ],
			len = dirs.length,
			val = ( e.type !== 'keydown' ),
			p = 0,
			i, map;

		for ( ; p <= 1; p++ ) {
			map = keymap[p];
			if (map.input === 'keyboard') {
				for ( i = 0; i < len; i++ ) {
					if (keyCode === map[dirs[i]]) {
						e.preventDefault();
						e.stopPropagation();
						RIOT.setJoystickValue(p, dirs[i], val);
						return;
					}
				}

				if (keyCode === map.fire) {
					e.preventDefault();
					e.stopPropagation();
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
			rafId = window.requestAnimationFrame( pollGamepads );
			gamepads = navigator.webkitGamepads;

			for (p = 0; p <= 1; p++) {
				map = keymap[p];
				if (map.input === 'gamepad') {
					pad = map.fire.pad;
					btn = map.fire.btn;

					if (typeof gamepads[pad] !== 'undefined') {
						TIA.setInputValue(p + 4, !gamepads[pad].buttons[btn]);
					}

					for (i = 0; i < dirs.length; i++) {
						pad = map[dirs[i]].pad;
						btn = map[dirs[i]].btn;

						if (typeof gamepads[pad] !== 'undefined') {
							RIOT.setJoystickValue(p, dirs[i],
								!gamepads[pad].buttons[btn]);
						}
					}
				}
			}
		}
	}

	function addGameKeyListeners() {
		window.addEventListener('keydown', handleGameKeys, false);
		window.addEventListener('keyup', handleGameKeys, false);
		rafId = window.requestAnimationFrame( pollGamepads );
	}

	function removeGameKeyListeners() {
		window.removeEventListener('keydown', handleGameKeys);
		window.removeEventListener('keyup', handleGameKeys);
		window.cancelAnimationFrame( rafId );
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
		// create a reference to the keycodes utility array
		var KEYCODES = Utility.KEYCODES,
			map,
			setInnerTextById = function( id, text ) {
				var el = document.getElementById( id );
				if ( el ) {
					if ( el.textContent ) {
						el.textContent = text;
					} else if ( el.innerText ) {
						el.innerText = text;
					}
				}
			};

		// store the default key mappings if one does not already exist
		// in local storage
		if (!localStorage.keymap) {
			localStorage.keymap = JSON.stringify(Utility.DEFAULT_KEYMAP);
		}

		keymap = JSON.parse(localStorage.keymap);

		map = keymap[0];

		setInnerTextById( 'p0-source', map.input );

		if (map.input === 'keyboard') {
			setInnerTextById( 'p0-fire', KEYCODES[map.fire] );
			setInnerTextById( 'p0-up', KEYCODES[map.up] );
			setInnerTextById( 'p0-left', KEYCODES[map.left] );
			setInnerTextById( 'p0-right', KEYCODES[map.right] );
			setInnerTextById( 'p0-down', KEYCODES[map.down] );
		} else {
			setInnerTextById( 'p0-fire',
				'JOY:' + map.fire.pad + ' BTN:' + map.fire.btn );
			setInnerTextById( 'p0-up',
				'JOY:' + map.up.pad + ' BTN:' + map.up.btn );
			setInnerTextById( 'p0-left',
				'JOY:' + map.left.pad + ' BTN:' + map.left.btn );
			setInnerTextById( 'p0-right',
				'JOY:' + map.right.pad + ' BTN:' + map.right.btn );
			setInnerTextById( 'p0-down',
				'JOY:' + map.down.pad + ' BTN:' + map.down.btn );
		}

		map = keymap[1];

		setInnerTextById( 'p1-source', map.input );

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
		var found = false,
			ol = document.getElementById('gamepad-list'),
			header = document.querySelector( '.gamepads > h4' ),
			noGamepads = document.getElementById('no-gamepads'),
			i = 0,
			li, gamepad;

		ol.innerHTML = '';

		if (navigator.webkitGamepads) {
			for (; i < navigator.webkitGamepads.length; i++) {
				gamepad = navigator.webkitGamepads[i];
				if (typeof gamepad !== 'undefined') {
					li = document.createElement( 'li' );
					li.textContent = gamepad.id;
					ol.appendChild( li );
					found = true;
				}
			}
		}

		if ( found ) {
			noGamepads.style.display = 'none';
			header.style.display = 'block';
			ol.style.display = 'block';
		} else {
			noGamepads.style.display = 'block';
			header.style.display = 'none';
			ol.style.display = 'none';
		}
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
			data: Utility.Base64.encode(activeROM)
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

		loadRom(rom.name, Utility.Base64.decode(rom.data));
	}

	function onWizardLoad() {
		window.cancelAnimationFrame( rafId );
	}

	function onWizardClose() {
		rafId = window.requestAnimationFrame( pollGamepads );
		populateGamepads();
	}

	document.addEventListener('DOMContentLoaded', function() {
		// initialize the emulator system and pass in the canvas
		TIA.init(television);

		populateRomsList();
		populateKeymaps();
		populateGamepads();

		// ROMs panel toggle button
		document.getElementById( 'rom-toggle-btn' ).addEventListener(
			'click',
			function( e ) {

				this.parentNode.classList.toggle( 'open' );

				populateRomsList();

				e.preventDefault();
				e.stopPropagation();
			},
			false );

		// Controller config panel toggle button
		document.getElementById( 'controls-toggle-btn' ).addEventListener(
			'click',
			function( e ) {

				this.parentNode.classList.toggle( 'open' );

				populateKeymaps();
				populateGamepads();

				e.preventDefault();
				e.stopPropagation();
			},
			false );

		// Load the ROM from the recently loaded list when the user clicks on it
		document.getElementById( 'roms-list' ).addEventListener( 'click',
			function( e ) {
				if ( e.target && e.target.dataset && e.target.dataset.index ) {

					// close the panel
					$( this ).parent().removeClass( 'open' );

					// load the ROM from local storage
					loadSavedRom( e.target.dataset.index );

					return false;
				}
			}, false );

		// toggle open the debugger window when the ` is pressed
		window.addEventListener( 'keyup', function( e ) {
			if ( e.keyCode === 192 ) {
				e.preventDefault();
				e.stopPropagation();
				toggleDebugWindow();
			}
		}, false );

		// when this page is unloaded, close the debug window if open
		window.addEventListener( 'unload', function() {
			if ( debugWindow && debugWindow instanceof Window ) {
				debugWindow.close();
			}
		}, false );


		// start and stop the emulator when the power switch is toggled
		powerSwitch.addEventListener('input', function( e ) {
			var nlist, i;

			e.stopPropagation();
			e.preventDefault();

			if (powerSwitch.value === '1') {
				if (!TIA.isStarted()) {
					// sync the console switches with the RIOT
					RIOT.setConsoleSwitch(' color', colorSwitch.value === '1' );
					RIOT.setConsoleSwitch(' select', selectSwitch.value === '1' );
					RIOT.setConsoleSwitch( 'reset', resetSwitch.value === '1' );
					RIOT.setConsoleSwitch( 'difficulty0',
						leftDifficultySwitch.value === '1' );
					RIOT.setConsoleSwitch( 'difficulty1',
						rightDifficultySwitch.value === '1' );

					// don't allow users to edit keymaps while game is running
					nlist = document.querySelectorAll( '.edit-keymap' );

					for ( i = 0; i < nlist.length; i++ ) {
						nlist[i].style.display = 'none';
					}
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

				// allow the user to edit the keymap once again
				nlist = document.querySelectorAll( '.edit-keymap' );
				for (i = 0; i < nlist.length; i++) {
					nlist[i].style.display = 'block';
				}

				// reload the ROM after initialization
				CPU6507.loadProgram( activeROM );
			}
		}, false );

		// sync the UI color switch slider with the RIOT
		colorSwitch.addEventListener( 'input', function( e ) {
			e.stopPropagation();
			e.preventDefault();

			RIOT.setConsoleSwitch( 'color', colorSwitch.value === '1' );
		}, false );

		leftDifficultySwitch.addEventListener( 'input', function( e ) {
			e.preventDefault();
			e.stopPropagation();

			RIOT.setConsoleSwitch( 'difficulty0',
				leftDifficultySwitch.value === '1' );
		}, false );

		rightDifficultySwitch.addEventListener('input', function( e ) {
			e.stopPropagation();
			e.preventDefault();

			RIOT.setConsoleSwitch( 'difficulty1',
				rightDifficultySwitch.value === '1' );
		}, false );

		// sync the UI select switch slider with the RIOT
		selectSwitch.addEventListener( 'input', function( e ) {
			e.stopPropagation();
			e.preventDefault();

			RIOT.setConsoleSwitch( 'select', selectSwitch.value === '1' );
		}, false );

		// snap the select switch back to the normally open position
		// when the user lets go of it with the mouse
		selectSwitch.addEventListener( 'mouseup', function() {
			setTimeout( function() {
				// move the switch back to the normal position
				selectSwitch.value = 1;

				// create and fire an event to simulate a normal input change
				var e = document.createEvent( 'Events' );
				e.initEvent( 'input', true, false );
				selectSwitch.dispatchEvent( e );
			}, 0 );
		}, false );

		// sync the UI reset switch with the RIOT
		resetSwitch.addEventListener('input', function( e ) {
			e.stopPropagation();
			e.preventDefault();

			RIOT.setConsoleSwitch( 'reset', resetSwitch.value === '1' );
		}, false);

		// snap the reset switch back to the normally closed position
		// when the users lets go of it with the mouse
		resetSwitch.addEventListener( 'mouseup', function() {
			setTimeout( function() {
				resetSwitch.value = 1;

				var e = document.createEvent( 'Events' );
				e.initEvent( 'input', true, false );
				resetSwitch.dispatchEvent( e );
			}, 0 );
		}, false );

		// when dragging over the cart slot, change the border color
		cartSlot.addEventListener( 'dragenter', function( e ) {
			e.preventDefault();

			cartSlot.classList.add( 'drag-over' );
			e.dataTransfer.dropEffect = 'copy';
		}, false );

		cartSlot.addEventListener( 'dragover', function( e ) {
			e.preventDefault();
		}, false );

		// change the border color back if the user drags the object
		// away from the cartridge slot
		cartSlot.addEventListener('dragleave', function( e ) {
			e.stopPropagation();
			e.preventDefault();

			cartSlot.classList.remove('drag-over');
		}, false);

		// the following is executed when the user drops a file on top
		// of the cart slot
		cartSlot.addEventListener('drop', function( e ) {
			var romFile, reader;

			e.stopPropagation();
			e.preventDefault();

			cartSlot.classList.remove('drag-over');

			if (e.dataTransfer.files.length !== 1) {
				window.alert('You can only drag one ROM file at a time.');
				return;
			}

			romFile = e.dataTransfer.files[0];
			if (romFile.size !== 2048 && romFile.size !== 4096) {
				window.alert('This file does not appear to be an acceptable ROM file.');
				return;
			}

			reader = new FileReader();

			reader.onerror = function() {
				window.alert('There was an error loading this file as a ROM.');

				cartSlot.textContent = 'Drag \'n Drop your ROMs here';
			};

			reader.onabort = function() {
				window.alert('The ROM loading procedure has been aborted.');

				cartSlot.textContent = 'Drag \'n Drop your ROMs here';
			};

			reader.onload = function( e ) {
				loadRom(romFile.name, new Uint8Array(e.target.result));
			};

			reader.readAsArrayBuffer(romFile);

		}, false);

		// fix the twitter buttons' incorrect width styles
		setTimeout(function() {
			$('.twitter-follow-button, .twitter-hashtag-button')
				.css('width', '150px');
		}, 75);

	}, false);

})(window, document);


// Included script for Twitter buttons
(function(d,s,id){
	var js,
		fjs=d.getElementsByTagName(s)[0];
	if(!d.getElementById(id)){
		js=d.createElement(s);
		js.id=id;
		js.src='//platform.twitter.com/widgets.js';
		fjs.parentNode.insertBefore(js,fjs);
	}
})(document,'script','twitter-wjs');
