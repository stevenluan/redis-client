'use strict';

var async = require('async'), _ = require('underscore'), redis = require('redis'), HAMulti = require('./lib/multi'), RedisNode = require('./lib/node'), commands = require('redis/lib/commands'), util = require('util'), EventEmitter = require('events').EventEmitter;
var MAX_QUEUE_SIZE = 1000000;
var RedisClient = function(serverList, options) {
	var self = this;
	self.queue = [];
	self.ready = false;
	self._slaveOk = false;
	self.options = options ? options : {};
	self.nodes = [];
	EventEmitter.call(this);

	self.on('addnode', addNode);

	self.on('ready', function() {
		this.send_command = this.master.client.send_command.bind(this.master.client);
		self.drainQueue();
	});

	serverList.forEach(function(server) {
		self.emit('addnode', server, self);
	});
};
function addNode(server, self) {
	var array = server.split(':');

	for (var i = 0; i < self.nodes.length; i++) {

		if (self.nodes[i].toString().toLowerCase() == server) {
			return;
		}
	}
	var node = new RedisNode({
		host : array[0],
		port : array[1]
	}, self.options);
	node.on('ready', function() {
		self.nodes.push(node);
	});
	node.on('error', function(err) {
		self.emit('error', err);
	});
	node.on('masterup', function() {
		self.master = node;
		self.ready = true;
		self.emit('ready');

		self.emit('connect');
		node.on('subscribe', function(channel, count) {
			self.emit('subscribe', channel, count);
		});
		node.on('unsubscribe', function(channel, count) {
			self.emit('unsubscribe', channel, count);
		});
		node.on('message', function(channel, message) {
			self.emit('message', channel, message);
		});
		node.on('psubscribe', function(channel, count) {
			self.emit('psubscribe', channel, count);
		});
		node.on('punsubscribe', function(channel, count) {
			self.emit('punsubscribe', channel, count);
		});
		node.on('pmessage', function(channel, message) {
			self.emit('pmessage', channel, message);
		});

		node.on('monitor', function(time, args) {
			self.emit('monitor', time, args);
		});

	});
	node.on('down', function() {
		var i = 0, found = false, nodes = self.nodes;
		for (; i < nodes.length; i++) {
			if (nodes[i].toString() == node.toString()) {
				found = true;
				break;
			}

		}
		if (found) {
			nodes.splice(i, 1);
		}

	});
	node.on('masterdown', function() {
		if (self.master && (self.master.toString() == node.toString())) {
			self.ready = false;
			self.master = null;
		}
	});

	node.on('latency', function() {
		self.nodes = _.sortBy(self.nodes, function(n) {
			return n.latency;
		});
	});
	node.on('addnode', function(server) {
		self.emit('addnode', server, self);
	});

}

util.inherits(RedisClient, EventEmitter);

commands.forEach(function(k) {
	RedisClient.prototype[k] = function() {
		var args = Array.prototype.slice.call(arguments);
		var self = this;
		k = k.toLowerCase();

		if (k == 'multi') {
			return new HAMulti(this, args[0]);
		}
		if (!this.ready) {
			if(this.queue.length < MAX_QUEUE_SIZE){
				this.queue.push([k, args]);
			}
			return;
		}

		switch (k) {
			case 'subscribe':
			case 'unsubscribe':
			case 'psubscribe':
			case 'punsubscribe':
				return callCommand(self.master.subClient, k, args);
			case 'select':
				// Need to execute on all nodes.
				// Execute on master first in case there is a callback.
				this.selected_db = parseInt(args[0], 10);
				var nodes = self.nodes;
				nodes.forEach(function(node) {
					callCommand(node.client, k, [args[0]]);
				});

				return;
			case 'quit':

				async.forEach(self.nodes, function(node, callback) {
					callCommand(node.client, k, args);
					callback();
				}, function(err) {
					if (err) {
						self.emit('error', err);
					}
					self.emit('end');
				});
				return;
			case 'monitor':
			case 'info':
			case 'config':
			case 'publish':
				break;
		}

		var client = self.getClient(k);

		callCommand(client, k, args);

		function callCommand(client, command, args) {
			self._slaveOk = false;
			if (!client) {
				client = self.master.client;
			}
			client[command].apply(client, args);

		}

	};
});

RedisClient.prototype.drainQueue = function() {
	if (this.ready && this.queue.length) {
		// Call the next command in the queue
		var item = this.queue.shift();
		this[item[0]].apply(this, item[1]);

		// Wait till nextTick to do next command
		var self = this;
		process.nextTick(function() {
			self.drainQueue();
		});
	}
};
RedisClient.prototype.bestNode = function() {
	if (this.nodes.length == 1) {
		return this.nodes[0];
	} else {
		return this.nodes[_.random(this.nodes.length / 2)];
	}

};

RedisClient.prototype.getClient = function(k) {
	if (this.slaveOk(k)) {
		return this.bestNode().client;
	} else {
		return this.master.client;
	}
};

RedisClient.prototype.slaveOk = function(command) {
	if (command) {
		return this._slaveOk && this.isRead(command);
	}
	this._slaveOk = true;
	return this;
};

RedisClient.prototype.isRead = function(command, args) {
	switch (command.toLowerCase()) {
		case 'bitcount':
		case 'get':
		case 'getbit':
		case 'getrange':
		case 'hget':
		case 'hgetall':
		case 'hkeys':
		case 'hlen':
		case 'hmget':
		case 'hvals':
		case 'keys':
		case 'lindex':
		case 'llen':
		case 'lrange':
		case 'mget':
		case 'pttl':
		case 'scard':
		case 'sinter':
		case 'sismember':
		case 'smembers':
		case 'srandmember':
		case 'strlen':
		case 'sunion':
		case 'ttl':
		case 'type':
		case 'zcard':
		case 'zrange':
		case 'zrangebyscore':
		case 'zrank':
		case 'zrevrange':
		case 'zrevrangebyscore':
		case 'zrevrank':
		case 'zscore':
			return true;
		case 'sort':
			// @todo: parse to see if "store" is used
			return false;
		default:
			return false;
	}
};

module.exports = RedisClient;

module.exports.createClient = function(serverList, options) {
	return new RedisClient(serverList, options);
};
