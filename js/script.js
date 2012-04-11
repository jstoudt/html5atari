(function() {

	var ac           = document.getElementById('ac'),
		x            = document.getElementById('x'),
		y            = document.getElementById('y'),
		sp           = document.getElementById('sp'),
		pc           = document.getElementById('pc'),
		memTable     = document.getElementById('memory'),
		cells        = memTable.getElementsByTagName('td'),
		television   = document.getElementById('television'),
		debugPanel   = document.getElementById('debug-panel'),
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
				tr.scrollIntoView();
			} else {
				tr.classList.remove('active');
			}
		}

		if (breakFlag !== true) {
			reqAnimFrame(showInfo);
		}
	}

	function calcCycleRate() {

		var tiaTime1   = Date.now(),
			tiaCycles1 = TIA.getCycleCount(),
			tiaFrames1 = TIA.getNumFrames();

		tiaFrequency.innerHTML = Math.round((tiaCycles1 - tiaCycles0) / (tiaTime1 - tiaTime0)) / 1e3;

		frameRate.innerHTML = Math.round((tiaFrames1 - tiaFrames0) / (tiaTime1 - tiaTime0) * 1e6) / 1000;

		tiaCycles0 = tiaCycles1;
		tiaTime0   = tiaTime1;
		tiaFrames0 = tiaFrames1;

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

		CPU6507.addEventListener('load', listInstructions);

		var xhr = new XMLHttpRequest();
		xhr.open('GET', 'rom/bin/Boxing.bin', true);
		xhr.responseType = 'arraybuffer';

		xhr.onerror = function() {
			alert('Failed to load resource.');
		};

		xhr.onload = function() {

			var startBtn     = document.getElementById('start'),
				stopBtn      = document.getElementById('stop'),
				resetBtn     = document.getElementById('reset'),
				stepBtn      = document.getElementById('step');

			CPU6507.loadProgram(new Uint8Array(xhr.response));

			startBtn.removeAttribute('disabled');
			startBtn.addEventListener('click', function() {
				startBtn.setAttribute('disabled', 'disabled');
				stopBtn.removeAttribute('disabled');
				resetBtn.setAttribute('disabled', 'disabled');
				stepBtn.setAttribute('disabled', 'disabled');

				breakFlag = false;
				started = true;

				// start the magic
				TIA.start();

			}, false);

			stopBtn.addEventListener('click', function() {
				TIA.stop();
				breakFlag = true;
				started = false;
				stopBtn.setAttribute('disabled', 'disabled');
				startBtn.removeAttribute('disabled');
				resetBtn.removeAttribute('disabled');
				stepBtn.removeAttribute('disabled');
			}, false);

			resetBtn.removeAttribute('disabled');
			resetBtn.addEventListener('click', function() {
				TIA.init(television);
				breakFlag = true;
				started = false;
				CPU6507.loadProgram(new Uint8Array(xhr.response));
			}, false);

			stepBtn.removeAttribute('disabled');
			stepBtn.addEventListener('click', function() {
				TIA.step();
				showInfo();
				calcCycleRate();
				breakFlag = true;
				started = false;
			}, false);

		};

		xhr.send();

		window.addEventListener('keyup', function(event) {
			if (event.keyCode === 192) {
				if (debugPanel.classList.contains('open')) {
					debugPanel.classList.remove('open');
					breakFlag = true;
					delete localStorage['debug'];
				} else {
					debugPanel.classList.add('open');
					breakFlag = ~started;
					showInfo();
					calcCycleRate();
					localStorage['debug'] = 'open';
				}
			}
		}, false);

		// open the debug panel if it was open previously
		if (localStorage['debug'] === 'open') {
			debugPanel.classList.add('open');
			showInfo();
			calcCycleRate();
		}

	}, false);

})();

/*
(function skipAhead() { if (CPU6507.getRegister('pc') !== 0xf3d6) { document.getElementById('step').click(); t = setTimeout(skipAhead, 10); } })();
*/