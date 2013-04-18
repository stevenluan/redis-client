var redis = require('redis'), util = require('util'), dns = require('dns'), EventEmitter = require('events').EventEmitter, _ = require('underscore'), async = require('async');

function Node(spec, options) {
	var self = this;
	this.host = spec.host;
	this.port = spec.port;
	this.clients = [];
	this.latency = 0;
	this.role = 'slave';
	this.replication = {};
	this.status = 'down';
	options = options || {};
	if ( typeof options.no_ready_check == 'undefined') {
		options.no_ready_check = true;
	}
	this.options = options;
	this.infoTimerInterval = options.infoTimerInterval ? options.infoTimerInterval : 30000;

	dns.lookup(this.host, function(err, addr, family) {
		if (!err) {
			self.host = addr;
			self.connect();
		}

	})
}

util.inherits(Node, EventEmitter);

Node.prototype.connect = function() {
	var self = this;
	this.client = redis.createClient(this.port, this.host, this.options);
	if (this.auth_pass) {
		this.client.auth(this.auth_pass);
	}
	this.clients.push(this.client);
	this.client.on('error', function(err) {
		self.emit('error', err);
	});
	this.client.on('end', function() {
		if (!this.closing) {
			self.emit('down');
			self.status = 'down'
			clearInterval(self.infoTimer);
			if (self.role = 'master') {
				self.emit('masterdown');
			}

		}
	});
	this.client.on('ready', function() {
		self.emit('ready');
		self.status = 'up';
		if(self.role == 'master'){
			self.emit('masterup');
		}
		getReplicationInfo(self)

		self.infoTimer = setInterval(function() {
			getReplicationInfo(self);
		}, self.infoTimerInterval);

	});
	this.client.on('monitor', function(time, args) {
		self.emit('monitor', time, args);
	});

	this.subClient = redis.createClient(this.port, this.host, this.options);

	if (this.auth_pass) {

		this.subClient.auth(this.auth_pass);

	}

	this.clients.push(this.subClient);
	this.subClient.on('error', function(err) {
		self.emit('error', err);
	});
	this.subClient.on('subscribe', function(channel, count) {
		self.emit('subscribe', channel, count);
	});
	this.subClient.on('unsubscribe', function(channel, count) {
		self.emit('unsubscribe', channel, count);
	});
	this.subClient.on('message', function(channel, message) {
		self.emit('message', channel, message);
	});
	this.subClient.on('psubscribe', function(pattern, count) {
		self.emit('psubscribe', pattern, count);
	});
	this.subClient.on('punsubscribe', function(pattern, count) {
		self.emit('punsubscribe', pattern, count);
	});
	this.subClient.on('pmessage', function(pattern, channel, message) {
		self.emit('pmessage', pattern, channel, message);
	});

};

function getReplicationInfo(self) {
	if (self.closing) {
		return;
	}
	
	var t = process.hrtime();
	self.client.info('replication', function(err, res) {
		self.latency = process.hrtime(t)[1];
		self.emit('latency');

		if (err) {
			self.emit('error', err);
			return;
		}

		var info = parseInfo(res);
		self.replication = info;
		if (self.role != info.role && info.role == 'master') {
			self.role = 'master';
			self.emit('masterup');
		} else if (self.role != info.role && info.role == 'slave') {
			self.role = 'slave';
		}

		if (info['master_host'] && info['master_link_status'] == 'up') {
			self.emit('addnode', info['master_host'] + ':' + info['master_port'])
		} else {
			//add slaves
			var sCount = info['connected_slaves'];
			for (var i = 0; i < sCount; i++) {
				var slaveStr = info['slave' + i];
				var dataArray = slaveStr.split(',');
				if (dataArray[2] == 'online') {
					self.emit('addnode', dataArray[0] + ':' + dataArray[1]);
				}

			}
		}

	})
}

function parseInfo(res) {
	var lines = res.toString().split("\r\n"), obj = {};

	lines.forEach(function(line) {
		var parts = line.split(':');
		if (parts[1]) {
			obj[parts[0]] = parts[1];
		}
	});
	return obj;
}

Node.prototype.end = function() {
	var self = this;
	self.closing = true;
	self.client.end();
	self.subClient.end();
	self.clients = [];
	self.emit('end');
};

Node.prototype.toString = function() {
	return this.host + ':' + this.port;
};

module.exports = Node;
