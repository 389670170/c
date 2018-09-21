/**
 * Created by amen on 1/10/17.
 */
const fetch = require('node-fetch')
const crypto=require("crypto")
const encoding = require('encoding');
const querystring = require("querystring");
const config=require("../config")
const dateFormat = require('dateformat');
const Promise=require("bluebird")
const xml=require("xml")
const xml2js=require("xml2js")
const mongo=require("../datas/mongo")
const co = require("bluebird-co").co

fetch.Promise=Promise
var appdata={}
function create_weixinapp (app_id) {
    //var access_token=null;
    //var access_expires=null;

    //var jsapi_ticket=null
    //var jsapi_expires=null
    var getAppData=co.wrap(function *() {
        if(app_id in appdata){
            return appdata[app_id]
        }
        var data=yield mongo.WeiXinConfig.findOne({$or:[{_id:app_id},{sid:app_id}]})
        if(data){
            data.access_token=null
            data.access_expires=null
            data.jsapi_ticket=null
            data.jsapi_expires=null
            appdata[data._id]=data
            appdata[data.sid]=data
            return data
        }
        throw new Error("no appid config")
    })
    var funcs={}
    funcs.access_token=co.wrap(function*(){
        var appdata=yield getAppData()
        if(appdata.access_token!=null && Math.floor(new Date() / 1000)<appdata.access_expires){
            return appdata.access_token
        }
        var url=`https://api.weixin.qq.com/cgi-bin/token?grant_type=client_credential&appid=${appdata._id}&secret=${appdata.appsecret}`
        console.log(url)
        let res=yield fetch(url)
        let json=yield res.json();
        appdata.access_token=json.access_token
        appdata.access_expires=Math.floor(new Date() / 1000)+json.expires_in-60*10
        return appdata.access_token
    })
    funcs.jsapi_ticket=co.wrap(function *() {
        var appdata=yield getAppData()
        if (appdata.jsapi_ticket != null && Math.floor(new Date() / 1000) < appdata.jsapi_expires) {
            return appdata.jsapi_ticket
        }
        let access_token=yield funcs.access_token()
        var url = `https://api.weixin.qq.com/cgi-bin/ticket/getticket?access_token=${access_token}&type=jsapi`
        let res=yield fetch(url)
        let json=yield res.json()
        if (json.errcode == 0) {
            appdata.jsapi_ticket = json.ticket
            appdata.jsapi_expires = Math.floor(new Date() / 1000) + json.expires_in - 60
            return appdata.jsapi_ticket
        } else {
            throw new Error(json)
        }
    })
    funcs.appid=co.wrap(function *() {
        var appdata=yield getAppData()
        return appdata._id
    })
    funcs.appsecret=co.wrap(function *() {
        var appdata=yield getAppData()
        return appdata.appsecret
    })
    funcs.paykey=co.wrap(function *() {
        var appdata=yield getAppData()
        return appdata.pay_key
    })
    funcs.mch_id=co.wrap(function *() {
        var appdata=yield getAppData()
        return appdata.mch_id
    })
    funcs.msgtpl=co.wrap(function *() {
        var appdata=yield getAppData()
        return appdata.msgtpl
    })
    funcs.reflash_token=co.wrap(function *(refresh_token){
        var appdata=yield getAppData()
        var url = `https://api.weixin.qq.com/sns/oauth2/refresh_token?appid=${appdata._id}&grant_type=refresh_token&refresh_token=${refresh_token}`
        console.log(url)
        let res=yield fetch(url)
        let json=yield res.json();
        return json
    })
    funcs.user_info=function(access_token,open_id){
        return new Promise(function (resolve,reject) {
            var url = `https://api.weixin.qq.com/sns/userinfo?access_token=${access_token}&openid=${open_id}&lang=zh_CN`
            fetch(url).then(function (res) {
                return res.json();
            }).then(function (json) {
                resolve(json)
            });
        })
    }
    funcs.paySign=co.wrap(function *(data) {
        var appdata=yield getAppData()
        data.appid=appdata._id
        data.mch_id=appdata.mch_id
        data.nonce_str=Math.random().toString(36).substr(2)
        data.sign_type="MD5"
        data.sign=yield funcs.calsign(data)
        return data
    })
    funcs.paySignFront=co.wrap(function *(prepay_id) {
        var predata={
            "appId" : yield funcs.appid(),     //公众号名称，由商户传入
            "timeStamp":new Date().getTime()+"",         //时间戳，自1970年以来的秒数
            "nonceStr":Math.random().toString(36).substr(2), //随机串
            "package":"prepay_id="+prepay_id,
            "signType":"MD5"
        }
        predata.paySign=yield funcs.calsign(predata)
        return predata
    })
    funcs.calsign=co.wrap(function *(data) {
        var keyarray=[]
        for(var k in data){
            keyarray.push(k)
        }
        keyarray=keyarray.sort()
        var checkstr=""
        keyarray.forEach(function (key) {
            var value=data[key]
            if(value === undefined || value === null || value=="")
                return
            checkstr+=`${key}=${data[key]}&`
        })
        var appdata=yield getAppData()
        checkstr+="key="+appdata.pay_key
        checkstr=encoding.convert(checkstr,"utf-8")
        return crypto.createHash("MD5").update(checkstr).digest('hex').toUpperCase()
    })
    funcs.checkOrderSign=co.wrap(function *(out_trade_no) {
        var appdata=yield getAppData()
        var data={
            appid:appdata._id,
            mch_id:appdata.mch_id,
            out_trade_no:out_trade_no,
            nonce_str:Math.random().toString(36).substr(2),
            sign_type:"MD5"
        }
        data.sign=yield funcs.calsign(data)
        return data
    })
    funcs.neworderid=require("./order_id")
    funcs.setMenu=co.wrap(function *(jsonObj) {
        let token=yield funcs.access_token()
        var url = `https://api.weixin.qq.com/cgi-bin/menu/create?access_token=${token}`
        let res=yield fetch(url, {
            method: 'POST',
            body: JSON.stringify(jsonObj)
        })
        let json=yield res.json();
        return json
    })
    function sendMessageBase(link,jsonObj) {
        return new Promise(function (resolve,reject) {
            funcs.access_token().then(function (token) {
                var url = link+`?access_token=${token}`
                return fetch(url, {
                    method: 'POST',
                    body: JSON.stringify(jsonObj)
                })
            }).then(function (res) {
                return res.json();
            }).then(function (json) {
                resolve(json)
            });
        })
    }
    funcs.sendCustomMessage=function (jsonObj) {
        return sendMessageBase("https://api.weixin.qq.com/cgi-bin/message/custom/send",jsonObj)
    }
    funcs.sendTemplateMessage=function (jsonObj) {
        return sendMessageBase("https://api.weixin.qq.com/cgi-bin/message/template/send",jsonObj)
    }
    funcs.genAuthUrl=co.wrap(function *(jump) {
        var appdata=yield getAppData()
        return `https://open.weixin.qq.com/connect/oauth2/authorize?appid=${appdata._id}&redirect_uri=${querystring.escape(`http://${config.host}/weixin/finish/${appdata._id}`)}&response_type=`+
        `code&scope=snsapi_userinfo&state=${jump}#wechat_redirect`
    })
    funcs.genSrcUrl=co.wrap(function *(jump) {
        var appdata=yield getAppData()
        return `http://${config.host}/weixin/begin?appid=${appdata._id}&state=${jump}`
    })
    funcs.genQRCode=function (temp,scene_id) {
        return new Promise(function (resolve,reject) {
            funcs.access_token().then(function (token) {
                var jsonObj={action_info: {"scene": {"scene_id": scene_id}}}
                if(temp==1){
                    jsonObj.action_name="QR_SCENE",
                    jsonObj.expire_seconds=604800
                }else{
                    jsonObj.action_name="QR_LIMIT_SCENE"
                }
                var url = `https://api.weixin.qq.com/cgi-bin/qrcode/create?access_token=${token}`
                return fetch(url, {
                    method: 'POST',
                    body: JSON.stringify(jsonObj)
                })
            }).then(function (res) {
                return res.json();
            }).then(function (json) {
                resolve(json)
            });
        })
    }
    funcs.genQRCodeSceneStr=function (temp,scene_str) {
        return new Promise(function (resolve,reject) {
            funcs.access_token().then(function (token) {
                var jsonObj={action_info: {"scene": {"scene_str": "$"+scene_str}}}
                if(temp==1){
                    jsonObj.action_name="QR_STR_SCENE",
                        jsonObj.expire_seconds=604800
                }else{
                    jsonObj.action_name="QR_LIMIT_STR_SCENE"
                }
                var url = `https://api.weixin.qq.com/cgi-bin/qrcode/create?access_token=${token}`
                return fetch(url, {
                    method: 'POST',
                    body: JSON.stringify(jsonObj)
                })
            }).then(function (res) {
                return res.json();
            }).then(function (json) {
                resolve(json)
            });
        })
    }
    funcs.checkOrder=co.wrap(function *(oid) {
        var data = yield funcs.checkOrderSign(oid)
        datalist = []
        for (var k in data) {
            var obj = {}
            obj[k] = data[k]
            datalist.push(obj)
        }
        data = xml({xml: datalist})
        let body=yield fetch("https://api.mch.weixin.qq.com/pay/orderquery", {
            body: data,
            method: 'POST'
        })
        let xmldata= body.text()
        console.log(xmldata)
        var xmlele=null
        xml2js.parseString(xmldata, function (err, result) {
            xmlele = result.xml
        })
        var procdata = {}
        for (var a in xmlele) {
            procdata[a] = xmlele[a][0]
        }
        return procdata
    })
    funcs.jsapi_unifiedorder=co.wrap(function *(params) {
        params.trade_type="JSAPI"
        var data =yield funcs.paySign(params)
        datalist=[]
        for(var k in data){
            var obj={}
            obj[k]=data[k]
            datalist.push(obj)
        }
        data = xml({xml:datalist})
        let body=yield fetch("https://api.mch.weixin.qq.com/pay/unifiedorder", {
            body: data,
            method: 'POST'
        })
        let xmldata=yield body.text()
        var xmlele=null
        xml2js.parseString(xmldata, function (err, result) {
            xmlele = result.xml
        })
        let predata =yield funcs.paySignFront(xmlele.prepay_id[0])
        return predata
    })
    return funcs
}

module.exports=create_weixinapp

module.exports.unloadApp=co.wrap(function *(app_id) {
    let data=appdata[app_id]
    if(data){
        delete appdata[data._id]
        delete appdata[data.sid]
    }
    return data
})
