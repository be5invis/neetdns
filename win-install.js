const path = require("path");
const Service = require("node-windows").Service;

// Create a new service object
const svc = new Service({
	name: "NeetDNS",
	description: "NeetDNS name server",
	script: path.join(__dirname, "server.js")
});

// Listen for the "install" event, which indicates the
// process is available as a service.
svc.on("install", function() {
	svc.start();
});

svc.install();
