/**
 * memory.js
 *
 * Author: Jason T. Stoudt
 * Date: 28 March 2012
 *
 * Represents the memory bus used in 6502-based systems.
 */


function MemoryMap( bitWidth ) {
	var i = 0,
		len = 1 << 16;

	this._strobes   = {};
	this._readonly  = {};
	this._writeonly = {};
	this._readwrite = {};
	this._mirrors   = {};
	this._journal   = [];
}

// Changes the memory at the specified address location to the specified value
MemoryMap.prototype.writeByte = function( val, addr ) {
	if (addr in this._mirrors) {
		addr = this.resolveMirror(addr);
	}

	if (addr in this._strobes) {
		this._strobes[addr].fn();
	} else if (addr in this._writeonly) {
		this._writeonly[addr].fn(val & 0xff);
	} else if (addr in this._readwrite) {
		this._readwrite[addr].writeFn(val, addr);
	} else {
		throw new Error('Writing to unsupported memory address.');
	}
};

// Returns the byte in memory at the specified address location
MemoryMap.prototype.readByte = function( addr ) {
	if (addr in this._mirrors) {
		addr = this.resolveMirror(addr);
	}

	if (addr in this._readonly) {
		return this._readonly[addr]();
	}

	if (addr in this._writeonly && this._writeonly[addr].read) {
		return this.readByte(this._writeonly[addr].read);
	}

	if (addr in this._readwrite) {
		return this._readwrite[addr]();
	}

	if (addr in this._strobes && this._strobes[addr].read) {
		return this.readByte(this._strobes[addr].read);
	}

	throw new Error('Reading from unsupported memory address.');
};

// Returns the 2-byte little-endian word stored at the specified location
MemoryMap.prototype.readWord = function( addr ) {
	var lo = this.readByte(addr),
		hi = this.readByte((addr + 1) & 0xffff);

	return (hi << 8) | lo;
};

// Indicates that the byte at the specified address location is a strobe
// rather than a conventional read-write byte on the memory bus
MemoryMap.prototype.addStrobe = function( addr, fn, read ) {
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

MemoryMap.prototype.addReadWrite = function( addr, readFn, writeFn ) {
	if (!(addr in this._readwrite)) {
		this._readwrite[addr] = {};
	}

	this._readwrite[addr].read  = readFn;
	this._readwrite[addr].write = writeFn;
};

MemoryMap.prototype.isReadWrite = function( addr ) {
	return !!(addr in this._readwrite);
};

MemoryMap.prototype.removeReadWrite = function( addr ) {
	if (addr in this._readwrite) {
		delete this._readwrite[addr];
	}
};

MemoryMap.prototype.addMirror = function( startAddr, endAddr, offset ) {
	var addr = startAddr;

	for (; addr <= endAddr; addr++) {
		this._mirrors[addr] = offset;
	}
};

MemoryMap.prototype.resolveMirror = function( addr ) {
	if (addr in this._mirrors) {
		return (addr - this._mirrors[addr]) & 0xffff;
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
