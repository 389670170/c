/**
 * 打印小票工具类
 * Created by haoran.shu on 2017/1/13.
 */
'use strict';

var http = require('http');
var qs = require('querystring');
let log4j = require('log4js');
let logger = log4j.getLogger('feie');
const moment=require("moment")

var IP = "dzp.feieyun.com";
var HOSTNAME = "/FeieServer";

/*
  支付成功过后,打印订单信息的模板
 */
function orderTemplate(param) {
  const extdata=JSON.parse(param.extendinfo)
  let builder = `<LOGO>
<CB>消费成功</CB><BR>
交易流水：${param.oid}<BR>
交易商家：${param.shop.name}<BR>
交易时间：${moment(param.paytime).format('YYYY Mo Do, HH:mm:ss')}<BR>
交易金额：${param.prise/100}<BR>
交易油号：${extdata.dcp.oil}#<BR>
油枪编号：${extdata.gunnum?extdata.gunnum:"无"}<BR>
加油员号：${extdata.qrid?extdata.qrid:"无"}<BR>
油量消耗：${extdata.dcp.quantity}L<BR>
红包抵扣：${extdata.dcp.coupon?extdata.dcp.coupon.amount:0}<BR>
惠后金额：${param.amount/100}<BR>
<BR>`;
  return builder;
}

/**
 * 调用 飞鹅 服务，打印小票
 * @param settings 参数：
 *  {
 *    printer_sn: "915502458", // 打印机编号
 *    key: "s5SoWIhu", // 根打印机编号对应的打印机的key
 *    data: {
 *      oid// 订单号, shopName// 商户名称, creattime// 交易时间
 *      theoryTotal//交易金额, oilNo// 交易油号, quantity// 油量消耗
 *      hbMoney// 红包抵扣, totalFee// 惠后金额
 *    }, // 打印参数
 *    onData: function(response){} // 调用 飞鹅 打印接口后的回调(不是必填)
 *  }
 */
function feiE(settings) {
  var orderTicket = orderTemplate(settings.data); // 构造订单数据
  var post_data = {
    sn: settings.printer_sn || '915502458',//打印机编号
    printContent: orderTicket,//打印内容
    key: settings.key || 's5SoWIhu',//key
    times: '1'//打印联数，默认为1
  };
  var content = qs.stringify(post_data);
  logger.debug('content: ' + content);
  var options = {
    hostname: IP,
    port: 80,
    path: HOSTNAME + '/printOrderAction',
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8'
    }
  };
  var req = http.request(options, function (res) {
    res.setEncoding('utf-8');
    if(settings.onData && typeof settings.onData == 'function') {
      res.on('data', settings.onData); // 调用请求成功回调
    }

  });
  req.on('error', function (e) {
    console.log('error!' + e);
  });
  req.write(content);
  req.end();
}

module.exports = feiE;
