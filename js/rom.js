/**
 * rom.js
 * Author: Jason T. Stoudt
 * Date: 28 March 2012
 *
 * A javascript representation of the read-only memory game cartridge
 * for the Atari 2600.
 */

function ROM( program, mmap ) {
	if (!(program instanceof Uint8Array)) {
		throw new Error('Program must be an instance of Uint8Array.');
	}

	if (!(mmap instanceof MemoryMap)) {
		throw new Error('Second parameter must be an instance of MemoryMap.');
	}

	this._program = program;
	this._mmap    = mmap;

	switch (program.length) {
		case 2048:
			this._romType = this.ROM_TYPE['2K'];
			break;
		case 4096:
			this._romType = this.ROM_TYPE['4K'];
			break;
		default:
			throw new Error('Unsupported ROM type detected');
	}

	mmap.addReadOnly(0xf000, 0xffff, function( addr ) {
		return program[addr - 0xf000];
	});
}

ROM.prototype.ROM_TYPE = {
	'2K': 1,
	'4K': 2
};

ROM.prototype.removeProgram = function() {
	var i = 0xf000;

	for (; i <= 0xffff; i++) {
		this._mmap.removeReadOnly(i);
	}

	this._mmap    = null;
	this._program = null;
};

ROM.prototype.readStartAddress = function() {
	var addr = this._romType === this.ROM_TYPE['2K'] ? 0x7fc :
		0xffc;

	return (this._program[addr + 1] << 8) | this._program[addr];
};

ROM.prototype.readBreakAddress = function() {
	var addr = this._romType === this.ROM_TYPE['2K'] ? 0x7fe :
		0xffe;

	return (this._program[addr + 1] << 8) | this._program[addr];
};

ROM.prototype.readInterruptAddress = function() {
	var addr = this._romType === this.ROM_TYPE['4K'] ? 0x7fa :
		0xffa;

	return (this._program[addr + 1] << 8) | this._program[addr];
};