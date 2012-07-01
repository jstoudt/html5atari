/**
 * memory.js
 *
 * Author: Jason T. Stoudt
 * Date: 28 March 2012
 *
 * Represents the memory bus used in 6502-based systems.
 */

function MemoryMap( bitWidth ) {
	this._readwrite = {};
	this._mirrors   = {};
	this._journal   = [];
}

// Changes the memory at the specified address location to the specified value
MemoryMap.prototype.writeByte = function( val, addr ) {
	if (addr in this._mirrors) {
		addr = this.resolveMirror(addr);
	}

	if (addr in this._readwrite) {
		this._readwrite[addr].write(val, addr);
	} else {
		console.warn('Writing to unsupported memory address: $' +
			Number(addr).toString(16));
	}
};

// Returns the byte in memory at the specified address location
MemoryMap.prototype.readByte = function( addr ) {
	if (addr in this._mirrors) {
		addr = this.resolveMirror(addr);
	}

	if (addr in this._readwrite) {
		return this._readwrite[addr].read(addr);
	}

	throw new Error('Cannot read from unsupported memory address: $' +
		Number(addr).toString(16));
};

// Returns the 2-byte little-endian word stored at the specified location
MemoryMap.prototype.readWord = function( addr ) {
	var lo = this.readByte(addr),
		hi = this.readByte((addr + 1) & 0xffff);

	return (hi << 8) | lo;
};

MemoryMap.prototype.addReadWrite = function( startAddr, endAddr, readFn, writeFn ) {
	var i = startAddr;

	if (arguments.length === 3 && typeof endAddr === 'function') {
		writeFn = readFn;
		readFn  = endAddr;
		endAddr = startAddr;
	}

	for (; i <= endAddr; i++) {
		this._readwrite[i] = {
			read:  readFn,
			write: writeFn
		};
	}
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
	var i = startAddr;

	for (; i <= endAddr; i++) {
		this._mirrors[i] = offset;
	}
};

MemoryMap.prototype.resolveMirror = function( addr ) {
	return addr in this._mirrors ? (addr - this._mirrors[addr]) & 0xffff :
		addr;
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
		this.writeByte(this._journal[i].val, this._journal[i].addr);
	}

	this._journal = [];
};
