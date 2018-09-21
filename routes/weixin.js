const express = require('express');
const crypto = require("crypto")
const wxtools = require('../tools/weixin')
const querystring = require("querystring");
const fetch = require('node-fetch')
const tplfile = require("../tools/tplfile")
const mongo_data = require("../datas/mongo")
const xml = require("xml")
const xml2js = require("xml2js")
const iconv = require('iconv-lite');
const config = require("../config")
const data_sql = require("../datas/mysql")
const moment = require("moment")
const order_tool = require('../tools/order')
const dc = require('../tools/discount_calc');
const redirectTo = require('../tools/redirectTo')
const log4js = require("log4js").getLogger("site")
const charge = require("../tools/charge")
const rabbitmq = require("../tools/rabbitmq")
const co = require("bluebird-co").co
const memcached=require("../tools/memcached")
const router = express.Router();

const token = 'mcweeu12u89724t9wufm'
router.get('/check', function (req, res, next) {
    var signature = req.query.signature
    var timestamp = req.query.timestamp
    var nonce = req.query.nonce
    var hash = crypto.createHash('sha1')
    var checkarray = [nonce, timestamp, token]
    checkarray = checkarray.sort()
    checkarray.forEach(function (one) {
        hash.update(one)
    })
    var result = hash.digest("hex")
    var areEqual = result.toUpperCase() === signature.toUpperCase();
    if (areEqual)
        res.write(req.query.echostr);
    res.end()
});
function wx_xml2js(xml) {
    var procdata = {}
    const xmlele = xml.xml
    for (var a in xmlele) {
        procdata[a] = xmlele[a][0]
    }
    return procdata
}
router.post('/check', co.wrap(function *(req, res, next) {
    var signature = req.query.signature
    var timestamp = req.query.timestamp
    var nonce = req.query.nonce
    var hash = crypto.createHash('sha1')
    var checkarray = [nonce, timestamp, token]
    checkarray = checkarray.sort()
    checkarray.forEach(function (one) {
        hash.update(one)
    })
    var result = hash.digest("hex")
    var areEqual = result.toUpperCase() === signature.toUpperCase();
    if (areEqual) {
        const recdata = wx_xml2js(req.body)
        //console.log(recdata)

        const scan_code_event = co.wrap(function *(scene_id) {
            var wxtool = wxtools(recdata.tousername)
            var searchparam={appid: yield wxtool.appid()}
            if(scene_id.startsWith("$")) {
                res.end()
                return
                //searchparam["scene_str"]=scene_id.substr(1)
            }
            else
                searchparam["scene_id"]=parseInt(scene_id)
            let qr=yield mongo_data.QrCodeRedirect.findOne(searchparam)
            if (qr) {
                var xmlres = xml({
                    xml: [
                        {ToUserName: {_cdata: recdata.fromusername}},
                        {FromUserName: {_cdata: recdata.tousername}},
                        {CreateTime: Date.now()},
                        {MsgType: "news"},
                        {ArticleCount: 2},
                        {
                            Articles: [
                                {
                                    item: [
                                        {Title: {_cdata: qr.title}},
                                        {Description: {_cdata: qr.desc}},
                                        {PicUrl: {_cdata: qr.image_url}},
                                        {Url: {_cdata: yield wxtool.genAuthUrl(qr.redir)}}
                                    ]
                                },
                                {
                                    item: [
                                        {Title: {_cdata: "攻略：如何下次加油更省钱"}},
                                        {Description: {_cdata: "攻略：如何下次加油更省钱"}},
                                        {PicUrl: {_cdata: "http://om87tl0nf.bkt.clouddn.com/TIM%E5%9B%BE%E7%89%8720170731133150.jpg"}},
                                            {Url: {_cdata: "http://u.eqxiu.com/s/PGD1MyrD"}}
                                    ]
                                }
                            ]
                        }
                    ]
                })
                res.send(xmlres)
            } else {
                res.send("")
            }
        })
        const makeRelation = co.wrap(function *(scene_id) {
            var wxtool1 = wxtools(recdata.tousername)
            var a = yield wxtool1.appid()
            console.log("appid:" + a)
            var doc={
                appid: yield wxtool1.appid(),
                create_time:new Date(),
                openid:recdata.fromusername
            }
            console.log("scene_id"+scene_id)
            console.log(scene_id.startsWith("$"))
            if(scene_id.startsWith("$"))
                doc["scene_str"]=scene_id.substr(1)
            else
                doc["scene_id"]=parseInt(scene_id)
           let user = yield mongo_data.Relation.find({openid:recdata.fromusername})
            console.log("user:",user)
            console.log("user:",user.length)
            if(user.length!=0){
                return
            }
            else {
                yield mongo_data.Relation.create(doc)
            }
        })

        const clickEvent=co.wrap(function*(eventkey){
            var evearr=eventkey.split(":")
            switch(evearr[0]){
                case "oilprice":
                    let sid=parseInt(evearr[1])
                    let dicpri=yield mongo_data.ShopSetting.findOne({_id:sid},{"discount.price":1})
                    let shop=yield data_sql.Shop.findOne({where:{id:sid}})
                    var rettext=[`${shop.name}今日油价`]
                    for(var key in dicpri.discount.price){
                        let prise=dicpri.discount.price[key]
                        rettext.push(`${key}号${prise}元/升`)
                    }
                    return rettext.join("\n")
                    break
            }

        })
        if (recdata.msgtype == "event") {
                switch (recdata.event) {
                    case "SCAN":
                        scan_code_event(recdata.eventkey)
                        break
                    case "subscribe":
                        let keyres = /^qrscene_(\$?[A-Za-z0-9]+)$/.exec(recdata.eventkey)
                        if (keyres) {
                            console.log("keyres"+keyres)
                            var sid = keyres[1]
                            scan_code_event(sid)
                            //建立扫码的关系表
                            if(sid.startsWith("$"))
                                makeRelation(sid)


                        } else {
                            res.end()
                        }
                        break
                    case "CLICK":
                        let rettext=yield clickEvent(recdata.eventkey)
                        var xmlres = xml({
                            xml: [
                                {ToUserName: {_cdata: recdata.fromusername}},
                                {FromUserName: {_cdata: recdata.tousername}},
                                {CreateTime: Date.now()},
                                {MsgType: "text"},
                                {Content: rettext},
                            ]
                        })
                        res.send(xmlres)
                        break
                }
        }
        else
            res.end()
    }
}))

router.get('/begin', co.wrap(function *(req, res, next) {
    var wxtool = wxtools(req.query.appid)
    var url = yield wxtool.genAuthUrl(req.query.state)
    res.redirect(url)
}))

router.get('/finish/:appid', co.wrap(function *(req, res, next) {
    var code = req.query.code
    if (!code) {
        res.send("微信数据错误，请退出网页")
        return
    }
    var wxtool = wxtools(req.params.appid)
    req.session.input_state = req.query.state
    var url = `https://api.weixin.qq.com/sns/oauth2/access_token?appid=${yield wxtool.appid()}&secret=${yield wxtool.appsecret()}&code=${code}&grant_type=authorization_code`
    //console.log(url)
    let fres = yield fetch(url)
    let json = yield fres.json();
    //console.log(json)
    if (json.errcode) {
        res.send("微信服务器错误，请退出网页检查")
        return
    }
    let rr=yield memcached.add(`onlyonetime_weixin:${yield wxtool.appid()}|${json.openid}`,'',4)

    var access_token = json.access_token
    var access_expires = Math.floor(new Date() / 1000) + json.expires_in / 2
    var refresh_token = json.refresh_token
    var openid = json.openid
    var scope = json.scope
    req.session.weixin = {
        appid: yield wxtool.appid(),
        token: access_token,
        openid: openid,
        scope: scope,
        expires_time: access_expires,
        reflash_token: refresh_token
    }
    let user_weixin = yield mongo_data.UserInfo.findOne({"weixin.appid":yield wxtool.appid(),"weixin.openid":openid})
    if (user_weixin == null) {
        let json = yield wxtool.user_info(req.session.weixin.token, req.session.weixin.openid)
        if(json.errcode){
            res.send("微信错误:"+json.errmsg)
            return
        }
        const unionid = json.unionid
        let wxuid = yield mongo_data.UserInfo.findOne({weixinuid: unionid})
        if (wxuid == null) {
            let user = yield data_sql.User.create({
                name: json.nickname,
                sex: json.sex,
                location: `${json.city}|${json.province}|${json.country}`,
                balance: 0
            })
            let uid = user.id
            req.session.uid = uid

            let result=yield mongo_data.UserInfo.create({
                _id:uid,
                weixin:{
                    appid: req.session.weixin.appid,
                    openid: req.session.weixin.openid,
                    access_token: req.session.weixin.token,
                    expires_time: req.session.weixin.expires_time,
                    reflash_token: req.session.weixin.reflash_token
                },
                weixinuid:unionid})
            rabbitmq.new_user({user: user})
            res.redirect(redirectTo(req.session.input_state,req.session.weixin))
        }
        else {
            req.session.uid = wxuid._id
            let userinfo=yield mongo_data.UserInfo.update({_id:wxuid._id},{$addToSet:{weixin:{
                appid: req.session.weixin.appid,
                openid: req.session.weixin.openid,
                access_token: req.session.weixin.token,
                expires_time: req.session.weixin.expires_time,
                reflash_token: req.session.weixin.reflash_token
            }}})
            res.redirect(redirectTo(req.session.input_state,req.session.weixin))
        }
    } else {
        yield mongo_data.UserInfo.update({_id:user_weixin._id,"weixin.appid":req.session.weixin.appid,"weixin.openid":req.session.weixin.openid},
            {
                $set: {
                    "weixin.$.access_token": access_token,
                    "weixin.$.refresh_token": refresh_token,
                    "weixin.$.expires_time":access_expires,
                }
            })
        req.session.uid = user_weixin._id
        res.redirect(redirectTo(req.session.input_state,req.session.weixin))
    }
}))

router.get("/wxsign2", co.wrap(function*(req, res, next) {
    console.log(req.headers.referer)
    var wxtool = wxtools(req.session.weixin.appid)
    var ticket = yield wxtool.jsapi_ticket()
    var noncestr = Math.random().toString(36).substr(2)
    var timestamp = new Date().getTime() + ""
    var checkstr = "jsapi_ticket=<{ticket}>&noncestr=<{noncestr}>&timestamp=<{timestamp}>&url=<{url}>".formatO({
        ticket: ticket,
        noncestr: noncestr,
        timestamp: timestamp,
        url: req.headers.referer
    })
    var hash = crypto.createHash('sha1')
    var signature = hash.update(checkstr).digest("hex")
    var page = tplfile.load("weixinsigntpl.js")
    res.setHeader('content-type', 'application/javascript');
    res.send(page.formatO({
        appId: yield wxtool.appid(),
        timestamp: timestamp,
        nonceStr: noncestr,
        signature: signature
    }))
}))
router.post("/paystart", co.wrap(function *(req, res, next) {
    const orderdata = req.body

    var cip = req.ip

    if (cip.lastIndexOf(":: ffff:", 0) === 0)
        cip = cip.substr(7)
    const wxtool = wxtools(req.session.weixin.appid)
    const prise = Math.ceil(parseFloat(orderdata.prise) * 100)
    let dcp=yield dc(orderdata.shopid, orderdata.oliNo, prise / 100, req.session.uid)
    const orderid = wxtool.neworderid()
    let order=yield data_sql.Order.create({
        oid: orderid,
        uid: req.session.uid,
        shopid: orderdata.shopid,
        prise: prise,
        amount: Math.ceil(dcp.discounted_amount * 100),
        type: 1,
        note: "",
        paytype: 2,
        status: 0,
        extendinfo: JSON.stringify({
            weixin: {
                appid: req.session.weixin.appid,
                openid: req.session.weixin.openid,
                mch_id: yield wxtool.mch_id()
            },
            dcp: dcp,
            qrid: orderdata.qrid,
            gunnum: orderdata.gunnum
        })
    })
    let json=yield wxtool.jsapi_unifiedorder({
        body: "微信加油",
        out_trade_no: order.oid,
        total_fee: order.amount,
        spbill_create_ip: cip,
        notify_url: `http://${config.host}/weixin/payres`,
        trade_type: "JSAPI",
        // limit_pay:"no_credit",
        openid: req.session.weixin.openid
    })
    //console.log(json)
    res.json({res: 0,data:json,redirect:`/pay_success_share.html?oid=${orderid}`})
}))

router.post("/chargestart", co.wrap(function *(req, res, next) {
    const orderdata = req.body

    var cip = req.ip

    if (cip.lastIndexOf("::ffff:", 0) === 0)
        cip = cip.substr(7)
    const wxtool = wxtools(req.session.weixin.appid)
    const orderid = wxtool.neworderid()
    let cb=yield charge(orderdata.prise, req.session.uid, req.session.weixin.appid)
    const prise = Math.ceil(parseFloat(orderdata.prise) * 100)
    let order=yield  data_sql.Order.create({
        oid: orderid,
        uid: req.session.uid,
        shopid: 0,
        prise: cb.total * 100,
        amount: prise,
        type: 2,
        note: "",
        paytype: 2,
        status: 0,
        extendinfo: JSON.stringify({
            weixin: {
                appid: req.session.weixin.appid,
                openid: req.session.weixin.openid,
                mch_id: yield wxtool.mch_id()
            },
            bonus: cb
        })
    })
    let json=yield wxtool.jsapi_unifiedorder({
        body: "微信加油预付卡充值",
        out_trade_no: order.oid,
        total_fee: order.amount,
        spbill_create_ip: cip,
        notify_url: `http://${config.host}/weixin/payres`,
        trade_type: "JSAPI",
        // limit_pay:"no_credit",
        openid: req.session.weixin.openid
    })
    res.json(json)
}))
router.post("/payres", co.wrap(function *(req, res, next) {
    var procdata = wx_xml2js(req.body)
    if (procdata.return_code == "SUCCESS") {
        var sign = procdata.sign
        delete procdata.sign
        var wxtool = wxtools(procdata.appid)
        var sign2 = yield wxtool.calsign(procdata)
        if (sign === sign2) {
            console.log("check success")
            let order=yield data_sql.Order.findOne({
                where: {
                    oid: procdata.out_trade_no
                }
            })
            if (order.status == 1)
                throw "order again"
            order.status = 1
            order.paytime = moment(procdata.time_end, 'YYYYMMDDHHmmss').toDate()
            var oldinfo = {}
            if (order.extendinfo != null) {
                oldinfo = JSON.parse(order.extendinfo)
            }
            oldinfo.transaction_id = procdata.transaction_id
            oldinfo.total_fee = procdata.total_fee
            oldinfo.cash_fee = procdata.cash_fee
            order.extendinfo = JSON.stringify(oldinfo)
            order=yield order.save()
            var result = {xml: [{return_code: "SUCCESS"}, {return_msg: "OK"}]}
            result = xml(result)
            //console.log(result)
            res.end(result)
            order_tool.finishOrderWork(order.oid)
        }
    }
}))
router.get("/checkpay", co.wrap(function *(req, res, next) {
    //SUCCESS 20170114124847014310
    //nopay 20170114111511893315
    var wxtool = wxtools(req.query.appid)
    var data = yield wxtool.checkOrderSign(req.query.oid)
    data = wx_js2xml(data)
    let body=yield fetch("https://api.mch.weixin.qq.com/pay/orderquery", {
        body: data,
        method: 'POST'
    })
    let xml=yield body.text()
        // console.log(xml)
    xml2js.parseString(xml, co.wrap(function *(err, result) {
        var xmlele = result.xml
        var procdata = {}
        for (var a in xmlele) {
            procdata[a] = xmlele[a][0]
        }
        if (procdata.return_code == "SUCCESS") {
            var sign = procdata.sign
            delete procdata.sign
            var sign2 = yield wxtool.calsign(procdata)
            if (sign === sign2) {
                console.log("check success")
            }
        }
        res.send(JSON.stringify(xmlele))
    }))
}))
router.post("/setmenu", co.wrap(function *(req, res, next) {
    var wxtool = wxtools(req.query.appid)
    var jsobj = req.body
    let result=yield wxtool.setMenu(jsobj)
    res.json(result)
}))

router.post("/qrcode", co.wrap(function *(req, res) {
    const params = req.body
    if(/^[0-9]+$/.test(params.scene_id)==false){
        res.json({info:"id只能是数字"})
        return
    }
    var wxtool = wxtools(params.appid)
    let qr=yield mongo_data.QrCodeRedirect.update({
        scene_id: params.scene_id,
        appid: yield wxtool.appid(),
    }, {
        $set: {
            redir: params.redir,
            title: params.title,
            desc: params.desc,
            image_url: params.image_url,
            sid:params.sid?params.sid:null,
        }
    }, {
        upsert: true
    })
    let json=yield wxtool.genQRCode(params.temp, params.scene_id)
    res.json(json)
}))

router.post("/qrcode_str", co.wrap(function *(req, res) {
    const params = req.body
    if(/^[A-Za-z0-9]+$/.test(params.scene_str)==false){
        res.json({info:"id只能是字母和数字"})
        return
    }
    var wxtool = wxtools(params.appid)
    let qr=yield mongo_data.QrCodeRedirect.update({
        scene_str: params.scene_str,
        appid: yield wxtool.appid(),
    }, {
        $set: {
            redir: params.redir,
            title: params.title,
            desc: params.desc,
            image_url: params.image_url,
            sid:params.sid?params.sid:null,
        }
    }, {
        upsert: true
    })
    let json=yield wxtool.genQRCodeSceneStr(params.temp, params.scene_str)
    res.json(json)
}))
module.exports = router;
