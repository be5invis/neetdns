"use strict";

const loginfo = require("debug")("neetdns:info");
const logdebug = require("debug")("neetdns:debug");
const logquery = require("debug")("neetdns:query");
const logerror = require("debug")("neetdns:error");

exports.info = loginfo;
exports.debug = logdebug;
exports.query = logquery;
exports.error = logerror;
