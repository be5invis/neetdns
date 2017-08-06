"use strict";

const dgram = require("dgram");
const util = require("./util.js");
const log = require("./logger");
const packet = require("native-dns-packet");

class ServerProvider {
	constructor(server, port) {
		this.server = server;
		this.port = port;
	}
	query(message, timeout) {
		const sock = dgram.createSocket("udp4");
		let sockClosed = false;
		function closeSocket() {
			if (!sockClosed) {
				sockClosed = true;
				sock.close();
			}
		}
		const { port, server } = this;
		return new Promise(function(resolve, reject) {
			sock.send(message, 0, message.length, port, server);
			sock.on("error", err => {
				closeSocket();
				reject(err);
			});
			sock.on("message", function(response) {
				log.query("PRIMARY, nameserver: %s, answer: %s", server, util.listAnswer(response));
				resolve(response);
				closeSocket();
			});
			setTimeout(function() {
				closeSocket();
				reject("TIMEOUT");
			}, timeout);
		});
	}
}

ServerProvider.fromString = function(name) {
	const nameParts = name.split(":");
	const nameserver = nameParts[0];
	const port = nameParts[1] || 53;
	return new ServerProvider(name, port);
};

class HostsProvider {
	constructor(ip) {
		this.ip = ip;
	}
	async query(message, timeout) {
		return util.createAnswer(packet.parse(message), this.ip);
	}
}

HostsProvider.fromString = function(ip) {
	return new HostsProvider(ip);
};

exports.ServerProvider = ServerProvider;
exports.HostsProvider = HostsProvider;

exports.configToProviders = function(configs) {
	let a = [];
	for (let c of configs) {
		if (!c) continue;
		if (c.assign) a.push(HostsProvider.fromString(c.assign));
		else if (c.server) a.push(ServerProvider.fromString(c.server));
	}
	return a;
};
