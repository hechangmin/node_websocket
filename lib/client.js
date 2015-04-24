/**
 * 封装websocket client部分
 *
 * @author  hechangmin@gmail.com
 * @date 2015.04.23
 */

var net          = require('net');
var util         = require('util');
var EventEmitter = require('events').EventEmitter;
var frame        = require('./frame');
var wskey        = require('./wskey');
var CONST        = require('./constant');

function Client(host, port){
    var isClient = true;
    var self = this;
    var key = '';
    var error = 0;
    var state = CONST.UNCONNECTED;
    
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
        header += self.ClientKey;
        header += '\r\n\r\n';
        
        return header;  
    }

    this.ClientKey = getSecWebSocketKey();
    
    var connection = net.connect({host : host, port: port},
        function() { 
            connection.write(getShakehandsProtocol(host));
        }
    );
    
    connection.on('data', function(data) {
        if(CONST.UNCONNECTED === state){
            // 握手校验
            key = data.toString().match(/Sec-WebSocket-Accept: (.+)|$/)[1];
            
            if(key === wskey.get(self.ClientKey)){
                state = CONST.CONNECTED;
                self.emit('open');
            }else{
                error = '握手校验失败';
                connection.end();
            }
        }else if(CONST.CONNECTED === state){
            self.emit('data', data);
        }
    });

    // 服务端连接断开
    connection.on('end', function() {
        state = CONST.DISCONNECTED;
        self.emit('end');
    });

    // 服务端连接发生错误
    connection.on('error', function(e) {
        state = CONST.DISCONNECTED;
        self.emit('error', e);
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