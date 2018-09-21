/**
 * Created by chenx on 2017/5/25.
 */
const dateFormat = require('dateformat');
module.exports=function () {
    var now = new Date();
    return dateFormat(now,"yyyymmddHHMMssl")+Math.floor(Math.random()*900+100)
}