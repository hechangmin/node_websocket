/**
 * 封装frame的读写
 *
 * @author  hechangmin@gmail.com
 * @date 2015.04.22
 */

 /**
 * 协议头含义：
 *    0               1               2               3           
 *    0 1 2 3 4 5 6 7 0 1 2 3 4 5 6 7 0 1 2 3 4 5 6 7 0 1 2 3 4 5 6 7
 *   +-+-+-+-+-------+-+-------------+-------------------------------+
 *   |F|R|R|R| opcode|M| Payload len |    Extended payload length    |
 *   |I|S|S|S|  (4)  |A|     (7)     |             (16/64)           |
 *   |N|V|V|V|       |S|             |   (if payload len==126/127)   |
 *   | |1|2|3|       |K|             |                               |
 *   +-+-+-+-+-------+-+-------------+ - - - - - - - - - - - - - - - +
 *   |     Extended payload length continued, if payload len == 127  |
 *   + - - - - - - - - - - - - - - - +-------------------------------+
 *   |                               |Masking-key, if MASK set to 1  |
 *   +-------------------------------+-------------------------------+
 *   | Masking-key (continued)       |          Payload Data         |
 *   +-------------------------------- - - - - - - - - - - - - - - - +
 *   :                     Payload Data continued ...                :
 *   + - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - +
 *   |                     Payload Data continued ...                |
 *   +---------------------------------------------------------------+
 */

module.exports = {

    parse : function(stream, isClient){
        var mask, data, p = 0;
        
        // 数据太短无法解析
        if (stream.length < 2){
            return;
        }

        // 前两个字节就是协议头
        var first  = stream[p++];
        var second = stream[p++];

        // BUFF 第一元素,最高位用于描述消息是否结束,1 该消息为消息尾部, 0 则还有后续数据包
        var fin    = (first & 128) >> 7;

        // 获取opcode BUFF 第一元素，除去最高位的值(实际上后4位，不过因RSV1,RSV2,RSV3位为0)
        var opcode = first & 127;

        // payload-有效负载 BUFF 第二元素，除去最高位的值
        var nLenPayLoad = second & 127;
        
        if (nLenPayLoad == 126){
            //Extended payload length 
            nLenPayLoad = stream.readUInt16BE(p);
            p += 2; 
        }else if (nLenPayLoad == 127){
            //Extended payload length 
            nLenPayLoad = stream.readUInt32BE(p += 4); 
            p += 4;
        }
        
        // 服务端需处理掩码
        if(!isClient){
            // 掩码-4字节
            mask = stream.slice(p, p += 4);
        }

        // 数据不完整
        if (stream.length < p + nLenPayLoad){
            return; 
        } 
        
        // 得到通信数据长度，构造Buf来临时存储
        data = new Buffer(nLenPayLoad);

        //根据掩码解密
        if(!isClient){
            for (var i = 0; i < nLenPayLoad; i++){
                data[i] = stream[p + i] ^ mask[i % 4];
            }
        }else{
            data = stream.slice(p, p + nLenPayLoad);
        }

        return {
            // 另一段开始
            stream : stream.slice(p + nLenPayLoad),
            opcode: opcode,
            data: data
        };
    },

    // 根据rfc6455 第5.1节规定：A server MUST NOT mask any frames that it sends to the client
    package : function(opcode, data, isClient) {
        var second;
        var maskKey = Math.random() * 0xFFFFFFFF;
        var mask = new Buffer(4);
        var first = new Buffer([128 + opcode]);
        var third = new Buffer(data);
        var size = third.length;

        //如果数据大于65535byte
        if (size > 0xFFFF){
            second = new Buffer([127, 0, 0, 0, 0, 0, 0, 0, 0]);
            second.writeUInt32BE(size, 5);
        }else if (size > 125){
            second = new Buffer([126, 0, 0]);
            second.writeUInt16BE(size, 1);
        }else {
            second = new Buffer([size]);
        }

        // 客户端发送到服务端需要加掩码
        if(isClient){
            mask.writeUInt32BE(maskKey, 0, true);
            
            for(var i = 0, n = third.length; i < n; i++){
                third[i] = third[i] ^ mask[i % 4];
            }

            return Buffer.concat([first, second, mask, third]);
        }else{
            return Buffer.concat([first, second, third]);    
        }
    }
};