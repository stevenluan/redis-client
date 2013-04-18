Redis Client with high availability
============
* Compatible interface to node_redis
* Support connection to replication set
* Load balancing reads
* One client pub/sub


Usage
=====
Provide any redis node(s) in the replication set

```
var Client = require('haredisclient');
var redis_client = new Client(['localhost:6379']);
```

Use Replication Set
=====
Suppose the replication set is running @ 6379(master)|6380|6381, the client can connect either redis node in intialization, the connection to other nodes will automatically happen.
```
var Client = require('haredisclient');
var redis_client = new Client(['localhost:6379']);

or 

var Client = require('haredisclient');
var redis_client = new Client(['localhost:6380']);

or

var Client = require('haredisclient');
var redis_client = new Client(['localhost:6379','localhost:6380','localhost:6381']);
```
