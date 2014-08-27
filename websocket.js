/**
 * nodejs websoket 简易封装
 *
 * @author hechangmin<hechangmin@gmail.com>
 * @date 20140807140245
 * @see http://www.rfc-editor.org/rfc/rfc6455.txt
 */

var net 	   = require('net'),
	crypto     = require('crypto'),
	WSKEY      = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11',

	/*jshint multistr: true */
	CROSSXML   = '\
<?xml version="1.0"?>\r\n\
<cross-domain-policy>\r\n\
<allow-access-from domain="{domain}" to-ports="{port}" />\r\n\
</cross-domain-policy>\0',

	/*jshint multistr: true */
    SHAKEHANDS = '\
HTTP/1.1 101 Switching Protocols\r\n\
Upgrade: websocket\r\n\
Connection: Upgrade\r\n\
Sec-WebSocket-Accept: {key}\r\n\r\n';

exports.createServer = function(callback) {
	return new WebSocketServer(callback);
};

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

	var sub = function(str, data) {
		return str.replace(/{(.*?)}/igm, function($, $1) {
			return data[$1] ? data[$1] : $;
		});
	};

	this.connection = connection;
	
	/*
	 * opcode 含义说明：
	 *
	 *   |Opcode  | Meaning                             | Reference |
	 *  -+--------+-------------------------------------+-----------|
	 *   | 0      | Continuation Frame   连续消息帧     | RFC 6455  |
	 *  -+--------+-------------------------------------+-----------|
	 *   | 1      | Text Frame   文本消息帧             | RFC 6455  |
	 *  -+--------+-------------------------------------+-----------|
	 *   | 2      | Binary Frame    二进制消息帧        | RFC 6455  |
	 *  -+--------+-------------------------------------+-----------|
	 *   | 8      | Connection Close Frame              | RFC 6455  |
	 *  -+--------+-------------------------------------+-----------|
	 *   | 9      | Ping Frame                          | RFC 6455  |
	 *  -+--------+-------------------------------------+-----------|
	 *   | 10     | Pong Frame                          | RFC 6455  |
	 *  -+--------+-------------------------------------+-----------|
	 */
	connection.on('data', function(e) {
		
		var frame,
			evt,
			param;

		stream = Buffer.concat([stream, e]);

		if(state === 0){

			var string = stream.toString();

			string.replace(/^<policy-file-request\/>\x00/,
				function(e) {
					stream = stream.slice(e.length);
					connection.write(sub(CROSSXML, {domain : domain, port : port}));
					return '';
				}).replace(/^[\s\S]*?\r\n\r\n/,
					function(e) {
						var key, origin;
						stream = stream.slice(e.length);
						key = e.match(/Sec-WebSocket-Key: (.+)|$/)[1];
						key = crypto.createHash('sha1').update(key + WSKEY).digest('base64');
						origin = e.match(/Origin: https?:\/\/(.+)|$/)[1];
						
						//console.log(domain,origin);

						if (!origin || domain == '*' || origin == domain) {
							connection.write(sub(SHAKEHANDS,{key : key}));
							state = 1;
							triger('open', null);
						}
						return '';
					});
		} else if (state == 1) {
			while (frame = readFrame(), frame) {
				switch (frame.opcode) {
					case 1:
						evt = 'message';
						param = frame.data + '';
						break;
					case 2:
						evt = 'message';
						param = frame.data;
						break;
					case 8:
						evt = 'close';
						param = frame.data;
						state = 2;
						break;
					case 10:
						evt = 'pong';
						param = frame.data;
						break;
					default:
						evt = 'error';
						param = {
							frame : frame,
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
		if (state == 1) writeFrame(e instanceof Buffer ? 2 : 1, e);
	};
	
	this.close = function(code, reason) {
		var data = new Buffer(' ' + reason);
		data.writeUInt16BE(code, 0);
		writeFrame(8, data);
		state = 2;
		connection.end();
	};
	
	this.ping = function(data) {
		writeFrame(9, data || '');
	};

/*
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
	function readFrame() {
		var p = 0;

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
		
		// 掩码-4字节
		var mask = stream.slice(p, p += 4);

		// 得到通信数据长度，构造Buf来临时存储
		var data = new Buffer(nLenPayLoad);

		// 数据不完整
		if (stream.length < p + nLenPayLoad){
			return;	
		} 
		
		for (var i = 0; i < nLenPayLoad; i++){
			//根据掩码解密
			data[i] = stream[p + i] ^ mask[i % 4];
		}

		// 另一段开始
		stream = stream.slice(p + nLenPayLoad);
		
		return {
			opcode: opcode,
			data: data
		};
	}

	// 根据rfc6455 第5.1节规定：A server MUST NOT mask any frames that it sends to the client
	function writeFrame(opcode, data) {

		if (typeof opcode == 'object'){
			data = opcode.data;
			opcode = opcode.opcode;
		}
		
		var second;
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

		connection.write(Buffer.concat([first, second, third]));
	}
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