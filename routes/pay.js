const express = require('express');
const duolabao=require('../tools/duolabao')
const config=require("../config")
const tplfile=require("../tools/tplfile")
const sql_data=require("../datas/mysql")
const mongo_data=require("../datas/mongo")
const order_tool=require('../tools/order')
const dc = require('../tools/discount_calc');
const oil_calc=require("../tools/oil_calc")
const Promiss=require("bluebird");
const logger = require('log4js').getLogger('pay');
const Sequelize=require("sequelize")
const co=require("bluebird-co").co
const charge=require('../tools/charge')
const feie=require("../tools/feie")
const rabbitmq=require("../tools/rabbitmq")
const new_order_id=require("../tools/order_id")
const router = express.Router();

router.post('/duolabaopay',function (req, res) {
    var orderdata = req.body
    var prise = Math.ceil(parseFloat(orderdata.prise) * 100)

    dc(orderdata.shopid, orderdata.oliNo, prise / 100, req.session.uid).then(function (dcp) {
        mongo_data.ShopSetting.findOne({_id: orderdata.shopid}, {duolabao: true}).then(function (ss) {
            if(ss.duolabao)
                var duola = duolabao(ss.duolabao.customerNum,ss.duolabao.shopNum)
            else
                var duola = duolabao()
            var orderid = duola.neworderid()
            return sql_data.Order.create({
                oid: orderid,
                uid: req.session.uid,
                shopid: orderdata.shopid,
                prise: prise,
                amount: Math.ceil(dcp.discounted_amount * 100),
                type: 1,
                note: "",
                paytype: 1,
                status: 0,
                extendinfo: JSON.stringify({
                    customerNum: duola.customerNum(),
                    shopNum: duola.shopNum(),
                    weixin: {appid: req.session.weixin.appid, openid: req.session.weixin.openid},
                    dcp: dcp,
                    qrid:orderdata.qrid,
                    gunnum:orderdata.gunnum
                })
            }).then(function (order) {
                duola.create_pay(order.amount / 100 + '', order.oid, `http://${config.host}/pay/duolabaores`,
                    `http://${config.host}/pay_success_share.html?oid=${orderid}`).then(function (json) {
                    res.json({res: 0, redirect: json.data.url})
                })
            })
        })
    })
})
router.get('/duolabaores',function(req, res, next){
    var duola=duolabao()
    //console.log(req.query)
    if(duola.signStrCheck(req.header("timestamp"),req.header("token"))) {
        if (req.query.status == 'SUCCESS') {

            sql_data.Order.findOne({
                where: {
                    oid:req.query.requestNum
                }
            }).then(function (order) {
                if(order.status==1)
                    throw "order finish again";
                order.status=1
                order.paytime=req.query.completeTime
                var oldinfo={}
                if(order.extendinfo!=null){
                    oldinfo=JSON.parse(order.extendinfo)
                }
                oldinfo.orderNum=req.query.orderNum
                oldinfo.orderAmount=req.query.orderAmount
                order.extendinfo=JSON.stringify(oldinfo)
                return order.save()
            }).then(function (order) {
                res.end()
                order_tool.finishOrderWork(order.oid)
            }).catch(function (error) {
                console.log(error)
            })
        }
    }

})

router.get("/order",co.wrap(function *(req,res) {
    let registerFirst =yield mongo_data.WeiXinConfig.findById(req.session.weixin.appid)
    console.log("registerFirst.registerFirst:",registerFirst.registerFirst)
    if(registerFirst.registerFirst== true)
    {
        let usrinfo=yield mongo_data.UserInfo.findOne({_id:req.session.uid}).select({phone:1})
        if (!usrinfo.phone || usrinfo.phone.length==0) {
            req.session.newType=1
            res.redirect(`/login/phone?back=${req.originalUrl}`)
            return
        }
    }
    const sid=req.query.sid || 0
    if(sid) {
        const sql_s=yield sql_data.Shop.findOne({
                where: {
                    id: sid
                }
            })
        const mongo_s=yield mongo_data.ShopSetting.findById(sid).select({discount: 1}).exec()

        var page = tplfile.load("oil_order.html").formatO({
            sid: sql_s.id,
            shopinfo: JSON.stringify(sql_s),
            oilinfo: JSON.stringify(mongo_s.discount.price),
            oilgun:mongo_s.discount.oilgun?JSON.stringify(mongo_s.discount.oilgun):"{}",
            qrid:req.query.qrid
        })
        res.end(page)
    }else{
        var page = tplfile.load("oil_order.html").formatO({
            sid: 0,
            shopinfo: "{}",
            oilinfo: "{}",
            qrid:"",
            oilgun:"{}"
        })
        res.end(page)
    }
}))
router.get("/gpsShopdata",co.wrap(function *(req,res) {
    let mongo_s = yield mongo_data.ShopSetting.findOne({
        pos: {
            $near: [req.query.lng, req.query.lat],
            $maxDistance: 2
        },
        $or: [{wx_appid: req.session.weixin.appid}, {wx_appid: {$exists: false}}]
    },{discount:1}).exec()
    if (mongo_s == null) {
        res.json({errno: 1, message: "无法定位或者附近没有加油站，您可以扫二维码加油。"})
        return
    }
    let sql_s = yield sql_data.Shop.findOne({
        where: {
            id: mongo_s._id
        }
    })

    res.json({
        errno: 0,
        sid: sql_s.id,
        shopinfo: sql_s,
        oilinfo: mongo_s.discount.price,
        oilgun:mongo_s.discount.oilgun?mongo_s.discount.oilgun:{},
    })
}))
router.get("/confirm",co.wrap(function *(req,res) {
    var dcp = yield dc(req.query.sid, req.query.oilNo, req.query.price, req.session.uid)
    var balance = yield getUserBalance(req.session.uid,req.session.weixin.appid)
    const mongo_s=yield mongo_data.ShopSetting.findById(req.query.sid).select({paypattern: 1}).exec()
    const page = tplfile.load("pay_confirm.html")
    var paydata=JSON.stringify({
        sid: req.query.sid,
        price: req.query.price,
        oilNo: req.query.oilNo,
        balance: balance,
        dcp: dcp,
        qrid: req.query.qrid,
        gunnum:req.query.gunnum,
        paypattern:mongo_s.paypattern?mongo_s.paypattern:{}
    })
    res.send(page.formatO({
        paydata: paydata
    }))
}))
const getUserBalance=require("../tools/getUserBalance")
router.post("/balance_pay",co.wrap(function* (req,res) {
    var orderdata = req.body
    let shopseting=yield mongo_data.ShopSetting.findOne({_id:orderdata.shopid},{charge_pay_oil:true})

    if(shopseting.charge_pay_oil.length>0 && shopseting.charge_pay_oil.indexOf(orderdata.oliNo)<0){
        res.json({errno: 3, message: "余额支付不能用于此油号，请和加油员确认"})
        return
    }
    var prise = Math.ceil(parseFloat(orderdata.prise) * 100)
    var orderid = new_order_id()
    var balance = yield getUserBalance(req.session.uid,req.session.weixin.appid)
    if (balance == 0) {
        res.json({errno: 2, message: "余额不足"})
        return
    }
    if (balance < prise) {
        res.json({errno: 1, message: "余额不足"})
        return
    }
    var order = yield sql_data.Order.create({
        oid: orderid,
        uid: req.session.uid,
        shopid: orderdata.shopid,
        prise: prise,
        amount: prise,
        type: 1,
        note: "",
        paytype: 4,
        status: 1,
        paytime: new Date(),
        extendinfo: JSON.stringify({
            weixin: {appid: req.session.weixin.appid, openid: req.session.weixin.openid},
            balance: [balance, balance - prise],
            dcp: yield oil_calc(orderdata.shopid, orderdata.oliNo, prise / 100),
            qrid: orderdata.qrid,
            gunnum:orderdata.gunnum
        })
    })
    order_tool.finishOrderWork(order.oid)
    yield mongo_data.UserInfo.update({_id:req.session.uid,
        "balance.appid":req.session.weixin.appid
    }, {
        $inc: {
            "balance.$.balance":-prise
        }
    })
    res.json({res: 0, redirect:`/pay_success_share.html?oid=${orderid}`})
}));
/*.then(function (order) {
    duola.create_pay(order.amount / 100 + '', order.oid, `http://${config.host}/pay/duolabaores`,
        `http://${config.host}/pay_success_share.html?oid=${orderid}`).then(function (json) {
        res.json({res: 0, redirect: json.data.url})
    })
})*/
router.get('/orderList', function (req, res) {
  sql_data.Order.findAll({
    attributes: ['oid', 'type', 'paytype', 'amount', 'paytime'],
    where: {
      status: 1, // 已支付
      uid: req.session.uid
    },
    limit: 30,
    order: 'paytime desc'
  }).then(function (orders) {
      res.end(tplfile.load('trade_records.html').formatO({
          ordersData: JSON.stringify(orders)
      }));

      if (orders.length > 0) {
          var checkPromise = sql_data.Order.findAll({
              where: {
                  createdAt: {$gt: orders[0].paytime},
                  status: 0,
                  uid: req.session.uid
              }
          })
      } else {
          var checkPromise = sql_data.Order.findAll({
              where: {
                  status: 0,
                  uid: req.session.uid
              }
          })
      }
      checkPromise.then(function (orders) {
          orders.forEach(function (v) {
              order_tool.checkOrderResult(v)
          })
      })
  })
});

/*
 * 订单明细(充值订单和消费订单)
 *   oid -- 订单号; type -- 交易类型,1-消费,2-充值
 */
router.get('/orderDetail/:oid/:type', function (req, res) {
  logger.debug('oid: ' + req.params.oid + " ; type: " + req.params.type);
  let pageName = 'consume_detail.html';
  let attributes = ['oid', 'paytime', 'paytype', 'amount', 'extendinfo', 'shop.name'];
  if(req.params.type == 2) { // 充值
    pageName = 'recharge_detail.html';
    attributes = ['oid', 'paytime', 'paytype', 'amount'];
  }
  sql_data.Order.findOne({
    attributes: attributes,
    where: {oid: req.params.oid},
    include: [sql_data.Shop]
  }).then(function (order) {
    res.end(tplfile.load(pageName).formatO({
      orderData: JSON.stringify(order)
    }));
  }).catch(function (exp) {
    logger.error(exp);
  });
});

router.get('/recharge',co.wrap(function *(req,res) {
    let usrinfo=yield mongo_data.UserInfo.findOne({_id:req.session.uid}).select({phone:1})
  /*  if (!usrinfo.phone || usrinfo.phone.length==0) {
        res.redirect(`/login/phone?back=${req.originalUrl}`)
        return
    }*/
    var balance = yield getUserBalance(req.session.uid,req.session.weixin.appid)
    let user=yield sql_data.User.findOne({
        where: {
            id: req.session.uid
        }
    })
    let wxappinfo=yield mongo_data.WXAPPInfo.findOne({_id: req.session.weixin.appid}, {charge_bonus: 1})

    var userdata = {
        balance: balance ? balance : 0,
        name: user.name,
        phone: usrinfo.phone,
        charge_bonus: wxappinfo.charge_bonus
    }
    var page = tplfile.load("recharge.html")
    res.send(page.formatO({svrdata: JSON.stringify(userdata)}))
}))
router.post('/duolacharge',co.wrap(function *(req, res) {
    var orderdata=req.body
    let cb=yield charge(orderdata.prise,req.session.uid,req.session.weixin.appid)
    let wxinfo=yield mongo_data.WXAPPInfo.findOne({_id:req.session.weixin.appid},{duolabao:true})
    if(wxinfo.duolabao)
        var duola = duolabao(wxinfo.duolabao.customerNum,wxinfo.duolabao.shopNum)
    else
        var duola = duolabao()
    var orderid = duola.neworderid()
    var prise = Math.ceil(parseFloat(orderdata.prise) * 100)
    let order=yield sql_data.Order.create({
        oid: orderid,
        uid: req.session.uid,
        shopid: 0,
        prise: cb.total*100,
        amount: prise,
        type: 2,
        note: "",
        paytype: 1,
        status: 0,
        extendinfo: JSON.stringify({
            customerNum: duola.customerNum(),
            shopNum: duola.shopNum(),
            weixin: {appid: req.session.weixin.appid, openid: req.session.weixin.openid},
            bonus:cb
        })
    })
    let json=yield duola.create_pay(order.amount / 100 + '', order.oid, `http://${config.host}/pay/duolabaores`,`http://${config.host}/Pay_success.html?type=2`)
    if(json.result=='fail'){
        logger.error(json)
        res.end()
    }else {
        res.json({res: 0, redirect: json.data.url})
    }
}))
router.get('/ticket_print/:oid',co.wrap(function *(req,res) {
    let order=yield sql_data.Order.findOne({
        where:{
            oid:req.params.oid
        },
        include: [ sql_data.User ,sql_data.Shop]
    })
    if(!order){
        res.send("print_callback(1)")
        return
    }
    let exinfo=JSON.parse(order.extendinfo)
    let sdata= yield mongo_data.ShopSetting.findById(order.shop.id).select({printer:1}).exec()
    for(k in sdata.printer){
        if(k=="feie") {
            const sk=sdata.printer[k]
            console.log(sk)
            feie({
                printer_sn:sk.sn,
                key:sk.key,
                data:order
            })
        }
    }
    res.send("print_callback(0)")
}))
router.get("/order_trans",co.wrap(function *(req,res) {
    let order=yield sql_data.Order.findOne({
        where:{
            oid:req.query.oid
        },
        include: [ sql_data.User ,sql_data.Shop]
    })
    if(order && order.status!=0) {
        switch (order.type) {
            case 1:
                rabbitmq.order_finish("order.finish", order)
                break
            case 2:
                rabbitmq.order_finish("charge.finish", order)
                break
        }
    }
    res.send("ok")
}))
module.exports = router;

/*
 GET /pay/duolabaopay 302 81.640 ms - 250
 { orderAmount: '0.01',
 status: 'SUCCESS',
 requestNum: '20170111174517696803',
 orderNum: '10021014841279205174842',
 completeTime: '2017-01-11 17:45:45' }
 1484127945481
 10E56B6FDEA876683C26E8D818ABE26E3AEEEB2C

 */