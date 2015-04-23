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
        var stream = fs.createReadStream('./demo.html');
        stream.on("error", function(err) {
            res.end('Internal Server Error');
        });
        stream.pipe(res);
    }catch(e){
        res.end('Internal Server Error');
    }
}).listen(80);

require('./lib/websocket').createServer(function(ws) {
    
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

            //broadcast
            for(var i = 0, nCount = clientList.length; i < nCount; i++){
                try{
                    clientList[i].send(JSON.stringify(data));
                }catch(err){
                    clientList.splice(i, 1);
                    nCount = clientList.length;
                    i--;
                }
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
        clientList.splice(clientList.indexOf(ws), 1);
        console.log("客户端断开");
    });

}).listen(8000, '*');