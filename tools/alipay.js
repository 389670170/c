const fetch = require('node-fetch')
const crypto = require('crypto');
const ursa = require("ursa");
const _ = require('underscore');
const moment = require('moment');
const mongo_data=require("../datas/mongo")
const Promise=require("bluebird")
const config=require("../config")
const co=require("bluebird-co").co

// const productionGateway = "https://openapi.alipay.com/gateway.do";
// const sandboxGateway = "https://openapi.alipaydev.com/gateway.do";

const signType = {
    "RSA": "sha1",
    "RSA2":  "sha256"
}
const alipayshops={}
function run() {
    config.alipay.forEach(function (v) {
        alipayshops[v.appid]=v
    })
}
//run()
function alipayObj(config) {
    const appId = config.appid;
    const gateway = config.gateway;

    const privateKey = ursa.createPrivateKey("-----BEGIN RSA PRIVATE KEY-----\n"+config.prikey+"\n-----END RSA PRIVATE KEY-----");

    function getSignString(params) {
        let sortKeys = Object.keys(params).sort();
        let sortedResult = sortKeys.map(function(key) {
            let value = params[key];
            return [key, value].join("=");
        });
        return sortedResult.join("&");
    }
    function getSigned (params) {
        let signParams = _.clone(params);
        let signfun = signType[signParams.sign_type];

        delete signParams["sign"];

        let verify = privateKey;
        let signString = getSignString(signParams);
        return verify.hashAndSign(signfun, signString, "utf8", "base64");
    }
    const funcs={
        appId:function () {
          return appId
        },
        verifySign:function(params) {

            let verify = ursa.createVerifier(signType[params.sign_type]);
            let signture = params.sign;

            delete params.sign;
            delete params.sign_type;
            let signString = getSignString(params);
            verify.update(signString);
            return new Promise(function (resolve,reject) {
                mongo_data.Alipay.findById(params["app_id"]).exec().then(function (ac) {
                    const publicKey = ursa.createPublicKey("-----BEGIN PUBLIC KEY-----\n"+ac.alipubkey+"\n-----END PUBLIC KEY-----")
                    resolve(verify.verify(publicKey, signture, 'base64'));
                })
            })
        },
        getRequestURI:function(params) {
            params = _.defaults(params, {
                format: "JSON",
                charset: "utf-8",
                version: "1.0",
                timestamp: moment().format("YYYY-MM-DD HH:mm:ss"),
                //app_id: appId
            });
            params.sign =  encodeURIComponent(getSigned(params));
            return gateway + "?" + getSignString(params);
        },
        request:co.wrap(function *(params) {
            const rqst=params.sign_type
            var req_method=params.method
            var res_key=req_method.replace(/\./g,"_")+"_response"
            let requestURI = funcs.getRequestURI(params);
            let res=yield fetch(requestURI)
            let bodyobj=yield res.json()
            return bodyobj[res_key];
        })
    }
    return funcs
}
/*const payobjs={}
module.exports =function (appid) {
    if(appid in payobjs)
        return payobjs[appid]
    if(appid in alipayshops){
        payobjs[appid]=alipayObj(alipayshops[appid])
        return payobjs[appid]
    }
}*/
var payobj=null
module.exports =function () {
    if(!payobj)
        payobj=alipayObj(config.alipay)
    return payobj
}
