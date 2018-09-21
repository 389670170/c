/**
 * Created by chenx on 2017/6/22.
 */
const co = require("bluebird-co").co
const mongo_data=require("../datas/mongo")
module.exports=co.wrap(function *(uid,appid) {
    let user_balance = yield mongo_data.UserInfo.aggregate([
        { $match: {_id:uid}},
        { $project: {
            balance: {$filter: {
                input: '$balance',
                as: 'item',
                cond: {$eq:['$$item.appid',appid]}
            }}
        }}
    ])
    var balance = 0
    if (user_balance && user_balance.length>0) {
        if (user_balance[0].balance && user_balance[0].balance.length > 0) {
            balance = user_balance[0].balance[0].balance
        }
    }
    return balance
})