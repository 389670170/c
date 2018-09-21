/**
 * Created by chenx on 2017/2/9.
 */
const sql_data=require("../datas/mysql")
const wxtools=require('../tools/weixin')
const moment=require("moment")
const config=require("../config")
const mongo_data=require("../datas/mongo")
const feie=require("../tools/feie")
const logger=require("log4js").getLogger("orderAfer")
const duolabao=require('../tools/duolabao')
const rabbitmq=require("./rabbitmq")
const Sequelize=require("sequelize")
const co = require("bluebird-co").co
const monent=require("moment")
const getUserBalance=require("./getUserBalance")
var Alipayment=null
try {
    Alipayment = require("./alipay")
}catch (e){
}
moment.locale('zh-cn')
function reprintTicket(oid) {
    sql_data.Order.findOne({
        where:{
            oid:oid
        },
        include: [ sql_data.User ,sql_data.Shop]
    }).then(function (order) {
        mongo_data.ShopSetting.findById(shop.id).select({printer:1}).exec().then(function (sdata) {
            for (k in sdata.printer) {
                if (k == "feie") {
                    const sk = sdata.printer[k]
                    feie({
                        printer_sn: sk.sn,
                        key: sk.key,
                        data: order
                    })
                }
            }
        })
    })
}
function finishOrderWork(oid) {
    sql_data.Order.findOne({
        where:{
            oid:oid
        },
        include: [ sql_data.User ,sql_data.Shop]
    }).then(function (order) {
        switch (order.type){
            case 1:
                buyOrder(order)
                break
            case 2:
                chargeOrder(order)
                break
        }
    })
}
var buyOrder=co.wrap(function *(order) {
    let exinfo=JSON.parse(order.extendinfo)
    try {
        if(exinfo.dcp.coupon) {
            let res=yield mongo_data.Coupon.update({_id: exinfo.dcp.coupon._id}, {$set: {use_oid: order.oid}}).exec()
        }
    }catch (e){
        logger.error(e)
    }
    rabbitmq.order_finish("order.finish",order)
    const shop=order.shop

    let sdata=yield mongo_data.ShopSetting.findById(shop.id).select({printer:1,print_count:1,coupongen:1,excoupon:1}).exec()

    var print_count=sdata.print_count
    for(k in sdata.printer){
        if(k=="feie") {
            const sk=sdata.printer[k]
            for(let i=0;i<print_count;i++)
            feie({
                printer_sn:sk.sn,
                key:sk.key,
                data:order
            })
        }
    }
    var cps=[]
    try {
        if (sdata.excoupon && sdata.excoupon.length > 0) {
            sdata.excoupon.forEach(function (one) {
                if (one.create_price <= (order.prise / 100) &&
                    one.startTime <= order.paytime && one.endTime >= order.paytime) {
                    var enddate = monent().add(one.day_limit, "day").toDate()
                    enddate.setHours(23);
                    enddate.setMinutes(59);
                    enddate.setSeconds(59);
                    enddate.setMilliseconds(0)

                    cps.push({
                        uid: order.uid,
                        create_time: new Date(),
                        business: one.business,
                        byshop: order.shopid,
                        fororder: order.oid,
                        for_shop_str: one.for_shop_str,
                        for_shop: one.for_shop,
                        limit_time: enddate,
                    })
                }
            })
            if (cps.length > 0) {
                let res = yield mongo_data.ExCoupon.insertMany(cps)
            }
        }
    }catch(e){
        console.log(e)
    }
    if(sdata.coupongen && sdata.coupongen.enable && sdata.coupongen.create_price<=(order.prise/100) &&
        sdata.coupongen.startTime<=order.paytime && sdata.coupongen.endTime>=order.paytime) {
        let cgen=yield mongo_data.CouponGen.create({
            uid: order.uid,
            oid: order.oid,
            sid: order.shopid,
            rule: sdata.coupongen
        })
        sendWeixinMessage(order,`sharecouponstart:${cgen._id}`,cps.length)
    }
    else{
        sendWeixinMessage(order,null,cps.length)
    }
})
var chargeOrder=co.wrap(function *(order) {
    let exinfo=JSON.parse(order.extendinfo)
    const user=order.user
    rabbitmq.order_finish("charge.finish",order)

    let res=yield mongo_data.UserInfo.update({_id:user.id,
        "balance.appid":exinfo.weixin.appid
    }, {
        $inc: {
            "balance.$.balance":order.prise
        }
    })
    if(res.nModified==0){
        res=yield mongo_data.UserInfo.update({_id:user.id}, {
            $addToSet: {
                balance:{appid:exinfo.weixin.appid,balance:order.prise}
            }
        })
    }

    let balance=yield getUserBalance(user.id,exinfo.weixin.appid)
    const wxtool=wxtools(exinfo.weixin.appid)
    msg={
        "touser":exinfo.weixin.openid,
        "template_id":(yield wxtool.msgtpl()).charge_finish,
        "url":null,
        "topcolor":"#FF0000",
        "data":{
            "first": {
                "value":user.name,
                "color":"#173177"
            },
            "keyword1":{
                "value":"加油卡充值",
                "color":"#173177"
            },
            "keyword2":{
                "value":order.oid,
                "color":"#173177"
            },
            "keyword3":{
                "value":`人民币${order.amount/100}元`,
                "color":"#173177"
            },
            "keyword4":{
                "value":moment(order.paytime).format('YYYY Mo Do, HH:mm:ss'),
                "color":"#173177"
            },
            "remark":{
                "value":`您的余额还有${balance/100}元，本次赠金${exinfo.bonus.bonus}元`,
                "color":"#173177"
            },
        }
    }
    let json=yield wxtool.sendTemplateMessage(msg)
    console.log(json)

})
var sendWeixinMessage=co.wrap(function *(order,jump,excouponcount) {
    const user=order.user
    const shop=order.shop
    let exinfo=JSON.parse(order.extendinfo)
    const wxtool=wxtools(exinfo.weixin.appid)
    msg={
        "touser":exinfo.weixin.openid,
        "template_id":(yield wxtool.msgtpl()).order_finish,
        "url":jump?(yield wxtool.genAuthUrl(jump)):null,
        "topcolor":"#FF0000",
        "data":{
            "first": {
                "value":user.name,
                "color":"#173177"
            },
            "keyword1":{
                "value":order.oid,
                "color":"#173177"
            },
            "keyword2":{
                "value":`人民币${order.amount/100}元`,
                "color":"#173177"
            },
            "keyword3":{
                "value":shop.name,
                "color":"#173177"
            },
            "keyword4":{
                "value":moment(order.paytime).format('YYYY Mo Do, HH:mm:ss'),
                "color":"#173177"
            },
            "remark":{
                "value":(jump?"点击获得红包.":"谢谢惠顾.")+(excouponcount?`您得到${excouponcount}张抵用券`:""),
                "color":"#173177"
            },
        }
    }
    let json=yield wxtool.sendTemplateMessage(msg)
    console.log(json)
})

var checkOrderResult=co.wrap(function *(order){
    const exdata=JSON.parse(order.extendinfo)
    switch(order.paytype){
        case 1://duola
            var duola=duolabao(exdata.customerNum,exdata.shopNum)
            let json=yield duola.check_result(order.oid)
            if(json.result==="success" ){
                const data=json.data
                if(data && data.status=="SUCCESS") {
                    order.status = 1
                    order.paytime = data.completeTime
                    exdata.orderNum = data.orderNum
                    exdata.orderAmount = data.orderAmount
                    order.extendinfo = JSON.stringify(exdata)
                    let od=yield order.save()
                    finishOrderWork(od.oid)
                }
            }
            break;
        case 2://weixin
            const wxtool=wxtools(exdata.weixin.appid)
            let procdata=yield wxtool.checkOrder(order.oid)
            if(procdata.return_code=="SUCCESS") {
                var sign = procdata.sign
                delete procdata.sign
                var sign2 = yield wxtool.calsign(procdata)
                if (sign === sign2) {
                    if(procdata.result_code=='SUCCESS' && procdata.trade_state=="SUCCESS"){
                        order.status=1
                        order.paytime=moment(procdata.time_end, 'YYYYMMDDHHmmss').toDate()
                        exdata.transaction_id=procdata.transaction_id
                        exdata.total_fee=procdata.total_fee
                        exdata.cash_fee=procdata.cash_fee
                        order.extendinfo=JSON.stringify(exdata)
                        let od=yield order.save()
                        finishOrderWork(od.oid)
                    }
                }
            }
            break;
        case 3://alipay
            if(Alipayment) {
                const alipay = Alipayment();
                let resparam=yield alipay.request({
                    method: "alipay.trade.query",
                    sign_type: "RSA2",
                    app_id:exdata.alipay.appid,
                    biz_content: JSON.stringify({
                        out_trade_no: order.oid
                    })
                })
                if(resparam.trade_status=="TRADE_SUCCESS"){
                    order.status=1
                    order.paytime=resparam.send_pay_date
                    exdata.orderNum=resparam.trade_no
                    exdata.orderAmount=resparam.total_amount
                    order.extendinfo=JSON.stringify(exdata)
                    let od=yield order.save()
                    finishOrderWork(od.oid)
                }
            }
            break;
    }
})

module.exports.finishOrderWork=finishOrderWork
module.exports.checkOrderResult=checkOrderResult
module.exports.reprintTicket=reprintTicket

/*sql_data.Order.findAll({where:{status:0,paytype:3},limit:1,order:[["createdAt","desc"],]}).then(function (results) {
    results.forEach(function (v) {
        checkOrderResult(v)
    })
})*/