/**
 * Created by chenx on 2017/3/15.
 */
const log = require('log4js').getLogger('discount_calc');
const mysql_data=require("../datas/mysql");
const mongo_data=require("../datas/mongo");
const Promise=require("bluebird");

module.exports = function (sid,oil,price) {
    return new Promise(function (all_resolve, all_reject) {
        mongo_data.ShopSetting.findById(sid).select({discount: 1}).exec().then(function (ss) {
            let result = {};
            var prop = ss.discount
            result['price'] = price; // 加油金额
            let quantity = price / prop['price'][oil];
            result['oil'] = oil; // 加油油号
            result['quantity'] = Math.floor(quantity * 100) / 100;; // 加油升数
            all_resolve(result);
        })
    })
}