var doc = require('./lib/doc');
var field = require('./lib/field');
var genericBookmark = require('./lib/GenericBookmark');
var genericDimension = require('./lib/GenericDimension');
var genericMeasure = require('./lib/GenericMeasure');
var genericObject = require('./lib/GenericObject');
var global = require('./lib/global');
var variable = require('./lib/variable');

var WebSocket = require('ws');
var Promise = require("es6-promise").Promise;


var qsocks = {
	Doc: doc,
	Field: field,
	GenericBookmark: genericBookmark,
	GenericDimension: genericDimension,
	GenericMeasure: genericMeasure,
	GenericObject: genericObject,
	Global: global,
	Variable: variable
};

function Connect(config) {
	var cfg = {};
	if (config) {
		cfg.mark = config.mark;
		cfg.appname = config.appname || false;
		cfg.host = config.host;
		cfg.origin = config.origin;
		cfg.isSecure = config.isSecure;
		cfg.rejectUnauthorized = config.rejectUnauthorized;
		cfg.headers = config.headers || {};
	}

	return new Promise(function(resolve, reject) {
		cfg.done = function(glob) {
			resolve(glob);
		};
		cfg.error = function(msg) {
			reject(msg);
		};
		new Connection(cfg);
	});
};

qSocks.Connect = Connect;

function Connection(config) {
	var mark = (config && config.mark) ? config.mark + ': ' : '';
	var host = (config && config.host) ? config.host : 'localhost';
	var port = host === 'localhost' ? ':4848' : '';
	var isSecure = (config && config.isSecure) ? 'wss://' : 'ws://'
	var error = config ? config.error : null;
	var done = config ? config.done : null;
	this.mark = mark;
	this.seqid = 0;
	this.pending = {};
	this.handles = {};
	var self = this;
	var suffix = config.appname ? '/sense/app/' + config.appname : '';

	this.ws = new WebSocket(isSecure + host + port + suffix, null, config);

	this.ws.onopen = function(ev) {
		if (done) {
			done.call(self, new qSocks.Global(self, -1));
		};
	};
	this.ws.onerror = function(ev) {
		if (error) {
			console.log(ev.message)
		}
		self.ws = null;
	};
	this.ws.onclose = function() {
		var unexpected = self.ws != null;
		var pending = self.pending[-99];
		delete self.pending[-99];
		if (pending) {
			pending.callback();
		} else if (unexpected) {
			if (error) {
				error();
			}
		}
		self.ws = null;
	};
	this.ws.onmessage = function(ev) {
		var text = ev.data;
		var msg = JSON.parse(text);
		console.log(msg)
		var pending = self.pending[msg.id];
		delete self.pending[msg.id];
		if (pending) {
			if (msg.result) {
				pending.resolve(msg.result);
			} else {
				pending.reject(msg.error);
			}
		}
	};
}
Connection.prototype.ask = function(handle, method, args) {
	var connection = this;
	if (!Array.isArray(args)) {
		var array = [];
		for (var ix in args) {
			array[ix] = args[ix];
		}
		args = array;
	}
	var seqid = ++connection.seqid;
	var request = {
		method: method,
		handle: handle,
		params: args,
		id: seqid,
		jsonrpc: '2.0'
	};
	return new Promise(function(resolve, reject) {
		connection.pending[seqid] = {
			resolve: resolve,
			reject: reject
		};
		connection.ws.send(JSON.stringify(request));
	});
};
Connection.prototype.create = function(arg) {
	if (qSocks[arg.qType]) {
		return new qSocks[arg.qType](this, arg.qHandle);
	} else {
		return null;
	}
};
module.exports = qsocks;