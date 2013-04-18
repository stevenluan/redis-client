var Node = require("../../lib/node");

/**
 * unit test for sold items api test
 * run cmd: nodeunit solditems-test.js
 */
module.exports = {
	setUp : function(next) {
		next();
	},

	tearDown : function(next) {
		next();
	},

	test : function(test) {
		var node = new Node({
			host : 'localhost',
			port : '6379'
		})
		setTimeout(function() {
			test.notEqual(node.client, null, "client is null");
			node.end();
			test.done();
		}, 1000);

	},
	test1 : function(test) {
		var node = new Node({
			host : 'localhost',
			port : '6379'
		})
		node.on('error',function(err){
			console.log(err)
		})
		setTimeout(function() {
			test.notEqual(node.client, null, "client is null");
			node.end();
			test.done();
		}, 1000);

	}
}

