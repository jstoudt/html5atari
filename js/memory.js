/**
 * memory.js
 *
 * Author: Jason T. Stoudt
 * Date: 28 March 2012
 *
 * Represents the memory bus used in 6502-based systems.
 */


function MemoryMap(bitWidth) {
	var buf,
		mask = 0,
		i = 0;

	if (typeof bitWidth === 'undefined') {
		throw new Error('Bit width has not been specified.');
	}
	if (typeof bitWidth !== 'number') {
		throw new Error('Bit width must be of type number.');
	}
	if (bitWidth < 1) {
		throw new Error('Bit width must be a positive integer.');
	}
	if (bitWidth > 16) {
		throw new Error('Memory cannot be greater than 64k');
	}

	bitWidth = Math.round(bitWidth);

	for (; i < bitWidth; i++) {
		mask <<= 1;
		mask |= 1;
	}

	buf = new ArrayBuffer(1 << bitWidth);
	this._memory = new Uint8Array(buf);
	this._strobes = [];
	this._journal = [];
	this._bitmask = mask;

	// the only public property of a MemoryMap object created in this constructor
	this.length = this._memory.length;
}

MemoryMap.prototype.writeByte = function(val, addr) {
	var i = 0,
		len = this._strobes.length;

	addr &= this._bitmask;

	val &= 0xff;

	for (; i < len; i++) {
		if (this._strobes[i].address === addr) {
			this._strobes[i].active = true;
			return;
		}
	}

	this._memory[addr] = val;
};

MemoryMap.prototype.writeWord = function(val, addr) {
	var lo = val & 0xff,
		hi = (val >>> 8) & 0xff;

	this.writeByte(lo, addr);
	this.writeByte(hi, (addr + 1) & 0xffff);
};

MemoryMap.prototype.readByte = function(addr) {
	addr &= this._bitmask;

	return this._memory[addr];
};

MemoryMap.prototype.readWord = function(addr) {
	var lo, hi;

	addr &= this._bitmask;

	lo = this._memory[addr];
	hi = this._memory[(addr + 1) & 0xffff];

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
		copy[i] = this._memory[(i + offset) & 0xffff];
	}

	return copy;
};

MemoryMap.prototype.addStrobe = function(addr) {
	addr &= this._bitmask;

	this._strobes.push({
		address: addr,
		active: false
	});
};

MemoryMap.prototype.isStrobeActive = function(addr) {
	var i = 0,
		strobes = this._strobes,
		len = strobes.length;

	addr &= this._bitmask;

	for (; i < len; i++) {
		if (strobes[i].address === addr) {
			return strobes[i].active;
		}
	}

	throw new Error('The address specified has not been added as a strobe.');
};

MemoryMap.prototype.resetStrobe = function(addr) {
	var i = 0,
		strobes = this._strobes,
		len = strobes.length;

	addr &= this._bitmask;

	for (; i < len; i++) {
		if (strobes[i].address === addr) {
			strobes[i].active = false;
			return;
		}
	}

	throw new Error('The address specified has not been added as a strobe');
};

MemoryMap.prototype.journalAddByte = function(addr, val) {
	this._journal.push({
		addr: addr,
		val: val
	});
};

MemoryMap.prototype.journalAddWord = function(addr, val) {
	addr &= this._bitmask;

	this._journal.push({
		addr: addr,
		val: val & 0xff
	});

	this._journal.push({
		addr: (addr + 1) & 0xffff,
		val: (val >>> 8) & 0xff
	});
};

MemoryMap.prototype.journalGet = function() {
	return this._journal;
};

MemoryMap.prototype.journalCommit = function() {
	var i = 0,
		l = this._journal.length;

	for (; i < l; i++) {
		this.writeByte(this._journal[i].addr, this._journal[i].val);
	}

	this._journal = [];
};


// "static" function to create the Atari memory map with it's less than
// subtle quirks and irregularities
MemoryMap.createAtariMemoryMap = function() {
	var mmap = new MemoryMap(13);
	
	mmap.addStrobe(0x02);
	mmap.addStrobe(0x03);

	return mmap;
};