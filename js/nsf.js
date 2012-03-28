Uint8Array.prototype.toString = function() {
	var s = '',
		i = 0,
		l = this.length;

	for (; i < l; i++) {
		if (this[i] === 0) {
			break;
		}
		s += String.fromCharCode(this[i]);
	}

	return s;
};

var NSF = (function(undefined) {

	var _buffer,
		_data = {},

		body,

		byteArrayToHex = function(word) {
			return (word[1] << 8) | word[0];
		};

	return {

		attr: function(name) {

			return (name in _data) ? _data[name] : undefined;

		},

		load: function(url, onload, onerror) {
			var xhr = new XMLHttpRequest();
			xhr.open('GET', url, true);
			xhr.responseType = 'arraybuffer';

			if (typeof onerror === 'function') {
				xhr.onerror = onerror;
			}

			xhr.onload = function() {
				var tmp;

				_buffer = xhr.response;

				tmp = new Uint8Array(_buffer, 0x00, 5);
				tmp = tmp.toString();
				_data.spec = tmp.substr(0, 4) === 'NESM' && tmp.charCodeAt(4) === 0x1a ? 'NESM' : 'Unknown';

				tmp = new Uint8Array(_buffer, 0x0e, 32);
				_data.name = tmp.toString();

				tmp = new Uint8Array(_buffer, 0x2e, 32);
				_data.artist = tmp.toString();

				tmp = new Uint8Array(_buffer, 0x4e, 32);
				_data.copyright = tmp.toString();

				_data.version = new Uint8Array(_buffer, 0x05, 1)[0];
				_data.numSongs = new Uint8Array(_buffer, 0x06, 1)[0];
				_data.startSong = new Uint8Array(_buffer, 0x07, 1)[0];

				tmp = new Uint8Array(_buffer, 0x7a, 1)[0];
				_data.pal = tmp & 0x02 ? 'Both' :
					tmp & 0x01 ? 'PAL' :
					'NTSC';

				if (_data.pal === 'Both' || _data.pal === 'NTSC') {
					tmp = new Uint8Array(_buffer, 0x6e, 2);
					_data.ntscRate = Math.round(1000000 / byteArrayToHex(tmp));
				}

				if (_data.pal === 'Both' || _data.pal === 'PAL') {
					tmp = new Uint8Array(_buffer, 0x78, 2);
					_data.palRate = Math.round(1000000 / byteArrayToHex(tmp));
				}

				_data.loadOffset = byteArrayToHex(new Uint8Array(_buffer, 0x08, 2));
				_data.initOffset = byteArrayToHex(new Uint8Array(_buffer, 0x0a, 2));
				_data.playOffset = byteArrayToHex(new Uint8Array(_buffer, 0x0c, 2));

				tmp = new Uint8Array(_buffer, 0x7b, 1)[0];
				_data.VRCVI = !!(tmp && 0x01);
				_data.VRCVII = !!(tmp && 0x02);
				_data.FDS = !!(tmp && 0x04);
				_data.MMC5 = !!(tmp && 0x08);
				_data.Namco = !!(tmp && 0x10);
				_data.Sunsoft = !!(tmp && 0x20);

				body = new Uint8Array(_buffer, 0x80);

				if (typeof onload === 'function') {
					onload();
				}
			};

			xhr.send();
		}

	};

})();

document.addEventListener('DOMContentLoaded', function() {

	NSF.load('/ninja_gaiden2.nsf', function() {
		output.write('Spec: ' + NSF.attr('spec'));
		output.write('Name: ' + NSF.attr('name'));
		output.write('Artist: ' + NSF.attr('artist'));
		output.write('Copyright: ' + NSF.attr('copyright'));
		output.write('Version: ' + NSF.attr('version'));
		output.write('No. of Songs: ' + NSF.attr('numSongs'));
		output.write('Starting Song: ' + NSF.attr('startSong'));
		output.write('PAL/NTSC: ' + NSF.attr('pal'));
		if (NSF.attr('ntscRate')) {
			output.write('NTSC Rate: ' + NSF.attr('ntscRate') + 'Hz');
		}
		if (NSF.attr('palRate')) {
			output.write('PAL Rate: ' + NSF.attr('palRate') + 'Hz');
		}

		output.write('Load offset: 0x' + NSF.attr('loadOffset').toString(16));
		output.write('Init offset: 0x' + NSF.attr('initOffset').toString(16));
		output.write('Play offset: 0x' + NSF.attr('playOffset').toString(16));

		if (NSF.attr('VRCVI')) {
			output.write('Extra sound chip support: VRCVI');
		}
		if (NSF.attr('VRCVII')) {
			output.write('Extra sound chip support: VRCVII');
		}
		if (NSF.attr('FDS')) {
			output.write('Extra sound chip support: FDS Sound');
		}
		if (NSF.attr('MMC5')) {
			output.write('Extra sound chip support: MMC5 audio');
		}
		if (NSF.attr('Namco')) {
			output.write('Extra sound chip support: Namco 106');
		}
		if (NSF.attr('Sunsoft')) {
			output.write('Extra sound chip support: Sunsoft FME-07');
		}

	}, function() {
		alert('Failed to load NSF file.');
	});
}, false);