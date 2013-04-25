var redis = require('redis'), util = require('util');

function HAMulti(client, args) {
	redis.Multi.call(this, client, args);
}

util.inherits(HAMulti, redis.Multi);

HAMulti.prototype.exec = function(callback) {
	var self = this;
	if (self._client.ready) {
		redis.Multi.prototype.exec.call(self, callback);
	} else {
		self._client.once('ready', function() {
			redis.Multi.prototype.exec.call(self, callback);
		});
	}


};

module.exports = HAMulti;
