/**
 * Created by chenx on 2017/2/23.
 */
const express = require('express');
const config=require("../config")
const tplfile=require("../tools/tplfile")
const mongo_data=require("../datas/mongo")
const monent=require("moment")
const mysql_data=require("../datas/mysql")
const wxtools=require('../tools/weixin');
const co=require("bluebird-co").co
const logger = require('log4js').getLogger('coupon');

const router = express.Router();
router.get("/share",co.wrap(function *(req,res) {
    let usrinfo=yield mongo_data.UserInfo.findOne({_id:req.session.uid}).select({phone:1})
    if (!usrinfo.phone || usrinfo.phone.length==0) {
        req.session.newType=1
        res.redirect(`/login/phone?back=${req.originalUrl}`)
        return
    }
    let cg=yield mongo_data.CouponGen.findById(req.query.src).exec()
    if (cg == null) {
        res.end("链接错误")
        return
    }

    let cn=yield mongo_data.Coupon.findOne({
        genid:req.query.src,
        uid:req.session.uid
    }).exec()

    var cpdata=null
    if(cn==null){
        const rule = cg.rule
        if (rule.enable) {
            var enddate = monent().add(rule.day_limit, "day").toDate()
            enddate.setHours(23);
            enddate.setMinutes(59);
            enddate.setSeconds(59);
            enddate.setMilliseconds(0)
            cn=yield mongo_data.Coupon.create({
                uid: req.session.uid,
                genid: cg._id,
                for_shop_str: rule.for_shop_str,
                for_shop: rule.for_shop,
                limit_time: enddate,
                pay_price: rule.pay_price,
                amount: rule.low + Math.floor(Math.random() * (rule.high - rule.low + 1))
            })
            var res_txt="new"
        } else {
            cpdata={res: "error", message: "红包已失效"}
        }
    }else{
        var res_txt="exists"
    }
    if(cn){
        let shops=yield mysql_data.Shop.findAll({
            where:{id:{in: cn.for_shop}},
        })
        cpdata={res:res_txt,coupon:cn,shops:shops}
    }

    var wxtool = wxtools(req.session.weixin.appid)
    const page = tplfile.load("coupon_share.html")
    res.send(page.formatO({
        sharelink: yield wxtool.genSrcUrl(`sharecoupon:${cg._id.toString()}`),
        coupon: JSON.stringify(cpdata)
    }))
}))
router.get("/startShare",co.wrap(function *(req,res) {
    let cg=yield mongo_data.CouponGen.findById(req.query.src).exec()
    if(cg==null){
        res.end("链接错误")
        return
    }
    var wxtool=wxtools(req.session.weixin.appid)
    const page=tplfile.load("coupon_share_start.html")
    res.end(page.formatO({
        sharelink:yield wxtool.genSrcUrl(`sharecoupon:${cg._id.toString()}`),
        forshop_str:cg.rule.for_shop_str
    }))
}))
router.get("/findStatus",co.wrap(function *(req,res){
    let fg = yield mongo_data.OrderMOdel.findById(req.query.oid).exec()
    console.log("fg：",fg)
    if(fg==null) {
        res.end(JSON.stringify({res:2}))
        //订单没有支付成功
        return
    }
    let cg=yield mongo_data.CouponGen.find({"oid":req.query.oid}).exec()
    console.log("cg:",cg)
    if(cg.length==0){
        //没有生成红包
        res.end(JSON.stringify({res:1}))
    }
    else{
        res.end(JSON.stringify({res:0,coupon:cg[0]._id}))
    }
}))
/*
const CouponGenRule=mongoose.Schema({
    enable:Boolean,
    low:Number,
    high:Number,
    create_price:Number,
    pay_price:Number,
    day_limit:Number,
    for_shop:[Number],
    startTime:Date,
    endTime:Date
},{ _id : false })
const CouponSchema=mongoose.Schema({
    uid:{
        type:Number,
        index: true
    },
    create_time:{
        type: Date, default: Date.now
    },
    genid:mongoose.Schema.Types.ObjectId,
    for_shop:[Number],
    limit_time:Date,
    pay_price:Number,
    use_oid:{
        type:Number,
        index:true,
        sparse: true
    }
})*/

router.get('/list', co.wrap(function *(req, res) {
    let usrinfo=yield mongo_data.UserInfo.findOne({_id:req.session.uid}).select({phone:1})
   /* if (!usrinfo.phone || usrinfo.phone.length==0) {
        res.redirect(`/login/phone?back=${req.originalUrl}`)
        return
    }*/
    let data=yield mongo_data.Coupon.find({uid: req.session.uid}).sort({create_time: -1}).limit(30).exec()
    let page = tplfile.load("coupons.html");
    res.end(page.formatO({
        coupons: JSON.stringify(data)
    }));
}));

/** 查询通用优惠券列表 */
router.get('/listExCoupon', co.wrap(function* (req, res) {
  let excoupons = yield mongo_data.ExCoupon.find({
    uid: req.session.uid,
    use_shop: {$exists:false},
    limit_time: {$gte:new Date()}
  });

  res.end(tplfile.load('carCoupon.html').formatO({
    excoupons: JSON.stringify(excoupons)
  }));
}));
router.get("/firstCoupon",co.wrap(function *(req,res) {
    console.log("session:"+req.session.newType)
    let usrinfo = yield mongo_data.UserInfo.findOne({_id: req.session.uid});
    let rule1=yield mongo_data.WXAPPInfo.findById(req.session.weixin.appid).exec();
    var time1=new Date()
    console.log("couponType",rule1.first[0].enable)
    if (!usrinfo.phone || usrinfo.phone.length == 0) {
        req.session.newType=1
        res.redirect(`/login/phone?back=${req.originalUrl}`);
        return
    }
    if(typeof(req.session.newType) == "undefined"){
        console.log("req.session.newType:",req.session.newType)
        res.redirect("/Pay_success.html?type=1&status=1")
        return
    }
    if(!rule1.first || rule1.first[0].enable == false){
        console.log("rule1:"+rule1)
        yield mongo_data.UserInfo.update({_id: req.session.uid},{$set:{couponType:1}})
        res.redirect("/Pay_success.html?type=1&status=2")
        return
    }
    if(rule1.first[0].startTime>time1 || rule1.first[0].endTime<time1){
        console.log("time1:",time1)
        yield mongo_data.UserInfo.update({_id: req.session.uid},{$set:{couponType:1}})
        res.redirect("/Pay_success.html?type=1&status=2")
        return
    }
     if(!usrinfo.couponType || usrinfo.couponType.length == 0 ||typeof usrinfo.couponType =="undefined"){
         console.log("走这里了吗usrinfo")
        let cg=yield mongo_data.WXAPPInfo.findById(req.session.weixin.appid).exec();
         console.log("cg:",cg.first_set)
         console.log("cg:",cg.first_set.length)
         for(var i =0;i<cg.first_set.length;i++){
        const rule1 = cg.first;
        const rule = cg.first_set[i];0
             console.log("rule1:",rule1)
             console.log("rule1:",rule1[0].for_shop_str)
        var enddate = monent().add(rule.day_limit, "day").toDate()
        enddate.setHours(23);
        enddate.setMinutes(59);
        enddate.setSeconds(59);
        enddate.setMilliseconds(0);
    cn = yield mongo_data.Coupon.create({
        uid: req.session.uid,
        for_shop_str: rule1[0].for_shop_str,
        for_shop: rule1[0].for_shop,
        limit_time: enddate,
        pay_price: rule.pay_price,
        firstCoupon: true,
        amount: rule.low + Math.floor(Math.random() * (rule.high - rule.low + 1))
    });}
        yield mongo_data.UserInfo.update({_id: req.session.uid},{$set:{couponType:1}})
        //成功领取
       // const page = tplfile.load("Pay_success.html?type=1&status=0");
        res.redirect("/Pay_success.html?type=1&status=0")
         return
    }
    console.log("走这里了吗")
        //已经领取过红包
     //   const page = tplfile.load("Pay_success.html?type=1&status=1");
        res.redirect("/Pay_success.html?type=1&status=1")

}));
module.exports = router;