/**
 * Created by haoran.shu on 2017/2/6.
 */
let express = require('express');
const AliyunSmsUtil=require("../tools/AliyunSmsUtil")
let router = express.Router();
let tplfile=require("../tools/tplfile")
let wxtools=require('../tools/weixin')
let mysql_data=require("../datas/mysql")
const config=require("../config")
const redirectTo=require('../tools/redirectTo')
const co=require("bluebird-co").co
const mongo_data = require("../datas/mongo")
const logger=require("log4js").getLogger("site")

// 获取验证码
router.post('/sendCode', function (req, res) {
  // 判断 session 中是否有code
  let phone_code = req.session.phone_code;
  if(!phone_code) { // 有验证码, 则直接返回旧的未使用的验证码
    // 生成随机验证码
      phone_code = Math.random().toString().substr(2, 4);
  }
  console.log('mobile：' + req.query.mobile);
  req.session.phone_num=req.query.mobile
  req.session.phone_code = phone_code; // 重置 code
  console.log("验证码：" + phone_code);
  //let text = "【恒大车时代】您的身份验证码" + phone_code + "，请悄悄地将验证码输入至空白框，千万不要告诉别人！回T退订";
  //if(config.sendsms) yunpian.sendMsg(req.query.mobile, text); // 发送短信验证码
    AliyunSmsUtil.sendMessage({code:phone_code, phone:req.query.mobile}).then( function (data) {
        //console.log(data);
    })
  res.end('success');
});

// 登录
router.get('/phone', function (req, res) {
  var page=tplfile.load("login.html").formatO({
      backurl:req.query.back?req.query.back:req.get('Referrer')
  })
    res.end(page)
});
router.get('/phone_submit',co.wrap(function *(req, res){
    if(!req.session.weixin || !req.session.weixin.token || !req.session.weixin.openid){
        res.json({res: 3, message: "微信状态错误，请关闭页面重新进入"})
        return
    }
  if(req.session.phone_code==req.query.code){
      let phone=req.session.phone_num
      delete req.session.phone_num
      delete req.session.phone_code
      if(req.query.name){
          yield mysql_data.User.update({
              name: req.query.name
          },{
              where:{
                  id:req.session.uid
              }
          })
      }
      try{
          yield mongo_data.UserInfo.update({_id:req.session.uid},{$addToSet:{phone:phone}},{upsert:true})
          res.json({res:0})
      }catch(e){
          res.json({res:2,message:"号码已存在"})
      }
  }else {
      res.json({res: 1, message: "验证码错误"})
  }
}))

module.exports = router;
