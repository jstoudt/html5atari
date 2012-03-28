/**
 * memory.js
 *
 * Author: Jason T. Stoudt
 * Date: 28 March 2012
 *
 * Represents the memory bus used in 6502-based systems.
 */


function MemoryMap(size) {
	if (typeof size === 'undefined') {
		throw new Error('Memory size has not been specified.');
	}
	if (typeof size !== 'number') {
		throw new Error('Memory size must be of type number.');
	}
	if (size < 1) {
		throw new Error('Memory size must be a positive integer.');
	}

	this._badAddrMsg = 'Illegal memory address specified.';
	this.__buf = new ArrayBuffer(size);
	this._memory = new Uint8Array(this.__buf);
	this.length = this.__buf.length;
}

MemoryMap.prototype.writeByte = function(val, addr) {
	if (addr >= this.length || addr < 0) {
		throw new Error(this._badAddrMsg);
	}

	val &= 0xff;
	this._memory[addr] = val;
};

MemoryMap.prototype.writeWord = function(val, addr) {
	var lo = val & 0xff,
		hi = (val >>> 8) & 0xff;

	if (addr >= this.length || addr < 0) {
		throw new Error(this._badAddrMsg);
	}

	this._memory[addr] = lo;
	addr = (addr + 1) & 0xffff;
	this._memory[addr] = hi;
};

MemoryMap.prototype.readByte = function(addr) {
	if (addr >= this.length || addr < 0) {
		throw new Error(this._badAddrMsg);
	}

	return this._memory[addr];
};

MemoryMap.prototype.readWord = function(addr) {
	var hi, lo;

	if (addr >= this.length || addr < 0) {
		throw new Error(this._badAddrMsg);
	}

	lo = this._memory[addr];
	addr = (addr + 1) & 0xffff;
	hi = this._memory[addr];

	return (hi << 8) | lo;
};

MemoryMap.prototype.getCopy = function(offset, len) {
	var buf,
		copy,
		i = 0;

	if (typeof offset === 'undefined') {
		offset = 0;
	}
	if (typeof len === 'undefined') {
		len = this.length;
	}

	buf = new ArrayBuffer(len);
	copy = new Uint8Array(buf);

	for (; i < len; i++) {
		copy[i] = this._memory[i + offset];
	}

	return copy;
};