/**
 * Created by amen on 2/13/17.
 */
const express = require('express');
const Alipayment=require("../tools/alipay")
const config=require("../config")
const querystring = require('querystring')
const dateFormat = require('dateformat');
const sql_data=require("../datas/mysql")
const mongo_data=require("../datas/mongo")
const order_tool=require('../tools/order')
const dc = require('../tools/discount_calc');
const co=require("bluebird-co").co
const new_order_id=require("../tools/order_id")
const tplfile=require("../tools/tplfile")
const router = express.Router();


router.post("/start",co.wrap(function * (req,res) {
    var app_id="2017030606071346"
    const alipay = Alipayment();
//gateway线上: https://openapi.alipay.com/gateway.do
//gateway sanbox: https://openapi.alipaydev.com/gateway.do
    const orderdata = req.body
    const prise = Math.ceil(parseFloat(orderdata.prise) * 100)
    var sp=yield mongo_data.ShopSetting.findOne({_id:orderdata.shopid}).select({alipay:1})
    if(sp && sp.alipay && sp.alipay.app_id)
    {
        app_id=sp.alipay.app_id
    }
    var dcp=yield dc(orderdata.shopid, orderdata.oliNo, prise / 100, req.session.uid)
    const orderid = new_order_id()
    var order=yield sql_data.Order.create({
            oid: orderid,
            uid: req.session.uid,
            shopid: orderdata.shopid,
            prise: prise,
            amount: Math.ceil(dcp.discounted_amount * 100),
            type: 1,
            note: "",
            paytype: 3,
            status: 0,
            extendinfo: JSON.stringify({
                alipay: {appid: app_id},
                weixin: {appid: req.session.weixin.appid, openid: req.session.weixin.openid},
                dcp: dcp,
                qrid:orderdata.qrid,
                gunnum:orderdata.gunnum
            })
    })
    var rediruri = alipay.getRequestURI({
        method: "alipay.trade.wap.pay",
        sign_type: "RSA2",
        notify_url: `http://${config.host}/alipay/finish`,//`http://${config.host}/alipay/finish`,
        app_id:app_id,
        biz_content: JSON.stringify({
            body: "支付宝加油",
            subject: "支付宝加油",
            out_trade_no: order.oid,
            total_amount: order.amount / 100+"",
            product_code: "QUICK_WAP_PAY",
        })
    });
    //console.log(rediruri)
    res.json({res: 0, redirect: rediruri})
}))
router.post("/finish",function (req,res) {
    const resparam=req.body
    const alipay = Alipayment(resparam.app_id);
    const vres=alipay.verifySign(resparam)
    if(vres && resparam.trade_status=="TRADE_SUCCESS"){
        sql_data.Order.findOne({
            where: {
                oid:resparam.out_trade_no
            }
        }).then(function (order) {
            if(order.status==1){
                res.end("success")
                return
            }
            order.status=1
            order.paytime=resparam.gmt_payment
            var oldinfo={}
            if(order.extendinfo!=null){
                oldinfo=JSON.parse(order.extendinfo)
            }
            oldinfo.alipay.seller_id=resparam.seller_id
            oldinfo.orderNum=resparam.trade_no
            oldinfo.orderAmount=resparam.total_amount
            order.extendinfo=JSON.stringify(oldinfo)
            return order.save()
        }).then(function (order) {
            order_tool.finishOrderWork(order.oid)
            res.end("success")
        })
    }
})
router.get("/auth",co.wrap(function *(req,res) {
    const alipay = Alipayment();
    let ret=yield alipay.request({
        method: "alipay.open.auth.token.app",
        sign_type: "RSA2",
        app_id:req.query.app_id,
        biz_content: JSON.stringify({
            grant_type: "authorization_code",
            code:req.query.app_auth_code
        })
    })
    console.log(ret)
    res.end()
}))
router.get("/check",co.wrap(function *(req,res) {
    const alipay = Alipayment();
    let body=yield alipay.request({
        method: "alipay.trade.query",
        sign_type: "RSA2",
        app_id:req.query.app_id,
        biz_content: JSON.stringify({
                out_trade_no: req.query.oid
        })
    })
    res.json(body)
}))
router.get("/qrpay",co.wrap(function *(req,res) {
    const alipay = Alipayment();
    let ret=yield alipay.request({
        method: "alipay.trade.precreate",
        sign_type: "RSA2",
        app_id: "2017030606071346",
        notify_url: `http://${config.host}/alipay/qrfin`,
        biz_content: JSON.stringify({
            out_trade_no: new_order_id(),
            total_amount: '0.01',
            subject: 'oil'
        })
    })
    //带中文失败，返回值验签失败，需要修改request不验签返回值
    const page=tplfile.load("qrcode.html")
    res.send(page.formatO({data:ret.qr_code}))
}))
router.post("/qrfin",co.wrap(function *(req,res) {
    const resparam=req.body
    console.log(resparam)
    const alipay = Alipayment(resparam.app_id);
    const vres=alipay.verifySign(resparam)
    if(vres && resparam.trade_status=="TRADE_SUCCESS"){
        res.send("success")
    }
}))
module.exports = router;
