/**
 * 预定义常量
 *
 * @author hechangmin@gmail.com
 * @date 4/24/2015
 */

module.exports = Object.freeze({
	// 未连接
	UNCONNECTED  : 0,
	// 已连接
	CONNECTED    : 1,
	// 连接已断开
	DISCONNECTED : 2,

	// frame opcode 含义表
	OPCODE : {
		// 文本数据
		TEXT   : 1,
		// 二进制数据
		BINARY : 2,
		CLOSE  : 8,
		PING   : 9,
		PONG   : 10
	}
});