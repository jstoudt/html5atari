/**
 * memory.js
 *
 * Author: Jason T. Stoudt
 * Date: 28 March 2012
 *
 * Represents the memory bus used in 6502-based systems.
 */


function MemoryMap( bitWidth ) {
	var i,
		mask = 0;

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

	for (i = 0; i < bitWidth; i++) {
		mask = (mask << 1) | 1;
	}

	// create the memory to hold the raw system data
	this._memory    = new Uint8Array(new ArrayBuffer(1 << bitWidth));
	
	this._strobes   = {};
	this._readonly  = {};
	this._writeonly = {};
	this._mirrors   = {};
	this._journal   = [];
	this._bitmask   = mask;

	// the only public property of a MemoryMap object created in this constructor
	this.length = this._memory.length;

	// initialize all registers on the system bus to zero
	for (i = 0; i < this._memory.length; i++) {
		this._memory[i] = 0;
	}
}

// Changes the memory at the specified address location to the specified value
MemoryMap.prototype.writeByte = function( val, addr ) {
	val &= 0xff;

	addr = this.resolveMirror(addr & this._bitmask);

	if (addr in this._strobes) {
		this._strobes[addr].fn();
	} else if (addr in this._writeonly) {
		this._writeonly[addr].fn(val);
	} else {
		this._memory[addr] = val;
	}
};

// Returns the byte in memory at the specified address location
MemoryMap.prototype.readByte = function( addr ) {
	addr = this.resolveMirror(addr & this._bitmask);

	if (addr in this._readonly) {
		return this._readonly[addr]();
	}

	if (addr in this._writeonly && this._writeonly[addr].read) {
		return this.readByte(this._writeonly[addr].read);
	}

	if (addr in this._strobes && this._strobes[addr].read) {
		return this.readByte(this._strobes[addr].read);
	}

	return this._memory[addr];
};

// Returns the 2-byte little-endian word stored at the specified location
MemoryMap.prototype.readWord = function( addr ) {
	var lo, hi;

	addr &= this._bitmask;

	lo = this.readByte(addr);
	hi = this.readByte((addr + 1) & 0xffff);

	return (hi << 8) | lo;
};

// Returns a deep copy of the memory beginning at the specified until
// the specified memory length
MemoryMap.prototype.getCopy = function( offset, len ) {
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

// Indicates that the byte at the specified address location is a strobe
// rather than a conventional read-write byte on the memory bus
MemoryMap.prototype.addStrobe = function( addr, fn, read ) {
	addr &= this._bitmask;

	if (!(addr in this._strobes)) {
		this._strobes[addr] = {};
	}

	this._strobes[addr].fn   = fn;
	this._strobes[addr].read = read;
};

MemoryMap.prototype.removeStrobe = function( addr ) {
	if (addr in this._strobes) {
		delete this._strobes[addr];
	}
};

MemoryMap.prototype.isStrobe = function( addr ) {
	return !!(addr in this._strobes);
};

// Marks the given address as a location to which the CPU cannot write to
// via the journalCommit function
MemoryMap.prototype.addReadOnly = function( addr, fn ) {
	addr &= this._bitmask;

	this._readonly[addr] = fn;
};

// Removes the given address as a read-only address location
MemoryMap.prototype.removeReadOnly = function( addr ) {
	if (addr in this._readonly) {
		delete this._readonly[addr];
	}
};

// returns true if the given address is in the readonly list, and false
// otherwise
MemoryMap.prototype.isReadOnly = function( addr ) {
	return !!(addr in this._readonly);
};

MemoryMap.prototype.addWriteOnly = function( addr, fn, read ) {
	addr &= this._bitmask;

	if (!(addr in this._writeonly)) {
		this._writeonly[addr] = {};
	}

	this._writeonly[addr].fn   = fn;
	this._writeonly[addr].read = read;
};

MemoryMap.prototype.removeWriteOnly = function( addr ) {
	if (addr in this._writeonly) {
		delete this._writeonly[addr];
	}
};

MemoryMap.prototype.isWriteOnly = function( addr ) {
	return !!(addr in this._writeonly);
};

MemoryMap.prototype.addMirror = function( startAddr, endAddr, offset ) {
	var addr = startAddr;

	for (; addr <= endAddr; addr++) {
		this._mirrors[addr] = offset;
	}
};

MemoryMap.prototype.resolveMirror = function( addr ) {
	if (addr in this._mirrors) {
		return addr - this._mirrors[addr];
	}

	return addr;
};

// Adds to the journal a byte to be written at a specified location
// when the next commit is executed
MemoryMap.prototype.journalAddByte = function( val, addr ) {
	this._journal.push({
		addr: addr,
		val: val
	});
};

// Clears the journal without committing its contents
MemoryMap.prototype.journalReset = function() {
	this._journal = [];
};

// Writes all the bytes in the journal to the specified address location
// and clears the journal
MemoryMap.prototype.journalCommit = function() {
	var i = 0,
		l = this._journal.length;

	for (; i < l; i++) {
		if (this.isReadOnly(this._journal[i].addr) === false) {
			this.writeByte(this._journal[i].val, this._journal[i].addr);
		}
	}

	this._journal = [];
};
