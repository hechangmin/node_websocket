/**
 * nodejs websoket 简易封装
 *
 * @author hechangmin<hechangmin@gmail.com>
 * @date 20140807140245
 * @see http://www.rfc-editor.org/rfc/rfc6455.txt
 */

var net        = require('net'),
    crypto     = require('crypto'),
    frame      = require('./frame'),
    WSKEY      = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';

function WebSocketServer(callback) {
    this.server = net.createServer(function(e) {
        var ws = new WebSocketSession(e, this.port, this.domain);
        ws.on('open', callback.bind(this, ws));
    }.bind(this));

    this.listen = function(port, domain) {
        this.port   = port;
        this.domain = domain || '*';
        this.server.listen(port);
    };
}

function WebSocketSession(connection, port, domain) {
    var stream   = new Buffer(0),
        state    = 0;

    var events = this.events = {
        message : [],
        close   : [],
        pong    : [],
        open    : []
    };

    //握手协议
    function getShakehandsProtocol(key){
        var protocol = 'HTTP/1.1 101 Switching Protocols\r\n';
        protocol += 'Upgrade: websocket\r\n';
        protocol += 'Connection: Upgrade\r\n';
        protocol += 'Sec-WebSocket-Accept: ';
        protocol += key;
        protocol += '\r\n\r\n';

        return protocol;
    }

    function hashWebSocketKey(key){
        var sha1 = crypto.createHash("sha1");
        sha1.update(key + WSKEY, "ascii");
        return sha1.digest("base64");
    };

    function getCrossLicencs(domain, port){
        var licencs = '<?xml version="1.0"?>\r\n';
        licencs += '<cross-domain-policy>\r\n';

        licencs += '<allow-access-from domain="';
        licencs += domain;
        licencs += '" to-ports="';
        licencs += port;
        licencs += '" />\r\n';
        
        licencs += '</cross-domain-policy>\0';

        return licencs;
    }

    this.connection = connection;
    
    connection.on('data', function(e) {
        
        var frameDate,
            evt,
            param;

        stream = Buffer.concat([stream, e]);

        if(state === 0){

            var string = stream.toString();

            string.replace(/^<policy-file-request\/>\x00/,
                function(e) {
                    stream = stream.slice(e.length);
                    connection.write(getCrossLicencs(domain, port));
                    return '';
                }).replace(/^[\s\S]*?\r\n\r\n/,
                    function(e) {
                        var key, origin;
                        stream = stream.slice(e.length);
                        key = e.match(/Sec-WebSocket-Key: (.+)|$/)[1];
                        origin = e.match(/Origin: https?:\/\/(.+)|$/)[1];
                        
                        //console.log(domain,origin);

                        if (!origin || domain == '*' || origin == domain) {
                            connection.write(getShakehandsProtocol(hashWebSocketKey(key)));
                            state = 1;
                            triger('open', null);
                        }
                        return '';
                    });
        } else if (state == 1) {
            while (frameDate = frame.parse(stream), frameDate) {
                
                stream = frameDate.stream;

                switch (frameDate.opcode) {
                    case 1:
                        evt = 'message';
                        param = frameDate.data + '';
                        break;
                    case 2:
                        evt = 'message';
                        param = frameDate.data;
                        break;
                    case 8:
                        evt = 'close';
                        param = frameDate.data;
                        state = 2;
                        break;
                    case 10:
                        evt = 'pong';
                        param = frameDate.data;
                        break;
                    default:
                        evt = 'error';
                        param = {
                            frame : frameDate,
                            message : '未知操作码'
                        };
                        break;
                }

                triger(evt, param);
            }
        }
    });
    
    function triger(evtName, param){
        for (var i = 0, s = events[evtName]; i < s.length; i++) {
            s[i](param);
        }
    }

    connection.on('close', function(e) {
        if (state < 2) {
            triger('close', null);
            state = 2;
        }
    });

    connection.on('error', function(e) {
        console.log(e);
        return;
    });

    this.send = function(e) {
        if (state == 1) connection.write(frame.package(e instanceof Buffer ? 2 : 1, e));
    };
    
    this.close = function(code, reason) {
        var data = new Buffer(' ' + reason);
        data.writeUInt16BE(code, 0);
        connection.write(frame.package(8, data));
        state = 2;
        connection.end();
    };
    
    this.ping = function(data) {
        connection.write(frame.package(9, data || ''));
    };

}

WebSocketSession.prototype = {
    on : function(evt, callback) {
        return this.events[evt].push(callback),this;
    },

    off : function(evt, callback) {
        var o = this.events[evt];

        for (var i = 0, len = o.length; i < len; i++){
            if (o[i] == callback){
                o.splice(i, 1);
                len = o.length; 
                i--;
            } 
        }
        return this;
    }
};

module.exports = function(callback) {
    return new WebSocketServer(callback);
};