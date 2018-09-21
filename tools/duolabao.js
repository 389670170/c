var fetch = require('node-fetch')
const Promise=require("bluebird")
//var sha = require('sha.js')
var crypto=require("crypto")
var dateFormat = require('dateformat');
module.exports = function (customerNum,shopNum) {
    // 代理商id
    const agentNum = "10001014809159353171255";
    // 车时代商户id
    customerNum = customerNum || "10001114811809241000257";
    // 车时代店铺id
    shopNum =shopNum || "10001214811811475148892";

    const path = "/v1/agent/order/payurl/create";
    const path_check="/v1/agent/order/payresult"
    const secretKey = "d25b301f834e403c83ccea1df815826a644f11ef";
    const accessKey = "f48c31491127428f96f3ff1f091bef922f84bfca";

    var func = {}

    function getSignStr(data) {
        data.secretKey=secretKey
        var signStr = `secretKey=${data.secretKey}&timestamp=${data.timestamp}`
        if("path" in data)
            signStr+=`&path=${data.path}`
        if("body" in data)
            signStr+=`&body=${data.body}`

        var s1=crypto.createHash('sha1').update(signStr).digest('hex').toUpperCase()
        return s1
    }

    func.create_pay = function (amount, orderId, callbackurl,completeUrl) {
        return new Promise(function (resolve,reject) {
            var req = {
                agentNum: agentNum,
                amount: amount,
                callbackUrl: callbackurl,
                shopNum: shopNum,
                customerNum: customerNum,
                requestNum: orderId,
                source: "API",
                completeUrl:completeUrl
            }
            var body = JSON.stringify(req)
            var timestamp = new Date().getTime() + ""

            fetch("http://openapi.duolabao.cn" + path,
                {
                    method: 'POST',
                    headers: {
                        "Content-Type": "application/json",
                        "accessKey": accessKey,
                        "timestamp": timestamp,
                        "token": getSignStr({timestamp: timestamp, body: body, path: path})
                    },
                    body: body
                }).then(function (res) {
                return res.json();
            }).then(function (json) {
                resolve(json)
            })
        })
    }
    func.check_result=function(orderid){
        return new Promise(function (resolve,reject) {
            var reqpath = path_check + `/${agentNum}/${customerNum}/${shopNum}/${orderid}`
            var timestamp = new Date().getTime() + ""
            fetch("http://openapi.duolabao.cn" + reqpath, {
                headers: {
                    "accessKey": accessKey,
                    "timestamp": timestamp,
                    "token": getSignStr({timestamp: timestamp, path: reqpath})
                },
            }).then(function (res) {
                return res.json()
            }).then(function (json) {
                resolve(json)
            })
        })
    }
    func.neworderid=require("./order_id")
    func.signStrCheck=function(timestamp,token) {
        var signstr="secretKey=<{secretKey}>&timestamp=<{timestamp}>".formatO({
            secretKey:secretKey,
            timestamp:timestamp
        })
        var s1=crypto.createHash('sha1').update(signstr).digest('hex').toUpperCase()
        return s1===token.toUpperCase()
    }
    func.customerNum=function () {
        return customerNum
    }
    func.shopNum=function () {
        return shopNum
    }
    return func
}

