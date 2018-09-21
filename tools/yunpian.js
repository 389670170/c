/**
 * 对于 云片网 发送短信的简单封装
 * Created by haoran.shu on 2017/2/6.
 */
const https = require('https');
const qs = require('querystring');

// 智能匹配模板发送https地址
const SMS_HOST = 'sms.yunpian.com';
const VOICE_HOST = 'voice.yunpian.com';

const SEND_SMS_URI = '/v2/sms/single_send.json';
const API_KEY = "a504a679f1a11dcd150cef275642a7e2";

function post(uri, content, host){
  let options = {
    hostname: host,
    port: 443,
    path: uri,
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8'
    }
  };
  let req = https.request(options, function (res) {
    res.setEncoding('utf8');
    res.on('data', function (chunk) {
      console.log('BODY: ' + chunk);
    });
  });
  req.write(content);
  req.end();
}

let yunpian = {
  /**
   * 发送单条短信
   * @param mobile  手机号
   * @param text    发送的内容(格式必须跟模板匹配)
   */
  sendMsg: function (mobile, text) {
    let post_data = {
      'apikey': API_KEY,
      'mobile': mobile,
      'text': text,
    };
    let content = qs.stringify(post_data);
    post(SEND_SMS_URI, content, SMS_HOST);
  },

  sendVoiceMsg: function() {

  }
};

module.exports = yunpian;
