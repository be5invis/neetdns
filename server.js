"use strict";

const fs = require("fs");
const path = require("path");
const dgram = require("dgram");
const packet = require("native-dns-packet");
const mm = require("micromatch");

const log = require("./lib/logger");
const util = require("./lib/util.js");
const providers = require("./lib/providers");
const Config = require("./lib/config");

const A = require("./lib/query-types/a");
const NonA = require("./lib/query-types/non-a");

const configFilePath = path.join(__dirname, "config.toml");

const config = new Config().load(configFilePath).watch(configFilePath);
config.on("update", function() {
	A.reload();
	NonA.reload();
});

const server = dgram.createSocket("udp4");

server.on("listening", function() {
	const c = config.getData();
	log.info("we are up and listening at %s on %s", c.host, c.port);
});

server.on("error", function(err) {
	log.error("udp socket error");
	log.error(err);
});

server.on("message", function(message, rinfo) {
	const c = config.getData();

	const query = packet.parse(message);
	const domain = query.question[0].name;
	const type = query.question[0].type;

	const reply = response => server.send(response, 0, response.length, rinfo.port, rinfo.address);
	const defaultSources = c.nameservers.map(s => ({ server: s }));

	let cfgs = {
		sources: defaultSources
	};
	let cfgIsDefault = true;
	for (let h of c.zones) {
		if (!h.for) continue;
		if (mm.some([domain], h.for, { nocase: true })) {
			cfgs = h;
			cfgIsDefault = false;
			break;
		}
	}
	if (!cfgs.sources) {
		cfgs.sources = defaultSources;
	}

	if (type === util.records.A) {
		A.handle(cfgs, c.timeout, message).then(reply).catch(log.debug);
	} else if (type === util.records.AAAA && !cfgIsDefault) {
		return;
	} else {
		NonA.handle(c.nameservers, c.timeout, message).then(reply).catch(log.debug);
	}
});

server.bind(config.getData().port, config.getData().host);
