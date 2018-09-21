var mongoose = require('mongoose');
var config = require("../config")
mongoose.Promise = require('bluebird');
mongoose.connect(config.mongo.link, {
    server: { poolSize: 5 },
});
var db = mongoose.connection
db.on('error', function (error) {
    console.error(error)
});
db.on('open', function () {
    console.log("mongodb connected")
});

const CouponGenRule = mongoose.Schema({
    enable: Boolean,
    low: Number,
    high: Number,
    create_price: Number,
    pay_price: Number,
    day_limit: Number,
    for_shop_str: String,
    for_shop: [Number],
    startTime: Date,
    endTime: Date
}, {_id: false})
const CouponSchema = mongoose.Schema({
    uid: {
        type: Number,
        index: true
    },
    create_time: {
        type: Date, default: Date.now
    },
    genid: mongoose.Schema.Types.ObjectId,
    for_shop_str: String,
    for_shop: [Number],
    limit_time: Date,
    pay_price: Number,
    amount: Number,
    firstCoupon:Boolean,
    use_oid: {
        type: String,
        index: true,
        sparse: true
    }
})
CouponSchema.index({uid: 1, genid: 1})

const duolabaoSchema = mongoose.Schema({
    customerNum: String,
    shopNum: String,
}, {_id: false})
const alipaySchema = mongoose.Schema({
    app_id: String,
}, {_id: false})
const defines = {}
defines.ShopSetting = db.model("Shop", {
    _id: Number,
    pos: {
        type: [Number],  // [<longitude>, <latitude>]
        index: '2d',      // create the geospatial index
        sparse: true
    },
    discount: Object,
    printer: Object,
    print_count:{type: Number, default: 1},
    wx_appid: String,
    alipay: alipaySchema,
    duolabao: duolabaoSchema,
    coupongen: CouponGenRule,
    excoupon:[{
        _id:false,
        business:Number,
        create_price: Number,
        day_limit: Number,
        for_shop_str: String,
        for_shop: [mongoose.Schema.Types.ObjectId],
        startTime: Date,
        endTime: Date
    }],
    paypattern:Object,
    charge_pay_oil:Array,
})
defines.CouponGen = db.model("CouponGen", {
    uid: {
        type: Number,
        index: true
    },
    oid: {
        type: String,
        index: true
    },
    sid: {
        type: Number,
        index: true
    },
    rule: CouponGenRule
})
defines.Coupon = db.model("Coupon", CouponSchema)
defines.OrderMOdel= db.model('order_loger', {
    _id:String,
    shopid: Number,
    prise: Number,
    amount: Number,
    paytime: Date,
    type: Number,
    status: Number,
    oid: String,
    uid: Number
}, 'order_loger'),
defines.ExCoupon=db.model("ExCoupon",{
    uid: {
        type: Number,
        index: true
    },
    create_time: {
        type: Date, default: Date.now
    },
    business:Number,
    byshop:{type:Number,index:true},
    fororder:String,
    for_shop_str: String,
    for_shop: [mongoose.Schema.Types.ObjectId],
    limit_time: Date,
    use_time:Date,
    use_shop:mongoose.Schema.Types.ObjectId
},"ExCoupon")
const QrCodeSchema=mongoose.Schema({
    scene_id: Number,
    scene_str:String,
    sid: Number,
    appid: String,
    redir: String,
    title:String,
    desc:String,
    image_url:String,
})
QrCodeSchema.index({appid:1,scene_id:1})
QrCodeSchema.index({appid:1,scene_str:1})
defines.QrCodeRedirect = db.model("qrcoderedirect", QrCodeSchema)

const Charge_Bonus = mongoose.Schema({
    charge:Number,
    bonus:Number,
}, {_id: false})
defines.WXAPPInfo=db.model("wxappinfo",{
    _id:String,
    charge_bonus:[Charge_Bonus],
    duolabao: duolabaoSchema,
    first:[{
        _id:false,
        enable: Boolean,
    for_shop_str: String,
    for_shop: [Number],
    startTime: Date,
    endTime: Date}],
    first_set:[{
        low: Number,
        high: Number,
        pay_price: Number,
        day_limit: Number
    }]
})
defines.Alipay=db.model("alipay",{
    _id: String,
    alipubkey:String
},"alipay")
defines.Relation=db.model("relation",{
    create_time: {
        type: Date, default: Date.now
    },
    scene_id:Number,
    scene_str:String,
    openid:String,
    appid: String
},"relation")
const WeiXinConfSchema=mongoose.Schema({
    _id:String,
    appsecret:String,
    pay_key:String,
    mch_id:String,
    registerFirst:Boolean,
    sid:{type:String,index:true},
    msgtpl:{order_finish:String,
        charge_finish:String},
})
defines.WeiXinConfig=db.model("weixin",WeiXinConfSchema,"weixin")
const UserInfoSchema=mongoose.Schema({
    _id:Number,
    weixin:[{
        _id:false,
        appid:String,
        openid:String,
        access_token:String,
        expires_time:Number,
        reflash_token:String
    }],
    weixinuid:String,
    phone:[String],
    balance:[{_id:false,appid:String,balance:Number}],
    couponType:Number,
    newType:Number

})
UserInfoSchema.index({"weixin.appid":1,"weixin.openid":1},{ sparse: true ,unique: true})
UserInfoSchema.index({"_id":1,"balance.appid":1},{ sparse: true ,unique: true})
UserInfoSchema.index({weixinuid:1},{ sparse: true ,unique: true})
UserInfoSchema.index({phone:1},{ sparse: true})
defines.UserInfo=db.model("userinfo",UserInfoSchema,"userinfo")
module.exports = defines