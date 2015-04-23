/**
 * 封装websocket key 生成部分
 *
 * @author  hechangmin@gmail.com
 * @date 2015.04.23
 */

var crypto       = require('crypto');

var WSKEY  = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';

exports.get = function(key){    
    var sha1 = crypto.createHash("sha1");
    sha1.update(key + WSKEY, "ascii");
    return sha1.digest("base64");
};