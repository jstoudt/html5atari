/**
 * utility.js
 */

// A mapping from keycode to a description of that key -- used in key
// event handlers
var KEYCODES = {
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
};

// A utility for encoding and decoding Uint8Array objects to base64 strings
var Base64 = {
	encode: function( input ) {
		var output = '',
			i = 0,
			l = input.length;

		for (; i < l; i++) {
			output += String.fromCharCode(input[i]);
		}

		return window.btoa(output);
	},

	decode: function( input ) {
		var i = 0,
			len, output;

		input = window.atob(input);
		l = input.length;
		output = new Uint8Array(new ArrayBuffer(l));

		for (; i < l; i++) {
			output[i] = input.charCodeAt(i);
		}

		return output;
	}
};