var Client = require("../index");

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
		var client = new Client(['127.0.0.1:6379']);
		client.on('ready', function() {
			console.log('ready');
			setTimeout(function() {
				client.quit();
				test.done();
			}, 2000)
		});
		client.on('error', function(err) {
			console.log(err);

		})
	},

	test1 : function(test) {
		var client = new Client(['localhost:6379']);
		client.on('ready', function() {
			console.log('ready test 1');
			client.ping(function(err, res) {
				console.log(res);
				//client.quit();
				//test.done();
			});

		});
		client.on('error', function(err) {
			console.log('error is ' + err);

		});
		var count = 0;
		setInterval(function() {
			client.ping(function(err, res) {
				console.log((count++) + res);

			});

		}, 3000);
		test.done();
	},
	// test2 : function(test) {
	// var client = new Client(['127.0.0.1:6379']);
	// client.on('ready', function() {
	// console.log('ready test2 ');
	//
	// });
	//
	// client.on("message", function(channel, message) {
	// console.log("client channel " + channel + ": " + message);
	// //client.quit();
	// test.done();
	// });
	//
	// client.subscribe("test");
	// setTimeout(function() {
	//
	// client.publish('test', 'unit test');
	//
	//
	// }, 200);
	// client.on('error', function(err) {
	// console.log(err);
	//
	// })
	//
	// },
	// test3 : function(test) {
	// var client = new Client(['127.0.0.1:6379']);
	//
	// client.on('ready', function() {
	// console.log('ready test3 ');
	//
	// client.slaveOk().get('hello', function(err, res) {
	// console.log(res);
	// client.quit();
	// test.done();
	// });
	// });
	//
	// client.on('error', function(err) {
	// console.log(err);
	//
	// });
	//
	// },
}

