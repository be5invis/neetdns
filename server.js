"use strict";

const fs = require("fs");
const path = require("path");
const dgram = require("dgram");
const packet = require("native-dns-packet");
const toml = require("toml");
const mm = require("micromatch");

const log = require("./logger");
const util = require("./util.js");
const providers = require("./providers");
const NonA = require("./non-a");
const A = require("./a");

const defaults = {
	port: 53,
	host: "127.0.0.1",
	nameservers: ["8.8.8.8", "8.8.4.4"],
	timeout: 10000,
	zones: []
};

const config = Object.assign(
	defaults,
	toml.parse(fs.readFileSync(path.join(__dirname, "config.toml"), "utf-8"))
);

log.debug("options: %j", config);

const server = dgram.createSocket("udp4");

server.on("listening", function() {
	log.info("we are up and listening at %s on %s", config.host, config.port);
});

server.on("error", function(err) {
	log.error("udp socket error");
	log.error(err);
});

server.on("message", function(message, rinfo) {
	let returner = false;

	const query = packet.parse(message);
	const domain = query.question[0].name;
	const type = query.question[0].type;

	const reply = response => server.send(response, 0, response.length, rinfo.port, rinfo.address);

	let cfgs = {
		sources: config.nameservers.map(s => ({ server: s }))
	};
	let cfgIsDefault = true;
	for (let h of config.zones) {
		if (!h.for) continue;
		if (mm.some([domain], h.for, { nocase: true })) {
			cfgs = h;
			cfgIsDefault = false;
			break;
		}
	}

	if (type === util.records.A) {
		A(cfgs, config.timeout, message).then(reply).catch(log.debug);
	} else if (type === util.records.AAAA && !cfgIsDefault) {
		return;
	} else {
		NonA(config.nameservers, config.timeout, message).then(reply).catch(log.debug);
	}
});

server.bind(config.port, config.host);
