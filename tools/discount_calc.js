/**
 * 油价 优惠 计算
 * Created by haoran.shu on 2017/2/17.
 */
const log = require('log4js').getLogger('discount_calc');
const mysql_data=require("../datas/mysql");
const mongo_data=require("../datas/mongo");
const Promise=require("bluebird");


/**
 * 计算油价优惠
 * @param prop    优惠配置
 * @param oil     油号
 * @param price   加油金额
 * @param result  结果配置
 */
function calcNormalDiscount(prop, oil, price, result) {
  let dp = 0; // 优惠油价
  try {
    log.info(JSON.stringify(prop));
    result['price'] = price; // 加油金额
    let quantity = price / prop['price'][oil]; // 加油升数
    let timeProp = prop['discount']['period'][oil]; // 限时优惠
    let isPeriod = false; // 是否进行了限时优惠
    if(timeProp) { // 限时优惠
      let timePrice = timeProp['amount'];
      let startDate = timeProp['startDate'];
      let endDate = timeProp['endDate'];

      if(startDate && endDate && timePrice) {
        //log.info('startDate: ' + startDate + " ; endDate: " + endDate);
        startDate = Date.parse(startDate.replace("-", "/"));
        endDate = Date.parse(endDate.replace("-", "/"));
        let currentTime = Date.now();
        log.info("starttime: " + startDate + " ; endtime: " + endDate + " ; currenttime: " + currentTime);
        if(currentTime >= startDate && currentTime < endDate) {
          isPeriod = true;
          // 优惠价格, 向下取整, 保留两位小数
          dp = floorNumber(timePrice * quantity) || 0;
        }
      }
    }
    if(!isPeriod) { // 平时优惠
      // 优惠价格, 向下取整, 保留两位小数
      dp = floorNumber(prop['discount']['usually'][oil] * quantity) || 0;
    }
    price = ceilAmount(price - dp);
    result['oil'] = oil; // 加油油号
    result['quantity'] = floorNumber(quantity); // 加油升数
  } catch (exp) {
    log.warn(exp);
  } finally {
    result['discount'] = [{'name': '油价优惠', 'value': dp}];
    result['discounted_amount'] = price; // 惠后金额
  }
}

/**
 * 计算满减优惠
 * @param prop    优惠配置
 * @param result  结果配置
 */
function calcReduceDiscount(prop, result) {
  /* 3. 满减优惠(基于之前优惠后的基础上(包括红包!)) */
  try {
    let reduceRules = prop['discount']['reduce'];
    // 倒叙遍历匹配满减优惠规则
    for(let i = reduceRules.length - 1; i >= 0; i--) {
      if(result['price'] >= reduceRules[i][0]) {
        result['discount'].push({'name': '满减优惠', 'value': reduceRules[i][1]});
        result['discounted_amount'] = ceilAmount(result['discounted_amount'] - reduceRules[i][1]);
        break;
      }
    }
  } catch(exp) {
    //console.warn(exp)
  }
}

function calcCoupon(cp,result) {
  try {
      result['discount'].push({'name': '红包优惠', 'value': cp.amount});
      result['coupon']=cp
      result['discounted_amount'] = ceilAmount(result['discounted_amount'] - cp.amount);
  }catch (e){
    //console.warn(e)
  }
}

/**
 * 将金额保留两位小数(向上取整)
 * @param amount      需要进行小数保留的数
 * @returns {number}  取整保留两位小数后的小数
 */
function ceilAmount(amount) {
  return Math.ceil(amount * 100) / 100;
}

/**
 * 将数保留两位小数(向下取整)
 * @param number      需要进行小数保留的数
 * @returns {number}  取整保留两位小数后的小数
 */
function floorNumber(number) {
  return Math.floor(number * 100) / 100;
}
/**
 * 计算优惠油价
 * {
 *  price // 加油金额
 *  oil // 加油油号
 *  quantity // 加油升数
 *  discounted_amount // 惠后金额(应付金额)
 *  [……]
 * }
 * @param sid   店铺id
 * @param oil     加油油号
 * @param price   加油金额
 */

module.exports = function (sid,oil,price,uid) {
    return new Promise(function(all_resolve, all_reject){
        let d = {}; // 保存计算的结果
        var prop=null
        Promise.all([mongo_data.ShopSetting.findById(sid).select({discount:1}).exec(),mongo_data.Coupon.findOne({
            use_oid:{$exists:false},
            for_shop:sid,
            uid:uid,
            pay_price:{$lte:price},
            limit_time:{$gt:new Date()}
        }).sort({amount:-1,limit_time:1}).exec()])
        .then(function (ls) {
            let ss=ls[0]
            let cp=ls[1]
            prop=ss.discount
            calcNormalDiscount(prop, oil, price, d); // 计算普通优惠
            //console.log(d)
              if(cp){
                  calcCoupon(cp,d)
                  //console.log(d)
              }
            calcReduceDiscount(prop, d); // 计算满减优惠
            //console.log(d)
            all_resolve(d);
        })
    })
}