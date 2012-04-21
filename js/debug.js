(function() {

	var TIA          = opener.TIA,
		RIOT         = opener.RIOT,
		CPU6507      = opener.CPU6507,

		pauseButton  = document.getElementById('pause-button'),
		stepButton   = document.getElementById('step-button'),
		i            = 0,

		tiaTime0     = Date.now(),
		tiaCycles0   = TIA.getCycleCount(),
		tiaFrames0   = TIA.getNumFrames(),
		tiaFrequency = document.getElementById('tia-frequency'),
		frameRate    = document.getElementById('frame-rate'),

		instructions = document.getElementById('instructions'),

		ac           = document.getElementById('ac'),
		x            = document.getElementById('x'),
		y            = document.getElementById('y'),
		sp           = document.getElementById('sp'),
		pc           = document.getElementById('pc'),

		pixelClock   = document.getElementById('x-pos'),
		scanline     = document.getElementById('y-pos'),

		timerMode    = document.getElementById('timer-mode'),
		intim        = document.getElementById('intim'),
		timint       = document.getElementById('timint'),
		timer        = document.getElementById('timer'),

		p0difficulty = document.getElementById('p0-difficulty'),
		p1difficulty = document.getElementById('p1-difficulty'),
		tvType       = document.getElementById('tv-type'),
		selectSwitch = document.getElementById('select'),
		resetSwitch  = document.getElementById('reset'),

		memTable     = document.getElementById('memory'),
		cells        = memTable.getElementsByTagName('td'),
		memCells     = [],
		
		reqAnimFrame = window.requestAnimationFrame ||
			window.webkitRequestAnimationFrame ||
			window.mozRequestAnimationFrame ||
			(function fRAF(f) {
				setTimeout(f, Math.floor(1000 / 60));
			})(),

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
			progCounter     = CPU6507.getRegister('pc'),
			status          = CPU6507.getRegister('sr'),
			mem             = TIA.getMemoryCopy(0x80, 128),
			len             = mem.length,
			beamPosition    = TIA.getBeamPosition(),
			timerInfo       = RIOT.getTimerRegisters(),
			consoleSwitches = RIOT.getConsoleSwitches(),

			toHex  = function(hex, digits) {
				hex = hex.toString(16);
				while (hex.length < digits) {
					hex = '0' + hex;
				}
				return hex;
			};

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
			memCells[i].textContent = toHex(mem[i], 2);
		}

		list = instructions.querySelectorAll('tr');
		len = list.length;
		for (i = 0; i < len; i++) {
			tr = list[i];
			dataAddr = parseInt(tr.getAttribute('data-addr'), 10);
			if (dataAddr === progCounter) {
				tr.classList.add('active');
				tr.scrollIntoViewIfNeeded();
			} else {
				tr.classList.remove('active');
			}
		}

		timerMode.textContent = timerInfo.timerMode;
		intim.textContent     = timerInfo.intim.toString(16);
		timint.textContent    = timerInfo.timint.toString(16);
		timer.textContent     = timerInfo.timer.toString(16);

		p0difficulty.textContent = consoleSwitches.p0difficulty;
		p1difficulty.textContent = consoleSwitches.p1difficulty;
		tvType.textContent       = consoleSwitches.color;
		selectSwitch.textContent = consoleSwitches.select;
		resetSwitch.textContent  = consoleSwitches.reset;

		reqAnimFrame(showInfo);
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

		setTimeout(calcCycleRate, 1000);
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
		// list any instructions from the program loaded in the CPU
		listInstructions(CPU6507.getProgram());

		// list the program instructions when a new ROM is loaded
		CPU6507.addEventListener('load', listInstructions);

		if (TIA.isStarted()) {
			pauseButton.removeAttribute('disabled');
			pauseButton.textContent = 'Pause';
			stepButton.setAttribute('disabled', 'disabled');
		}

		TIA.addEventListener('start', function() {
			pauseButton.removeAttribute('disabled');
			pauseButton.textContent = 'Pause';
			stepButton.setAttribute('disabled', 'disabled');
		});

		TIA.addEventListener('stop', function() {
			pauseButton.removeAttribute('disabled');
			stepButton.removeAttribute('disabled');
			pauseButton.textContent = 'Resume';
		});

		// start calculating the clock and frame rates
		calcCycleRate();

		// show the emulator info each frame
		reqAnimFrame(showInfo);

		// close the window when the ` key is pressed
		window.addEventListener('keyup', function(event) {
			if (event.keyCode === 192) {
				window.close();
			}
		}, false);

		pauseButton.addEventListener('click', function(e) {
			e.stopPropagation();
			e.preventDefault();
			if (TIA.isStarted()) {
				TIA.stop();
			} else {
				TIA.start();
			}
		}, false);

		stepButton.addEventListener('click', function(e) {
			e.stopPropagation();
			e.preventDefault();
			TIA.step();
		}, false);

	}, false);

})();