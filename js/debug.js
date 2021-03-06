(function( window, document, undefined ) {

	var TIA          = opener.TIA,
		RIOT         = opener.RIOT,
		CPU6507      = opener.CPU6507,

		pauseButton  = document.getElementById('pause-button'),
		stepButton   = document.getElementById('step-button'),
		scanButton   = document.getElementById('scan-button'),
		frameButton  = document.getElementById('frame-button'),

		tiaTime0     = Date.now(),
		tiaFrames0   = TIA.getNumFrames(),
		frameRate    = document.getElementById('frame-rate'),
		cpuCycles    = document.getElementById('cpu-cycle-count'),

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

		colup0       = document.getElementById('colup0'),
		p0swatch     = document.getElementById('p0-swatch'),
		grp0         = document.getElementById('grp0'),
		oldGrp0      = document.getElementById('old-grp0'),
		refp0        = document.getElementById('refp0'),
		vdelp0       = document.getElementById('vdelp0'),
		nusiz0       = document.getElementById('nusiz0'),
		p0pos        = document.getElementById('p0pos'),
		p0move       = document.getElementById('p0move'),

		colup1       = document.getElementById('colup1'),
		p1swatch     = document.getElementById('p1-swatch'),
		grp1         = document.getElementById('grp1'),
		oldGrp1      = document.getElementById('old-grp1'),
		refp1        = document.getElementById('refp1'),
		vdelp1       = document.getElementById('vdelp1'),
		nusiz1       = document.getElementById('nusiz1'),
		p1pos        = document.getElementById('p1pos'),
		p1move       = document.getElementById('p1move'),

		pfcolor      = document.getElementById('pf-color'),
		pfswatch     = document.getElementById('pf-swatch'),
		pf0          = document.getElementById('pf0'),
		pf1          = document.getElementById('pf1'),
		pf2          = document.getElementById('pf2'),
		pfreflect    = document.getElementById('pf-reflect'),
		pfscore      = document.getElementById('pf-score'),
		pfpriority   = document.getElementById('pf-priority'),

		blenabled    = document.getElementById('blenabled'),
		blpos        = document.getElementById('blpos'),
		blmove       = document.getElementById('blmove'),
		blsize       = document.getElementById('blsize'),
		bldelay      = document.getElementById('bldelay'),

		m0enabled    = document.getElementById('m0enabled'),
		m0pos        = document.getElementById('m0pos'),
		m0move       = document.getElementById('m0move'),
		m0size       = document.getElementById('m0size'),
		m0reset      = document.getElementById('m0reset'),

		m1enabled    = document.getElementById('m1enabled'),
		m1pos        = document.getElementById('m1pos'),
		m1move       = document.getElementById('m1move'),
		m1size       = document.getElementById('m1size'),
		m1reset      = document.getElementById('m1reset'),

		cxList = {
			'p0-pf': document.getElementById('p0-pf'),
			'p0-bl': document.getElementById('p0-bl'),
			'p0-m1': document.getElementById('p0-m1'),
			'p0-m0': document.getElementById('p0-m1'),
			'p0-p1': document.getElementById('p0-p1'),
			'p1-pf': document.getElementById('p1-pf'),
			'p1-bl': document.getElementById('p1-bl'),
			'p1-m1': document.getElementById('p1-m1'),
			'p1-m0': document.getElementById('p1-m0'),
			'm0-pf': document.getElementById('m0-pf'),
			'm0-bl': document.getElementById('m0-bl'),
			'm0-m1': document.getElementById('m0-m1'),
			'm1-pf': document.getElementById('m1-pf'),
			'm1-bl': document.getElementById('m1-bl'),
			'bl-pf': document.getElementById('bl-pf')
		},

		p0Fire       = document.getElementById('p0-fire'),
		p0Up         = document.getElementById('p0-up'),
		p0Left       = document.getElementById('p0-left'),
		p0Right      = document.getElementById('p0-right'),
		p0Down       = document.getElementById('p0-down'),

		p1Fire       = document.getElementById('p1-fire'),
		p1Up         = document.getElementById('p1-up'),
		p1Left       = document.getElementById('p1-left'),
		p1Right      = document.getElementById('p1-right'),
		p1Down       = document.getElementById('p1-down'),

		memTable     = document.getElementById('memory'),
		cells        = memTable.getElementsByTagName('td'),
		memCells     = [],

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

	function toHex(val, digits) {
		var fill;

		if (typeof val === 'number') {
			val = val.toString(16);
			fill = '0';
		} else {
			val  = '';
			fill = '-';
		}
		
		while (val.length < digits) {
			val = fill + val;
		}
		return val;
	}

	function toBinary(val, digits) {
		var fill;

		if (typeof val === 'number') {
			val = val.toString(2);
			fill = '0';
		} else {
			val  = '';
			fill = '-';
		}
		
		while (val.length < digits) {
			val = fill + val;
		}
		return val;
	}

	function showInfo() {
		var list, tr, dataAddr, playerInfo, missleInfo,
			collisionInfo, joystickInfo, inputInfo,
			i               = 0,
			progCounter     = CPU6507.getRegister('pc'),
			status          = CPU6507.getRegister('sr'),
			mem             = RIOT.getRAM(),
			len             = mem.length,
			beamPosition    = TIA.getBeamPosition(),
			timerInfo       = RIOT.getTimerRegisters(),
			consoleSwitches = RIOT.getConsoleSwitches(),
			playfieldInfo   = TIA.getPlayfieldInfo(),
			ballInfo        = TIA.getBallInfo();

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

		cpuCycles.textContent = Math.floor(TIA.getCycleCount() / 3);

		pixelClock.textContent = beamPosition.x;
		scanline.textContent   = beamPosition.y;

		for (; i < len; i++) {
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
		intim.textContent     = toHex(timerInfo.intim, 2);
		timint.textContent    = toHex(timerInfo.timint, 2);
		timer.textContent     = toHex(timerInfo.timer >= 0 ? timerInfo.timer :
			(0xffffffff + timerInfo.timer + 1), 2);

		p0difficulty.checked = consoleSwitches.p0difficulty;
		p1difficulty.checked = consoleSwitches.p1difficulty;
		tvType.checked       = consoleSwitches.color;
		selectSwitch.checked = consoleSwitches.select;
		resetSwitch.checked  = consoleSwitches.reset;

		playerInfo = TIA.getPlayerInfo(0);
		colup0.textContent             = toHex(playerInfo.color, 2);
		p0swatch.style.backgroundColor = 'rgb(' + playerInfo.rgb[0] + ',' + playerInfo.rgb[1] + ',' + playerInfo.rgb[2] + ')';
		grp0.textContent               = toBinary(playerInfo.graphics, 8);
		oldGrp0.textContent            = toBinary(playerInfo.oldGraphics, 8);
		refp0.checked                  = playerInfo.reflect;
		vdelp0.checked                 = playerInfo.delay;
		nusiz0.textContent             = toHex(playerInfo.nusiz, 1);
		p0pos.textContent              = toHex(playerInfo.position, 2);
		p0move.textContent             = toHex(playerInfo.hmove, 1);
		
		playerInfo = TIA.getPlayerInfo(1);
		colup1.textContent             = toHex(playerInfo.color, 2);
		p1swatch.style.backgroundColor = 'rgb(' + playerInfo.rgb[0] + ',' + playerInfo.rgb[1] + ',' + playerInfo.rgb[2] + ')';
		grp1.textContent               = toBinary(playerInfo.graphics, 8);
		oldGrp1.textContent            = toBinary(playerInfo.oldGraphics, 8);
		refp1.checked                  = playerInfo.reflect;
		vdelp1.checked                 = playerInfo.delay;
		nusiz1.textContent             = toHex(playerInfo.nusiz, 1);
		p1pos.textContent              = toHex(playerInfo.position, 2);
		p1move.textContent             = toHex(playerInfo.hmove, 1);
		
		pfcolor.textContent = toHex(playfieldInfo.color, 2);
		pfswatch.style.backgroundColor = 'rgb(' + playfieldInfo.rgb[0] + ',' + playfieldInfo.rgb[1] + ',' + playfieldInfo.rgb[2] + ')';
		pf0.textContent                = toBinary(playfieldInfo.pf0, 4);
		pf1.textContent                = toBinary(playfieldInfo.pf1, 8);
		pf2.textContent                = toBinary(playfieldInfo.pf2, 8);
		pfreflect.checked              = playfieldInfo.reflect;
		pfscore.checked                = playfieldInfo.score;
		pfpriority.checked             = playfieldInfo.priority;

		blenabled.checked  = ballInfo.enabled;
		blpos.textContent  = toHex(ballInfo.position);
		blmove.textContent = toHex(ballInfo.hmove);
		blsize.textContent = toHex(ballInfo.size);
		bldelay.checked    = ballInfo.delay;

		missleInfo = TIA.getMissleInfo(0);
		m0enabled.checked      = missleInfo.enabled;
		m0pos.textContent      = toHex(missleInfo.position, 2);
		m0move.textContent     = toHex(missleInfo.hmove, 1);
		m0size.textContent     = toHex(missleInfo.size, 1);
		m0reset.checked        = missleInfo.reset;

		missleInfo = TIA.getMissleInfo(1);
		m1enabled.checked      = missleInfo.enabled;
		m1pos.textContent      = toHex(missleInfo.position, 2);
		m1move.textContent     = toHex(missleInfo.hmove, 1);
		m1size.textContent     = toHex(missleInfo.size, 1);
		m1reset.checked        = missleInfo.reset;

		collisionInfo = TIA.getCollisionInfo();
		for (i in collisionInfo) {
			cxList[i].checked = collisionInfo[i];
		}

		inputInfo = TIA.getInputInfo();

		joystickInfo = RIOT.getJoystickInfo(0);
		p0Up.checked    = joystickInfo.up;
		p0Left.checked = joystickInfo.left;
		p0Right.checked = joystickInfo.right;
		p0Down.checked = joystickInfo.down;
		p0Fire.checked = inputInfo[4];

		joystickInfo = RIOT.getJoystickInfo(1);
		p1Up.checked = joystickInfo.up;
		p1Left.checked = joystickInfo.left;
		p1Right.checked = joystickInfo.right;
		p1Down.checked = joystickInfo.down;
		p1Fire.checked = inputInfo[5];

		reqAnimFrame(showInfo);
	}

	function calcCycleRate() {
		var tiaTime1   = Date.now(),
			tiaFrames1 = TIA.getNumFrames();

		frameRate.innerHTML = Math.round((tiaFrames1 - tiaFrames0) / (tiaTime1 - tiaTime0) * 1e6) / 1000;

		tiaTime0   = tiaTime1;
		tiaFrames0 = tiaFrames1;

		setTimeout(calcCycleRate, 1000);
	}

	function listInstructions( program ) {
		function createColumn( str, cname, row) {
			var td = document.createElement('td');

			td.innerHTML = str;
			td.className = cname;
			row.appendChild(td);
		}


		var i, item, tr;
			
		for (i in program) {
			item = program[i];

			tr = document.createElement('tr');
			tr.setAttribute('data-addr', item.offset);

			createColumn(item.offset_str, 'offset', tr);
			createColumn(item.op_abbr, 'abbr', tr);
			createColumn(item.operand, 'operand', tr);
			createColumn(';' + item.cycles, 'cycles', tr);
			
			instructions.appendChild(tr);

			stepButton.removeAttribute('disabled');
			scanButton.removeAttribute('disabled');
			frameButton.removeAttribute('disabled');
		}
	}

	document.addEventListener('DOMContentLoaded', function() {
		// list any instructions from the program loaded in the CPU
		listInstructions(CPU6507.getProgram());

		// list the program instructions when a new ROM is loaded
//		CPU6507.addEventListener('load', listInstructions);

		if (TIA.isStarted()) {
			pauseButton.removeAttribute('disabled');
			pauseButton.textContent = 'Pause';
			stepButton.setAttribute('disabled', 'disabled');
			scanButton.setAttribute('disabled', 'disabled');
			frameButton.setAttribute('disabled', 'disabled');
		}

		TIA.addEventListener('start', function() {
			pauseButton.removeAttribute('disabled');
			pauseButton.textContent = 'Pause';
			stepButton.setAttribute('disabled', 'disabled');
			scanButton.setAttribute('disabled', 'disabled');
			frameButton.setAttribute('disabled', 'disabled');
		});

		TIA.addEventListener('stop', function() {
			pauseButton.removeAttribute('disabled');
			stepButton.removeAttribute('disabled');
			scanButton.removeAttribute('disabled');
			frameButton.removeAttribute('disabled');
			pauseButton.textContent = 'Resume';
		});

		// start calculating the clock and frame rates
		calcCycleRate();

		// show the emulator info each frame
		reqAnimFrame(showInfo);

		// close the window when the ` key is pressed
		window.addEventListener('keyup', function( event ) {
			if (event.keyCode === 192) {
				window.close();
			}
		}, false);

		pauseButton.addEventListener('click', function( event ) {
			event.stopPropagation();
			event.preventDefault();
			if (TIA.isStarted()) {
				TIA.stop();
			} else {
				TIA.start();
			}
		}, false);

		stepButton.addEventListener('click', function( event ) {
			event.stopPropagation();
			event.preventDefault();
			TIA.step();
		}, false);

		scanButton.addEventListener('click', function(event) {
			var scanline = TIA.getBeamPosition().y;

			event.stopPropagation();
			event.preventDefault();

			while (TIA.getBeamPosition().y === scanline) {
				TIA.step();
			}
		}, false);

		frameButton.addEventListener('click', function( event ) {
			var frame = TIA.getNumFrames();

			event.preventDefault();
			event.stopPropagation();

			while (frame === TIA.getNumFrames()) {
				TIA.step();
			}
		}, false);

	}, false);

})(window, document);