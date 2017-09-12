const packet = require("native-dns-packet");

module.exports.records = {
	A: 1,
	AAAA: 28
};

module.exports.listAnswer = function(response) {
	let results = [];
	const res = packet.parse(response);
	res.answer.map(function(r) {
		results.push(r.address || r.data);
	});
	return results.join(", ") || "nxdomain";
};

module.exports.createAnswer = function(query, answers) {
	query.header.qr = 1;
	query.header.rd = 1;
	query.header.ra = 1;
	for (let ip of answers) {
		query.answer.push({ name: query.question[0].name, type: 1, class: 1, ttl: 300, address: ip });
	}

	const buf = Buffer.alloc(4096);
	const wrt = packet.write(buf, query);
	const res = buf.slice(0, wrt);

	return res;
};

module.exports.overrideTTL = function(answer) {
	let query = packet.parse(answer);
	if (query.answer) {
		for (let c of query.answer) {
			c.ttl = 1;
		}
	}

	const buf = Buffer.alloc(4096);
	const wrt = packet.write(buf, query);
	const res = buf.slice(0, wrt);

	return res;
};
