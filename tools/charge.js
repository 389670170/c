/**
 * Created by chenx on 2017/3/17.
 */
const Promise=require("bluebird")
const mongo_data=require("../datas/mongo")
module.exports=function (price,uid,appid) {
    return new Promise(function (resolve,reject) {
        mongo_data.WXAPPInfo.findOne({_id:appid},{charge_bonus:1}).then(function (winfo) {
            cb=winfo.charge_bonus
            for(let i=cb.length-1;i>=0;i--){
                if(cb[i].charge<=price){
                    resolve({bonus:cb[i].bonus,total:price+cb[i].bonus})
                    return
                }
            }
            resolve({bonus:0,total:price})
        })
    })
}