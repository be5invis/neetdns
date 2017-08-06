"use strict";

const providers = require("./providers");

module.exports = function(nameservers, timeout, message) {
	return new Promise((resolve, reject) => {
		let got = false;
		const gotcha = function(data) {
			if (got) return;
			got = true;
			resolve(data);
		};
		const sorry = function(why) {};
		for (let server of nameservers) {
			providers.ServerProvider.fromString(server).query(message, timeout).then(gotcha).catch(sorry);
		}
	});
};
