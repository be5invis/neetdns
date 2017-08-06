"use strict";

const fs = require("fs");
const toml = require("toml");
const path = require("path");
const log = require("./logger");

const EventEmitter = require("events");

const defaults = {
	port: 53,
	host: "127.0.0.1",
	nameservers: ["8.8.8.8", "8.8.4.4"],
	timeout: 10000,
	zones: []
};

class Config extends EventEmitter {
	constructor() {
		super();
		this.config = Object.assign({}, defaults);
	}
	load(p) {
		try {
			this.config = Object.assign({}, defaults, toml.parse(fs.readFileSync(p), "utf-8"));
		} catch (e) {
			log.error(e);
		}
		return this;
	}
	watch(p) {
		fs.watch(p, (eventType, filename) => {
			if (eventType === "change" && filename && filename === path.basename(p)) {
				log.debug("Configuration reloaded.");
				this.load(p);
				this.emit("update");
			}
		});
		return this;
	}
	getData() {
		return this.config;
	}
}

module.exports = Config;
