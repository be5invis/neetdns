"use strict";

const util = require("./util");
const providers = require("./providers");
const log = require("./logger");
const packet = require("native-dns-packet");

const CacheMap = require("./cachemap");
const verifiers = require("./verifiers");

const zones = new CacheMap(1000);

const TTL_UPDATE_IPS = 100;

class IP {
	constructor(ip) {
		this.ip = ip;
		this.verified = null;
		this.time = -1;
	}
	verify() {
		this.verified = new Date();
	}
}

class TCPPingVerifyIP extends IP {
	constructor(ip) {
		super(ip);
	}
	verify() {
		this.verifyPort(80);
		this.verifyPort(443);
		this.verifyPort(8080);
	}
	verifyPort(port) {
		const t = this;
		tcpping.ping({ address: this.ip, port: port, attempts: 5, timeout: 5000 }, function(err, data) {
			if (err) {
				log.debug(err);
			}
			t.verified = new Date();
			if (data.min !== undefined) {
				t.time = data.min;
			}
		});
	}
}

const byTime = (a, b) => {
	if (a.time >= 0 && b.time >= 0) return a.time - b.time;
	else if (a.time >= 0) return -1;
	else if (b.time >= 0) return 1;
	else return 0;
};

class Zone {
	constructor(domain) {
		this.created = new Date();
		this.ips = new Map();
		this.domain = domain;
	}
	hasVerifiedData() {
		for (let v of this.ips.values()) {
			if (v.verified) return true;
		}
		return false;
	}
	getBest() {
		let candidates = Array.from(this.ips).map(x => x[1]).filter(v => v.verified).sort(byTime);
		return candidates[0];
	}

	verify(data, manner) {
		const resp = packet.parse(data);
		if (!resp.answer) return;
		for (let v of resp.answer) {
			if (!v.address) continue;
			if (this.ips.has(v.address)) continue;
			const item = verifiers.fromString(v.address, manner);
			this.ips.set(v.address, item);
			item.verify();
		}
	}
}

module.exports = function(hostConfig, timeout, message) {
	const query = packet.parse(message);
	const domain = query.question[0].name;
	const zoneName = hostConfig.zoneName || domain;

	let zone = null;
	let justCreated = false;
	if (zones.has(zoneName)) {
		zone = zones.get(zoneName);
	} else {
		zone = new Zone(zoneName);
		zones.set(zoneName, zone);
		justCreated = true;
	}

	let pendingData = null;

	if (justCreated || Date.now() - zone.created >= TTL_UPDATE_IPS * 1000) {
		const gotcha = function(data) {
			if (!pendingData) pendingData = util.overrideTTL(data);
			zone.verify(data, hostConfig.verifyManner || "tcp");
		};
		const sorry = function(why) {};
		const prvs = providers.configToProviders(hostConfig.sources);
		for (let p of prvs) {
			p.query(message, timeout).then(gotcha).catch(sorry);
		}
	}

	return new Promise((resolve, reject) => {
		let n = 0;
		function verifyAndReturn() {
			const hasVerified = zone.hasVerifiedData();
			if (hasVerified) {
				let best = zone.getBest();
				log.debug("Picked %s (%d) for %s", best.ip, best.time, domain);
				resolve(util.createAnswer(query, best.ip));
				return;
			} else if (n < 3) {
				n += 1;
				setTimeout(verifyAndReturn, 1000);
			} else if (pendingData) {
				resolve(pendingData);
			} else {
				reject("Timeout");
			}
		}
		verifyAndReturn();
	});
};
