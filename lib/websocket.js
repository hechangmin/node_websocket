/**
 * nodejs websoket 简易封装
 *
 * @author hechangmin<hechangmin@gmail.com>
 * @date 20140807140245
 * @see http://www.rfc-editor.org/rfc/rfc6455.txt
 */

module.exports = {
    'createClient' : require('./client'),
    'createServer' : require('./server')
};