"use strict";

const util = require("../util");
const providers = require("../providers");
const log = require("../logger");
const packet = require("native-dns-packet");

const CacheMap = require("../cachemap");
const verifiers = require("../verifiers");

const TTL_BUCKET = 3600;
const TTL_UPDATE_IPS = 60;
const TTL_UPDATE_VERIFY = 300;

const zones = new CacheMap(TTL_BUCKET);

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
		let filt = candidates
			.filter(v => v.time >= 0 && v.time <= candidates[0].time * 1.5)
			.map(v => v.ip);
		if (filt.length) {
			return filt;
		} else {
			return [candidates[0].ip];
		}
	}

	verify(data, manner) {
		const resp = packet.parse(data);
		if (!resp.answer) return;
		for (let v of resp.answer) {
			if (!v.address) continue;
			if (this.ips.has(v.address)) {
				const item = this.ips.get(v.address);
				if (
					item.verified &&
					!item.pending &&
					new Date() - item.verified >= TTL_UPDATE_VERIFY * 1000
				) {
					item.verify();
				}
			} else {
				const item = verifiers.fromString(manner, v.address, this.domain);
				this.ips.set(v.address, item);
				item.verify();
			}
		}
	}
}

exports.reload = function() {
	zones.clear();
};

exports.handle = function(hostConfig, timeout, message) {
	const query = packet.parse(message);
	const domain = query.question[0].name;
	const zoneName = hostConfig.zoneName || domain;
	log.debug("Domain = ", domain);
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
				resolve(util.createAnswer(query, best));
			} else if (n < 3) {
				n += 1;
				setTimeout(verifyAndReturn, 1000);
			} else if (pendingData) {
				resolve(pendingData);
			} else {
				log.debug("Timeout for", domain);
				reject("Timeout");
			}
		}
		verifyAndReturn();
	});
};
