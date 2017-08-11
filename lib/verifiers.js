"use strict";

const tcpping = require("tcp-ping");
const log = require("./logger");
const http = require("http");

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

class HTTPVerifier extends Verifier {
	constructor(ip, hostname) {
		super(ip);
		this.hostname = hostname;
	}
	verify() {
		try {
			const t = this;
			const start = new Date();
			let retries = 0;
			function once() {
				if (retries > 5) {
					t.verified = true;
					t.time = -1;
					return;
				}
				retries += 1;
				const req = http.request(
					{
						host: t.ip,
						hostname: t.ip,
						path: "/",
						headers: {
							Host: t.hostname
						}
					},
					res => {
						t.verified = true;
						t.time = new Date() - start;
					}
				);

				req.on("error", once);
				req.end();
			}
			once();
		} catch (e) {}
	}
}

exports.Verifier = Verifier;
exports.TCPVerifier = TCPVerifier;
exports.HTTPVerifier = HTTPVerifier;

exports.fromString = function(manner, ip, domain) {
	if (typeof manner === "string") {
		if (manner === "tcp") {
			return new TCPVerifier(ip);
		} else {
			return new Verifier(ip);
		}
	} else if (manner.by === "http") {
		return new HTTPVerifier(ip, manner.hostname || domain);
	} else {
		return new Verifier(ip);
	}
};
