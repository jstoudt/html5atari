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
		mask = (mask << 1) | 1;
	}

	buf            = new ArrayBuffer(1 << bitWidth);
	this._memory   = new Uint8Array(buf);
	this._strobes  = [];
	this._readonly = [];
	this._journal  = [];
	this._bitmask  = mask;

	// the only public property of a MemoryMap object created in this constructor
	this.length = this._memory.length;

	// initialize all registers on the system bus to zero
	for (i = 0; i < this._memory.length; i++) {
		this._memory[i] = 0;
	}
}

// Changes the memory at the specified address location to the specified value
MemoryMap.prototype.writeByte = function(val, addr) {
	var i = 0,
		len = this._strobes.length;

	addr &= this._bitmask;

	for (; i < len; i++) {
		if (this._strobes[i].address === addr) {
			this._strobes[i].active = true;
			return;
		}
	}

	this._memory[addr] = val & 0xff;
};

// Returns the byte in memory at the specified address location
MemoryMap.prototype.readByte = function(addr) {
	addr &= this._bitmask;

	return this._memory[addr];
};

// Returns the 2-byte little-endian word stored at the specified location
MemoryMap.prototype.readWord = function(addr) {
	var lo, hi;

	addr &= this._bitmask;

	lo = this._memory[addr];
	hi = this._memory[(addr + 1) & 0xffff];

	return (hi << 8) | lo;
};

// Returns a deep copy of the memory beginning at the specified until
// the specified memory length
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

// Indicates that the byte at the specified address location is a strobe
// rather than a conventional read-write byte on the memory bus
MemoryMap.prototype.addStrobe = function(addr) {
	addr &= this._bitmask;

	this._strobes.push({
		address: addr,
		active: false
	});
};

// Indicates if the strobe at the specifed location was triggered as active
// by a write to that location
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

// Marks the strobe at the specifed location as inactive
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

// Marks the given address as a location to which the CPU cannot write to
// via the journalCommit function
MemoryMap.prototype.addReadOnly = function(addr) {
	this._readonly.push(addr);
};

// returns true if the given address is in the readonly list, and false
// otherwise
MemoryMap.prototype.isReadOnly = function(addr) {
	var i = 0,
		l = this._readonly.length;

	for (; i < l; i++) {
		if (this._readonly[i] === addr) {
			return true;
		}
	}

	return false;
};

// Adds to the journal a byte to be written at a specified location
// when the next commit is executed
MemoryMap.prototype.journalAddByte = function(val, addr) {
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


// "static" function to create the Atari memory map with it's less than
// subtle quirks and irregularities
MemoryMap.createAtariMemoryMap = function() {
	var mmap = new MemoryMap(13),
		i = 0,
		readOnlyList = [
			0x40,   // CXM0P
			0x41,   // CXM1P
			0x42,   // CXP0FB
			0x43,   // CXP1FB
			0x44,   // CXM0FB
			0x45,   // CXM1FB
			0x46,   // CXBLPF
			0x47,   // CXPPMM
			0x48,   // INPT0
			0x49,   // INPT1
			0x50,   // INPT2
			0x51,   // INPT3
			0x52,   // INPT4
			0x53,   // INPT5
			0x282,  // SWCHB
			0x283,  // SWBCNT
			0x284   // INTIM
		],
		strobeList = [
			0x02, // WSYNC
			0x03, // RSYNC
			0x10, // RESP0
			0x11, // RESP1
			0x12, // RESM0
			0x13, // RESM1
			0x14, // RESBL
			0x2a, // HMOVE
			0x2b, // HMCLR
			0x2c  // CXCLR
		],
		l = strobeList.length;

	// "Strobes" registers assigned to the TIA
	for (; i < l; i++)  {
		mmap.addStrobe(strobeList[i]);
	}

	l = readOnlyList.length;
	for (i = 0; i < l; i++) {
		mmap.addReadOnly(readOnlyList[i]);
	}

	// Randomize the bits in RAM
	for (i = 0x80; i < 0xff; i++) {
		mmap.writeByte(i, (Math.random() * 1000) & 0xff);
	}

	return mmap;
};