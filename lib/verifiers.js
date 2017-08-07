"use strict";

const tcpping = require("tcp-ping");
const log = require("./logger");

const ATTEMPTS = 5;

class Verifier {
	constructor(ip) {
		this.ip = ip;
		this.verified = null;
		this.time = -1;
	}
	verify() {
		this.verified = new Date();
	}
}

class TCPVerifier extends Verifier {
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
		tcpping.ping({ address: this.ip, port: port, attempts: ATTEMPTS, timeout: 10000 }, function(
			err,
			data
		) {
			if (err) {
				log.debug(err);
			}
			t.verified = new Date();
			if (data.min !== undefined) {
				const valids = data.results.filter(t => t.time && t.time < data.min * 2);
				t.time = data.min * Math.pow(2, Math.max(0, ATTEMPTS - valids.length));
				log.debug("  Verified %s => %d", t.ip, t.time);
			}
		});
	}
}

exports.Verifier = Verifier;
exports.TCPVerifier = TCPVerifier;

exports.fromString = function(ip, manner) {
	if (manner === "tcp") {
		return new TCPVerifier(ip);
	} else {
		return new Verifier(ip);
	}
};
