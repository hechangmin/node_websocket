/**
 * web socket server demo 
 * @author hechangmin<hechangmin@gmail.com>
 * @date 2014.8.11
 *
 */

var fs          = require('fs'),
    http        = require('http'),
    clientList  = [],
    contentType = 'text/html;charset=utf-8';

function avoidXSS(strParam) {
    var m = {
        "<" : "&#60;",
        ">" : "&#62;",
        '"' : "&#34;",
        "'" : "&#39;",
        "&" : "&#38;"
    };
    return strParam.replace(/[&<>"']/g, function (s) {
        return m[s];
    });
}

http.createServer(function(req, res){
    res.setHeader("Content-Type", contentType);

    try{
        var stream = fs.createReadStream('./index.html');
        stream.on("error", function(err) {
            res.end('Internal Server Error');
        });
        stream.pipe(res);
    }catch(e){
        res.end('Internal Server Error');
    }
}).listen(80);

require('./websocket.js').createServer(function(ws) {
    
    clientList.push(ws);

    ws.on("message", function(e) {

        console.log("收到数据：" + e);

        if (/ping/.test(e)) {
            ws.ping();
        }

        if (/text/.test(e)) {
            
            var data = {
                ip : ws.connection.remoteAddress,
                msg  : avoidXSS(e.substr(4))
            };

            for(var i in clientList){
                clientList[i].send(JSON.stringify(data));
            }
        }

        if (/close/.test(e)) {
            ws.close(1000, "额客户端请求断开");
        }

    });

    ws.on("pong", function() {
        console.log("收到pong包");
    });

    ws.on("close", function() {
        console.log("客户端断开");
    });

}).listen(8000, '*');