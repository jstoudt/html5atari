(function() {

	var ac           = document.getElementById('ac'),
		x            = document.getElementById('x'),
		y            = document.getElementById('y'),
		sp           = document.getElementById('sp'),
		pc           = document.getElementById('pc'),
		memTable     = document.getElementById('memory'),
		cells        = memTable.getElementsByTagName('td'),
		television   = document.getElementById('television'),
		tiaTime0     = Date.now(),
		tiaCycles0   = TIA.getCycleCount(),
		tiaFrames0   = TIA.getNumFrames(),
		tiaFrequency = document.getElementById('tia-frequency'),
		frameRate    = document.getElementById('frame-rate'),
		instructions = document.getElementById('instructions');
		memCells     = [],
		scrollDown   = null,
		i            = 0,

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
		var i      = 0,
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
		pc.innerHTML = toHex(CPU6507.getRegister('pc'), 2);

		sr.N.innerHTML = status & 0x80 ? 1 : 0;
		sr.V.innerHTML = status & 0x40 ? 1 : 0;
		sr.B.innerHTML = status & 0x10 ? 1 : 0;
		sr.D.innerHTML = status & 0x08 ? 1 : 0;
		sr.I.innerHTML = status & 0x04 ? 1 : 0;
		sr.Z.innerHTML = status & 0x02 ? 1 : 0;
		sr.C.innerHTML = status & 0x01 ? 1 : 0;

		for (; i < len; i++) {
			memCells[i].innerHTML = toHex(mem[i], 2);
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

	function listInstruction(inst) {
		var option     = document.createElement('option'),
			html       = '',
			getPadding = function(text, size) {
				var n = size - text.length,
					i = 0;
				for (; i < n; i++) {
					text += '&nbsp;';
				}
				return text;
			};

		html += getPadding(inst.offset.toString(16).toUpperCase(), 14);
		html += getPadding(inst.abbr, 7);
		html += getPadding(inst.operand || '', 10);
		html += ';' + inst.cycles;

		option.innerHTML = html;

		instructions.appendChild(option);

		if (scrollDown !== null) {
			clearTimeout(scrollDown);
			scrollDown = null;
		}

		scrollDown = setTimeout(function() {
			instructions.scrollTop = instructions.scrollHeight;
		}, 0);
	}

	document.addEventListener('DOMContentLoaded', function() {

		TIA.init(television);

		var xhr = new XMLHttpRequest();
		xhr.open('GET', 'rom/bin/Combat.bin', true);
		xhr.responseType = 'arraybuffer';

		xhr.onerror = function() {
			alert('Failed to load resource.');
		};

		xhr.onload = function() {

			var prog         = new Uint8Array(xhr.response),
				startBtn     = document.getElementById('start'),
				stopBtn      = document.getElementById('stop'),
				resetBtn     = document.getElementById('reset'),
				stepBtn      = document.getElementById('step');

			CPU6507.loadProgram(prog, 0xf000);

			startBtn.removeAttribute('disabled');
			startBtn.addEventListener('click', function() {
				startBtn.setAttribute('disabled', 'disabled');
				stopBtn.removeAttribute('disabled');
				resetBtn.setAttribute('disabled', 'disabled');
				stepBtn.setAttribute('disabled', 'disabled');

				// start the magic
				TIA.start();

				// monitor the magic as it happens
				breakFlag = false;
				showInfo();
				calcCycleRate();

			}, false);

			stopBtn.addEventListener('click', function() {
				TIA.stop();
				stopBtn.setAttribute('disabled', 'disabled');
				startBtn.removeAttribute('disabled');
				resetBtn.removeAttribute('disabled');
				stepBtn.removeAttribute('disabled');
				breakFlag = true;
			}, false);

			resetBtn.removeAttribute('disabled');
			resetBtn.addEventListener('click', function() {
				TIA.init(television);
				CPU6507.loadProgram(prog, 0xf000);
			}, false);

			stepBtn.removeAttribute('disabled');
			stepBtn.addEventListener('click', function() {
				breakFlag = true;
				TIA.step();
				showInfo();
			}, false);

		};

		xhr.send();

		window.addEventListener('keyup', function(event) {
			var debugPanel;

			if (event.keyCode === 192) {
				debugPanel = document.getElementById('debug-panel');
				if (debugPanel.classList.contains('open')) {
					CPU6507.removeEventListener('execloop', listInstruction);
					debugPanel.classList.remove('open');
					breakFlag = true;
				} else {
					CPU6507.addEventListener('execloop', listInstruction);
					debugPanel.classList.add('open');
					breakFlag = false;
					showInfo();
					calcCycleRate();
				}
			}
		}, false);

	}, false);

})();