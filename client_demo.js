var net    = require('net');
var websocket  = require('./lib/websocket.js');

var client = websocket.createClient('127.0.0.1', 8000);

client.on('data', function(data) {
	var o = client.read(data);
	var x = JSON.parse(o.data.toString());
	console.log(x);
	if( '1+1=?' === x.msg){
		client.write(1, 'text2');
	}
});

client.on('end', function() {
	console.log('客户端断开连接');
});