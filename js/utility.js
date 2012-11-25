/**
 * utility.js
 */

var Utility = {

	// A mapping from keycode to a description of that key -- used in key
	// event handlers
	KEYCODES: {
		8:   'backspace',
		9:   'tab',
		13:  'enter',
		16:  'shift',
		17:  'ctrl',
		18:  'alt',
		19:  'pause/break',
		20:  'caps lock',
		27:  'escape',
		32:  'space',
		33:  'page up',
		34:  'page down',
		35:  'end',
		36:  'home',
		37:  'left arrow',
		38:  'up arrow',
		39:  'right arrow',
		40:  'down arrow',
		45:  'insert',
		46:  'delete',
		48:  '0',
		49:  '1',
		50:  '2',
		51:  '3',
		52:  '4',
		53:  '5',
		54:  '6',
		55:  '7',
		56:  '8',
		57:  '9',
		65:  'a',
		66:  'b',
		67:  'c',
		68:  'd',
		69:  'e',
		70:  'f',
		71:  'g',
		72:  'h',
		73:  'i',
		74:  'j',
		75:  'k',
		76:  'l',
		77:  'm',
		78:  'n',
		79:  'o',
		80:  'p',
		81:  'q',
		82:  'r',
		83:  's',
		84:  't',
		85:  'u',
		86:  'v',
		87:  'w',
		88:  'x',
		89:  'y',
		90:  'z',
		91:  'left meta',
		92:  'right meta',
		93:  'select',
		96:  'numpad 0',
		97:  'numpad 1',
		98:  'numpad 2',
		99:  'numpad 3',
		100: 'numpad 4',
		101: 'numpad 5',
		102: 'numpad 6',
		103: 'numpad 7',
		104: 'numpad 8',
		105: 'numpad 9',
		106: 'numpad *',
		107: 'numpad +',
		109: 'numpad -',
		110: 'numpad .',
		111: 'numpad /',
		112: 'f1',
		113: 'f2',
		114: 'f3',
		115: 'f4',
		116: 'f5',
		117: 'f6',
		118: 'f7',
		119: 'f8',
		120: 'f9',
		121: 'f10',
		122: 'f11',
		123: 'f12',
		144: 'num lock',
		145: 'scroll lock',
		186: ';',
		187: '=',
		188: ',',
		189: '-',
		190: '.',
		191: '/',
		192: '`',
		219: '[',
		220: '\\',
		221: ']',
		222: '\''
	},

	MEM_LOCATIONS: {
		// TIA Sync registers
		VSYNC:  0x00,		VBLANK: 0x01,
		WSYNC:  0x02,		RSYNC:  0x03,

		// TIA Graphics registers
		NUSIZ0: 0x04,		NUSIZ1: 0x05,
		COLUP0: 0x06,		COLUP1: 0x07,
		COLUPF: 0x08,		COLUBK: 0x09,
		CTRLPF: 0x0a,
		REFP0:  0x0b,		REFP1:  0x0c,
		PF0:    0x0d,		PF1:    0x0e,		PF2:    0x0f,
		RESP0:  0x10,		RESP1:  0x11,
		RESM0:  0x12,		RESM1:  0x13,
		RESBL:  0x14,

		// TIA audio registers
		AUDC0:  0x15,		AUDC1:  0x16,
		AUDF0:  0x17,		AUDF1:  0x18,
		AUDV0:  0x19,		AUDV1:  0x1a,

		// TIA Graphics registers
		GRP0:   0x1b,		GRP1:   0x1c,
		ENAM0:  0x1d,		ENAM1:  0x1e,
		ENABL:  0x1f,
		HMP0:   0x20,		HMP1:   0x21,
		HMM0:   0x22,		HMM1:   0x23,
		HMBL:   0x24,
		VDELP0: 0x25,		VDELP1: 0x26,
		VDELBL: 0x27,
		RESMP0: 0x28,		RESMP1: 0x29,
		HMOVE:  0x2a,		HMCLR:  0x2b,
		CXCLR:  0x2c,

		// Port A data register for joysticks
		// bits 4-7 for P0, bits 0-3 for P1
		SWCHA:  0x280,
		SWACNT: 0x281,  // Port A data direction register

		SWCHB:  0x282,  // Port B data (console switches)
		SWBCNT: 0x283,  // Port B data direction register

		INTIM:  0x284,  // the read register
		TIMINT: 0x285,  // seems to be 0x00 until the timer expires, then 0x80

		// the various input registers for setting the timer
		TIM1T:  0x294,
		TIM8T:  0x295,
		TIM64T: 0x296,
		T1024T: 0x297
	},

	// The controller configuration initially given to a new user
	DEFAULT_KEYMAP: [
		{
			input: 'keyboard',
			fire:  32,
			up:    87,
			left:  65,
			right: 68,
			down:  83
		}, {
			input: 'keyboard',
			fire:  13,
			up:    38,
			left:  37,
			right: 39,
			down:  40
		}
	],

	// A NOP function
	VOID: function() { },

	// A utility for encoding and decoding Uint8Array objects to base64 strings
	Base64: {
		encode: function( uint8array ) {
			var str = '',
				i = 0;

			for (; i < uint8array.length; i++) {
				str += String.fromCharCode(uint8array[i]);
			}

			return str;
		},

		decode: function( str ) {
			var i = 0,
				l = str.length,
				uint8array = new Uint8Array(new ArrayBuffer(l));

			for (; i < l; i++) {
				uint8array[i] = str.charCodeAt(i);
			}

			return uint8array;
		}
	}

};

// A shim for requestAnimationFrame and cancelAnimationFrame
window.requestAnimationFrame = window.requestAnimationFrame ||
	window.webkitRequestAnimationFrame ||
	window.mozRequestAnimationFrame ||
	window.oRequestAnimationFrame ||
	window.msRequestAnimationFrame;

window.cancelAnimationFrame = window.cancelAnimationFrame ||
	window.webkitCancelAnimationFrame ||
	window.mozCancelAnimationFrame ||
	window.oCancelAnimationFrame ||
	window.msCancelAnimationFrame;
