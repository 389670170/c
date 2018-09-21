const fetch = require('node-fetch')
const FormData = require('form-data');
const Promise=require("bluebird")
const crypto = require('crypto');

/**
 *
 * 阿里云短信发送接口 nodejs 版本
 * 阿里云短信API官方文档: https://help.aliyun.com/document_detail/44364.html?spm=5176.8195934.507901.11.pLzahV
 * github: https://github.com/freecto
 *
 */
var AliyunSmsUtil = {

    config: {   // (购买短信，可以联系淡定哥微信: ianwang003 ，4.5分一条短信)
        AccessKeyId: "LTAIuJcRd52J0BlS",  //阿里短信服务所用的密钥ID
        AccessKeySecret: "dv9fY6oLAHmXWMiuJX66NYHtXMzENG", //阿里短信服务所用的密钥值
        TemplateCode: "SMS_57710156", //阿里短信模板CODE
        SignName: "恒大车时代", //短信签名名称
        SignatureMethod: "HMAC-SHA1", //签名方式，目前支持HMAC-SHA1
        Version: "2016-09-27", //API版本号，为日期形式：YYYY-MM-DD，本版本对应为2016-09-27
        Action: "SingleSendSms", //操作接口名，系统规定参数，取值：SingleSendSms
        Format: "JSON", //返回值的类型，支持JSON与XML，默认为XML
        SignatureVersion: "1.0" //签名算法版本，目前版本是1.0
    },

    /**
     * 阿里云短信发送接口
     * @param data  发送短信的参数，请查看阿里云短信模板中的变量做一下调整，格式如：{code:"1234", phone:"13062706593"}
     * @param callback 发送短信后的回调函数
     */
    sendMessage: function (data) {
        var that = this;
        return new Promise(function (resolve,reject) {
            var param = {
                'Action': that.config.Action, //操作接口名，系统规定参数，取值：SingleSendSms
                'SignName': that.config.SignName, //短信签名名称
                'TemplateCode': that.config.TemplateCode, //阿里短信模板CODE
                'Version': that.config.Version, //API版本号，为日期形式：YYYY-MM-DD，本版本对应为2016-09-27
                'Format': that.config.Format, //返回值的类型，支持JSON与XML，默认为XML
                'AccessKeyId': that.config.AccessKeyId, //阿里短信服务所用的密钥ID
                'SignatureMethod': that.config.SignatureMethod,  //签名方式，目前支持HMAC-SHA1
                'SignatureVersion': that.config.SignatureVersion, //签名算法版本，目前版本是1.0
                'SignatureNonce': "" + Math.random(), //唯一随机数，用于防止网络重放攻击。用户在不同请求间要使用不同的随机数值
                'Timestamp': new Date().toISOString(), //日期格式按照ISO8601标准表示，并需要使用UTC时间。格式为YYYY-MM-DDThh:mm:ssZ
                'RecNum': data.phone, //接受短信的手机号
                'ParamString': JSON.stringify({code: data.code ,product:"公众号"}),//验证码模板里的变量
            };
            param.Signature = that.signParameters(param, that.config.AccessKeySecret);
            var form = new FormData();
            for (let key in param) {
                form.append(key, param[key])
            }
            var api_url = 'https://sms.aliyuncs.com/';
            fetch(api_url, {
                method: 'POST', body: form, headers: form.getHeaders()
            }).then(function (res) {
                return res.json()
            }).then(function (res) {
                resolve(res)
            });
        })
    },

    /**
     * 阿里云短信接口， 签名函数
     * @param param 发送短信的参数
     * @param AccessKeySecret 阿里短信服务所用的密钥值
     */
    signParameters: function (param, AccessKeySecret) {
        var param2 = {}, data=[];
        var oa = Object.keys(param).sort();
        for (var i = 0; i < oa.length; i++) {
            var key = oa[i];
            param2[key] = param[key];
        }
        for (var key in param2) {
            data.push(encodeURIComponent(key) + '=' + encodeURIComponent(param2[key]));
        }
        data = data.join('&');
        var StringToSign = 'POST' + '&' + encodeURIComponent('/') + '&' + encodeURIComponent(data);
        AccessKeySecret = AccessKeySecret + '&';
        return crypto.createHmac('sha1', AccessKeySecret).update(new Buffer(StringToSign, 'utf-8')).digest('base64');
    },

    /**
     * 阿里云短信发送，测试函数
     */
    test:function(){
        var data={code:"1234", phone:"15828568760"};
        this.sendMessage(data).then( function (data) {
            console.log(data);
        })
    }

};

module.exports = AliyunSmsUtil;

// 运行该阿里云短信发送函数之前，请做如下修改：
// 1. 请先修改 config 中的4个参数： AccessKeyId， AccessKeySecret，SignName，TemplateCode
// 2. 参考阿里云短信模板， 修改 sendMessage 函数中的 ParamString
//AliyunSmsUtil.test();

