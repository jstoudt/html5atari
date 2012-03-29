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
	if (size > (1 << 16)) {
		throw new Error('Memory size cannot be greater than 64k');
	}

	this.__buf = new ArrayBuffer(size);
	this._memory = new Uint8Array(this.__buf);
	this.strobes = [];
	this.length = this._memory.length;
}

MemoryMap.prototype._isAddressValid = function(addr) {
	if (addr >= this.length || addr < 0) {
		throw new Error('Illegal memory address specified');
	}
};

MemoryMap.prototype.writeByte = function(val, addr) {
	var i = 0,
		len = this.strobes.length;

	this._isAddressValid(addr);

	val &= 0xff;
	this._memory[addr] = val;

	for (; i < len; i++) {
		if (this.strobes[i].address === addr) {
			this.strobes[i].active = true;
		}
	}

};

MemoryMap.prototype.writeWord = function(val, addr) {
	var lo = val & 0xff,
		hi = (val >>> 8) & 0xff;

	this.writeByte(lo, addr);
	this.writeByte(hi, (addr + 1) & 0xffff);
};

MemoryMap.prototype.readByte = function(addr) {
	this._isAddressValid(addr);

	return this._memory[addr];
};

MemoryMap.prototype.readWord = function(addr) {
	var lo, hi;
	
	lo = this.readByte(addr);
	hi = this.readByte((addr + 1) & 0xffff);

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

MemoryMap.prototype.addStrobe = function(addr) {
	this._isAddressValid(addr);

	this.strobes.push({
		address: addr,
		active: false
	});
};

MemoryMap.prototype.checkStrobe = function(addr) {
	var i = 0,
		len = this.strobes.length;

	this._isAddressValid(addr);

	for (; i < len; i++) {
		if (this.strobes[i].address === addr) {
			return this.strobes[i].active;
		}
	}

	return false;

};

MemoryMap.prototype.resetStrobe = function(addr) {
	var i = 0,
		len = this.strobes.length;

	this._isAddressValid(addr);

	for (; i < len; i++) {
		this.strobes[i].active = false;
	}

};