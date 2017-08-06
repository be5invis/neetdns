"use strict";

class CacheEntry {
	constructor(v) {
		this.value = v;
		this.created = Date.now();
	}
}

class CacheMap {
	constructor(ttl) {
		this.ttl = ttl;
		this.items = new Map();
		setInterval(() => this.check(), this.ttl * 1000);
	}
	has(k) {
		return this.items.has(k);
	}
	get(k) {
		return this.items.get(k).value;
	}
	set(k, v) {
		return this.items.set(k, new CacheEntry(v));
	}

	check() {
		const now = new Date();
		let m1 = new Map();
		for (let [k, v] of this.items) {
			if (now - v < this.ttl * 1000) {
				m1.set(k, v);
			}
		}
		this.items = m1;
	}
	clear() {
		this.items = new Map();
	}
}

module.exports = CacheMap;
