

if (typeof webkitAudioContext === 'undefined') {
	throw new Error('Your browser does not supprt the Web Audio API.');
}

window.audioContext = new webkitAudioContext();
window.audioChannels = {};

function AudioChannel(buf) {
	this.buffer = buf;
	this.sourceNode = null;
	this.gainNode = null;
}

AudioChannel.prototype.setPlaybackRate = function(rate) {
	if (this.sourceNode) {
		this.sourceNode.playbackRate.value = rate;
	}
};

AudioChannel.prototype.setGain = function(gain) {
	if (this.gainNode) {
		this.gainNode.gain.value = gain;
	}
};

AudioChannel.prototype.play = function(rate, gain) {

	if (typeof gain === 'undefined') {
		gain = 1.0;
	}

	var context = window.audioContext;

	this.sourceNode = context.createBufferSource();
	this.gainNode = context.createGainNode();

	this.sourceNode.buffer = this.buffer;
	this.sourceNode.playbackRate.value = rate;
	this.gainNode.gain.value = gain;
	this.sourceNode.loop = true;
	this.sourceNode.connect(this.gainNode);
	this.gainNode.connect(context.destination);
	this.sourceNode.noteOn(0);
};

AudioChannel.prototype.stop = function() {
	this.sourceNode.noteOff(0);
	this.sourceNode = null;
	this.gainNode = null;
};

document.addEventListener('DOMContentLoaded', function() {

	var sqrXhr = new XMLHttpRequest(),
		triXhr = new XMLHttpRequest(),
		noiseXhr = new XMLHttpRequest();

	sqrXhr.open('GET', '/audio/sqr_1000Hz_10s.wav', true);
	triXhr.open('GET', '/audio/tri_1000Hz_10s.wav', true);
	noiseXhr.open('GET', '/audio/white_noise_23s.wav', true);
	sqrXhr.responseType = 'arraybuffer';
	triXhr.responseType = 'arraybuffer';
	noiseXhr.responseType = 'arraybuffer';

	sqrXhr.onerror = function() {
		alert('Failed to load square wave audio sample.');
	};

	triXhr.onerror = function() {
		alert('Failed to load triangle wave audio sample.');
	};

	noiseXhr.onerror = function() {
		alert('Failed to load noise audio sample.');
	};

	sqrXhr.onload = function() {

		window.audioContext.decodeAudioData(sqrXhr.response, function(buffer) {

			audioChannels.squareChannel1 = new AudioChannel(buffer);
			var sqr1Slider     = document.getElementById('sqr-1-freq-slider'),
				sqr1Text       = document.getElementById('sqr-1-freq-text'),
				sqr1Play       = document.getElementById('sqr-1-play'),
				sqr1Stop       = document.getElementById('sqr-1-stop'),
				sqr1Gain       = document.getElementById('sqr-1-gain-slider'),
				sqr1GainText   = document.getElementById('sqr-1-gain-text'),
				controls       = [sqr1Slider, sqr1Text, sqr1Play, sqr1Stop, sqr1Gain, sqr1GainText],
				i              = 0;

			for (; i < controls.length; i++) {
				controls[i].removeAttribute('disabled');
			}

			sqr1Text.value = sqr1Slider.value;
			sqr1GainText.value = sqr1Gain.value;
			sqr1Slider.addEventListener('change', function() {
				var rate = parseFloat(sqr1Slider.value) / 1000;
				audioChannels.squareChannel1.setPlaybackRate(rate);
				sqr1Text.value = sqr1Slider.value;
			}, false);

			sqr1Gain.addEventListener('change', function() {
				var gain = parseFloat(sqr1Gain.value);
				audioChannels.squareChannel1.setGain(gain);
				sqr1GainText.value = sqr1Gain.value;
			}, false);

			sqr1Play.addEventListener('click', function() {
				var rate = parseFloat(sqr1Slider.value) / 1000;
				audioChannels.squareChannel1.play(rate);
				sqr1Play.style.display = 'none';
				sqr1Stop.style.display = '';
			}, false);

			sqr1Stop.addEventListener('click', function() {
				audioChannels.squareChannel1.stop();
				sqr1Stop.style.display = 'none';
				sqr1Play.style.display = '';
			}, false);

			audioChannels.squareChannel2 = new AudioChannel(buffer);
			var sqr2Slider    = document.getElementById('sqr-2-freq-slider'),
				sqr2Text      = document.getElementById('sqr-2-freq-text'),
				sqr2Play      = document.getElementById('sqr-2-play'),
				sqr2Stop      = document.getElementById('sqr-2-stop'),
				sqr2Gain      = document.getElementById('sqr-2-gain-slider'),
				sqr2GainText  = document.getElementById('sqr-2-gain-text');

			controls = [ sqr2Slider, sqr2Text, sqr2Play, sqr2Stop, sqr2Gain, sqr2GainText ];

			for (i = 0; i < controls.length; i++) {
				controls[i].removeAttribute('disabled');
			}
			
			sqr2Text.value = sqr2Slider.value;
			sqr2GainText.value = sqr2Gain.value;
			sqr2Slider.addEventListener('change', function() {
				var rate = parseFloat(sqr2Slider.value) / 1000;
				audioChannels.squareChannel2.setPlaybackRate(rate);
				sqr2Text.value = sqr2Slider.value;
			}, false);

			sqr2Gain.addEventListener('change', function() {
				var gain = parseFloat(sqr2Gain.value);
				audioChannels.squareChannel2.setGain(gain);
				sqr2GainText.value = sqr2Gain.value;
			}, false);

			sqr2Play.addEventListener('click', function() {
				var rate = parseFloat(sqr2Slider.value) / 1000;
				audioChannels.squareChannel2.play(rate);
				sqr2Play.style.display = 'none';
				sqr2Stop.style.display = '';
			}, false);

			sqr2Stop.addEventListener('click', function() {
				audioChannels.squareChannel2.stop();
				sqr2Stop.style.display = 'none';
				sqr2Play.style.display = '';
			}, false);

		});

	};

	triXhr.onload = function() {

		window.audioContext.decodeAudioData(triXhr.response, function(buffer) {

			audioChannels.triangleChannel = new AudioChannel(buffer);

			var triSlider     = document.getElementById('tri-freq-slider'),
				triText       = document.getElementById('tri-freq-text'),
				triPlay       = document.getElementById('tri-play'),
				triStop       = document.getElementById('tri-stop'),
				controls      = [ triSlider, triText, triPlay, triStop ],
				i             = 0;

			for (; i < controls.length; i++) {
				controls[i].removeAttribute('disabled');
			}

			triText.value = triSlider.value;
			triSlider.addEventListener('change', function() {
				var rate = parseFloat(triSlider.value) / 1000;
				triText.value = triSlider.value;
				audioChannels.triangleChannel.setPlaybackRate(rate);
			}, false);

			triPlay.addEventListener('click', function() {
				var rate = parseFloat(triSlider.value) / 1000;
				audioChannels.triangleChannel.play(rate);
				triPlay.style.display = 'none';
				triStop.style.display = '';
			}, false);

			triStop.addEventListener('click', function() {
				audioChannels.triangleChannel.stop();
				triStop.style.display = 'none';
				triPlay.style.display = '';
			}, false);
			
		});

	};

	noiseXhr.onload = function() {

		window.audioContext.decodeAudioData(noiseXhr.response, function(buffer) {

			audioChannels.noiseChannel = new AudioChannel(buffer);

			var noiseSlider = document.getElementById('noise-freq-slider'),
				noiseText = document.getElementById('noise-freq-text'),
				noisePlay = document.getElementById('noise-play'),
				noiseStop = document.getElementById('noise-stop'),
				noiseGain = document.getElementById('noise-gain-slider'),
				noiseGainText = document.getElementById('noise-gain-text'),
				controls = [ noiseSlider, noiseText, noisePlay, noiseStop, noiseGain, noiseGainText ],
				i = 0;

			for (; i < controls.length; i++) {
				controls[i].removeAttribute('disabled');
			}

			noiseText.value = noiseSlider.value;
			noiseGainText.value = noiseGain.value;

			noiseSlider.addEventListener('change', function() {
				var rate = parseFloat(noiseSlider.value) / 1000;
				audioChannels.noiseChannel.setPlaybackRate(rate);
				noiseText.value = noiseSlider.value;
			}, false);

			noiseGain.addEventListener('change', function() {
				var gain = parseFloat(noiseGain.value);
				audioChannels.noiseChannel.setGain(gain);
				noiseGainText.value = noiseGain.value;
			}, false);

			noisePlay.addEventListener('click', function() {
				var rate = parseFloat(noiseSlider.value) / 1000;
				audioChannels.noiseChannel.play(rate);
				noisePlay.style.display = 'none';
				noiseStop.style.display = '';
			}, false);

			noiseStop.addEventListener('click', function() {
				audioChannels.noiseChannel.stop();
				noiseStop.style.display = 'none';
				noisePlay.style.display = '';
			}, false);

		});

	};

	sqrXhr.send();
	triXhr.send();
	noiseXhr.send();

}, false);