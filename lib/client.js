/**
 * 封装websocket client部分
 *
 * @author  hechangmin@gmail.com
 * @date 2015.04.23
 */

var net          = require('net');
var util         = require('util');
var EventEmitter = require('events').EventEmitter;
var crypto       = require('crypto');
var frame        = require('./frame');
var WSKEY        = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';

function Client(host, port){
    
    function getSecWebSocketKey(){
        var nonce = new Buffer(16);

        for (var i=0; i < 16; i++) {
            nonce[i] = Math.round(Math.random()*0xFF);
        }

        return nonce.toString('base64');
    }

    function getShakehandsProtocol(host){
        var header = 'GET / HTTP/1.1\r\n';
        header += 'Connection: Upgrade\r\n';
        header += 'Upgrade: websocket\r\n';
        header += 'Pragma: no-cache\r\n';
        header += 'Cache-Control: no-cache\r\n';

        header += 'Origin: http://';
        header += host;
        header += '\r\n';
        
        header += 'Sec-WebSocket-Version: 13\r\n';
        
        header += 'Sec-WebSocket-Key: ';
        header += getSecWebSocketKey();
        header += '\r\n\r\n';
        
        return header;  
    }

    var isClient = true;

    // 0 未连接 ， 1 已经建立连接， 2 断开
    var state = 0; 

    var connection = net.connect({host : host, port: port},
        function() { 
            connection.write(getShakehandsProtocol(host));
        }
    );

    var self = this;

    connection.on('data', function(data) {

        if(0 === state){
            // todo 握手校验
            console.log(data.toString());
            
            state = 1;
            self.emit('open');
        }else if(1 === state){
            self.emit('data', data);
        }
    });

    // 服务端连接断开
    connection.on('end', function() {
        self.emit('end');
        // todo 重连机制
    });

    this.read = function(data){
        return frame.parse(data, isClient);
    };

    this.write = function(opcode, data){
        connection.write(frame.package(opcode, data, isClient));
    };
}

util.inherits(Client, EventEmitter);

module.exports = function(host, port) {
    return new Client(host, port);
};