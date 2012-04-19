/**
 * script.js
 *
 * Date: 19 April 2012
 * Defines page functionality and ties the Atari 2600 script into
 * the page DOM.
 */


(function() {

	var	debugPanel   = document.getElementById('debug-panel'),
		ac           = document.getElementById('ac'),
		x            = document.getElementById('x'),
		y            = document.getElementById('y'),
		sp           = document.getElementById('sp'),
		pc           = document.getElementById('pc'),
		pixelClock   = document.getElementById('x-pos'),
		scanline     = document.getElementById('y-pos'),
		memTable     = document.getElementById('memory'),
		cells        = memTable.getElementsByTagName('td'),
		television   = document.getElementById('television'),
		cartSlot     = document.getElementById('cart-slot'),
		tiaTime0     = Date.now(),
		tiaCycles0   = TIA.getCycleCount(),
		tiaFrames0   = TIA.getNumFrames(),
		tiaFrequency = document.getElementById('tia-frequency'),
		frameRate    = document.getElementById('frame-rate'),
		instructions = document.getElementById('instructions'),
		memCells     = [],
		scrollDown   = null,
		i            = 0,
		breakFlag    = true,
		started      = false,

		sr = {
			N: document.getElementById('N'),
			V: document.getElementById('V'),
			B: document.getElementById('B'),
			D: document.getElementById('D'),
			I: document.getElementById('I'),
			Z: document.getElementById('Z'),
			C: document.getElementById('C')
		};

	for (; i < cells.length; i++) {
		if (cells[i].className !== 'leftcol') {
			memCells.push(cells[i]);
		}
	}

	function showInfo() {
		var list, tr, i, dataAddr,
			progCounter = CPU6507.getRegister('pc'),
			status = CPU6507.getRegister('sr'),
			mem    = TIA.getMemoryCopy(0x80, 128),
			len    = mem.length,
			beamPosition = TIA.getBeamPosition(),
			toHex  = function(hex, digits) {
				hex = hex.toString(16);
				while (hex.length < digits) {
					hex = '0' + hex;
				}
				return hex;
			},
			reqAnimFrame = window.requestAnimationFrame ||
				window.mozRequestAnimationFrame ||
				window.webkitRequestAnimationFrame;

		ac.innerHTML = toHex(CPU6507.getRegister('ac'), 2);
		x.innerHTML  = toHex(CPU6507.getRegister('x'), 2);
		y.innerHTML  = toHex(CPU6507.getRegister('y'), 2);
		sp.innerHTML = toHex(CPU6507.getRegister('sp'), 2);
		pc.innerHTML = toHex(progCounter, 2);

		sr.N.innerHTML = status & 0x80 ? 1 : 0;
		sr.V.innerHTML = status & 0x40 ? 1 : 0;
		sr.B.innerHTML = status & 0x10 ? 1 : 0;
		sr.D.innerHTML = status & 0x08 ? 1 : 0;
		sr.I.innerHTML = status & 0x04 ? 1 : 0;
		sr.Z.innerHTML = status & 0x02 ? 1 : 0;
		sr.C.innerHTML = status & 0x01 ? 1 : 0;

		pixelClock.textContent = beamPosition.x;
		scanline.textContent   = beamPosition.y;

		for (i = 0; i < len; i++) {
			memCells[i].innerHTML = toHex(mem[i], 2);
		}

		list = instructions.querySelectorAll('tr');
		len = list.length;
		for (i = 0; i < len; i++) {
			tr = list[i];
			dataAddr = parseInt(tr.getAttribute('data-addr'), 10);
			if (dataAddr === progCounter) {
				tr.classList.add('active');
				if (tr.offsetTop < instructions.scrollTop || tr.offsetTop > instructions.scrollTop + instructions.offsetHeight) {
					tr.scrollIntoView();
				}
			} else {
				tr.classList.remove('active');
			}
		}
	}

	function calcCycleRate() {
		var tiaTime1, tiaCycles1, tiaFrames1;

		if (debugPanel.classList.contains('open')) {
			tiaTime1   = Date.now();
			tiaCycles1 = TIA.getCycleCount();
			tiaFrames1 = TIA.getNumFrames();

			tiaFrequency.innerHTML = Math.round((tiaCycles1 - tiaCycles0) / (tiaTime1 - tiaTime0)) / 1e3;

			frameRate.innerHTML = Math.round((tiaFrames1 - tiaFrames0) / (tiaTime1 - tiaTime0) * 1e6) / 1000;

			tiaCycles0 = tiaCycles1;
			tiaTime0   = tiaTime1;
			tiaFrames0 = tiaFrames1;
		}

		if (breakFlag !== true) {
			setTimeout(calcCycleRate, 1000);
		}
	}

	function listInstructions(program) {
		var i, item, tr,
			tbody = instructions.querySelector('tbody'),
			createCol = function(str, cname, row) {
				var td = document.createElement('td');
				td.innerHTML = str;
				td.className = cname;
				row.appendChild(td);
			};
			
		for (i in program) {
			item = program[i];

			tr = document.createElement('tr');
			tr.setAttribute('data-addr', item.offset);

			createCol(item.offset_str, 'offset', tr);
			createCol(item.op_abbr, 'abbr', tr);
			createCol(item.operand, 'operand', tr);
			createCol(';' + item.cycles, 'cycles', tr);
			
			tbody.appendChild(tr);
		}
	}

	document.addEventListener('DOMContentLoaded', function() {

		TIA.init(television);

		window.addEventListener('keyup', function(event) {
			if (event.keyCode === 192) {
				if (debugPanel.classList.contains('open')) {
					debugPanel.classList.remove('open');
					delete localStorage['debug'];
				} else {
					debugPanel.classList.add('open');
					showInfo();
					localStorage['debug'] = 'open';
				}
			}
		}, false);

		// open the debug panel if it was open previously
		if (localStorage['debug'] === 'open') {
			debugPanel.classList.add('open');
			showInfo();
		}

		// when dragging over the cart-slot, change the border color
		cartSlot.addEventListener('dragover', function(event) {
			event.stopPropagation();
			event.preventDefault();
			cartSlot.classList.add('dragging');
			event.dataTransfer.dropEffect = 'copy';
		}, false);

		// change the border color back
		cartSlot.addEventListener('dragleave', function(event) {
			event.stopPropagation();
			event.preventDefault();
			cartSlot.classList.remove('dragging');
		}, false);

		cartSlot.addEventListener('drop', function(event) {
			var romFile;

			event.stopPropagation();
			event.preventDefault();
			cartSlot.classList.remove('dragging');
			
			if (event.dataTransfer.files.length !== 1) {
				return;
			}

			romFile = event.dataTransfer.files[0];
			if (romFile.size !== 2048 && romFile.size !== 4096) {
				alert('This file does not appear to be an acceptable ROM file.');
				return;
			}

			cartSlot.innerHTML = 'Loading ' + escape(romFile.name) + '&hellip;';

		}, false);

	}, false);

})();

/*
(function skipAhead() { if (CPU6507.getRegister('pc') !== 0xf3d6) { document.getElementById('step').click(); t = setTimeout(skipAhead, 10); } })();
*/