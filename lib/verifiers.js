"use strict";

const tcpping = require("tcp-ping");
const log = require("./logger");
const http = require("http");

const ATTEMPTS = 5;
const TIMEOUT = 10;

class Verifier {
	constructor(ip) {
		this.ip = ip;
		this.verified = null;
		this.pending = false;
		this.time = -1;
	}
	verifyStart() {
		this.pending = true;
	}
	verifyEnd() {
		this.pending = false;
	}
	verifyFail() {
		this.time = -1;
		this.verified = new Date();
		this.verifyEnd();
	}
	verifySuccess(time) {
		this.time = time;
		this.verified = new Date();
		this.verifyEnd();
	}
	verify() {
		this.verifyStart();
		this.verifyFail();
	}
}
class AcceptVerifier extends Verifier {
	constructor(ip) {
		super(ip);
	}
	verify() {
		this.verifyStart();
		this.verifySuccess(1);
	}
}

class TCPVerifier extends Verifier {
	constructor(ip) {
		super(ip);
	}
	verify() {
		this.verifyStart();
		this.verifyPort(80);
		this.verifyPort(443);
		this.verifyPort(8080);
	}
	verifyPort(port) {
		const t = this;
		tcpping.ping(
			{
				address: this.ip,
				port: port,
				attempts: ATTEMPTS,
				timeout: 1000 * TIMEOUT
			},
			function(err, data) {
				if (err) log.debug(err);
				if (data.min !== undefined) {
					const valids = data.results.filter(t => t.time && t.time < data.min * 2);
					t.verifySuccess(data.min * Math.pow(2, Math.max(0, ATTEMPTS - valids.length)));
				} else {
					t.verifyFail();
				}
			}
		);
	}
}

class HTTPVerifier extends Verifier {
	constructor(ip, hostname) {
		super(ip);
		this.hostname = hostname;
	}
	verify() {
		this.verifyStart();
		try {
			const t = this;
			const start = new Date();
			let retries = 0;
			function once() {
				if (retries > ATTEMPTS) {
					t.verifyFail();
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
						},
						timeout: 1000 * TIMEOUT
					},
					res => {
						t.verifySuccess(new Date() - start);
					}
				);

				req.on("error", once);
				req.end();
			}
			once();
		} catch (e) {}
	}
}

exports.fromString = function(manner, ip, domain) {
	if (typeof manner === "string") {
		if (manner === "tcp") {
			return new TCPVerifier(ip);
		} else if (manner === "http") {
			return new HTTPVerifier(ip, domain);
		} else if (manner === "yes") {
			return new AcceptVerifier(ip);
		} else {
			return new Verifier(ip);
		}
	} else if (manner.by === "http") {
		return new HTTPVerifier(ip, manner.hostname || domain);
	} else {
		return new Verifier(ip);
	}
};
