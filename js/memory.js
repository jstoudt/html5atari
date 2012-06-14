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
	this._strobes  = {};
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
MemoryMap.prototype.writeByte = function(val, addr, cycles) {
	var strobes = this._strobes,
		i, list;

	addr &= this._bitmask;
	val &= 0xff;

	if (addr in strobes) {
		list = strobes[addr];
		for (i = 0; i < list.length; i++) {
			list[i](val, cycles);
		}
	} else {
		this._memory[addr] = val;
	}
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
MemoryMap.prototype.addStrobeCallback = function(addr, f) {
	var strobes = this._strobes;
	addr &= this._bitmask;

	if (!(addr in strobes)) {
		strobes[addr] = [];
	}

	strobes[addr].push(f);
};

MemoryMap.prototype.removeStrobeCallback = function(addr, f) {
	var strobes = this._strobes,
		list, i;

	if (arguments.length === 1 && typeof addr === 'number') {
		if (addr in strobes) {
			delete strobes[addr];
		}
	} else if (arguments.length === 1 && typeof addr === 'function') {
		f = addr;
		for (i in strobes) {
			list = strobes[i];
			for (i = list.length - 1; i >= 0; i--) {
				if (list[i] === f) {
					list.splice(i, 1);
				}
			}
		}
	} else if (arguments.length === 2) {
		if (addr in strobes) {
			list = strobes[addr];
			for (i = list.length - 1; i >= 0; i--) {
				if (list[i] === f) {
					list.splice(i, 1);
				}
			}
		}
	}
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
MemoryMap.prototype.journalCommit = function(cycles) {
	var i = 0,
		l = this._journal.length;

	for (; i < l; i++) {
		if (this.isReadOnly(this._journal[i].addr) === false) {
			this.writeByte(this._journal[i].val, this._journal[i].addr, cycles);
		}
	}

	this._journal = [];
};
