const express = require('express');
const crypto=require("crypto")
const wxtools=require('../tools/weixin')
const mongo=require('../datas/mongo')
const mysql=require("../datas/mysql")
const co=require("bluebird-co").co
const router = express.Router();
module.exports = router;

const aeskey='usuJeA4j0cChrF9jiOdlZ5CBBRo4Xgrg'
router.get('/weixintoken',co.wrap(function *(req,res) {
    var wxtool=wxtools(req.query.appid)
    var access_token=yield wxtool.access_token()

    var cipher = crypto.createCipher('aes-256-cbc',aeskey);
    var crypted = cipher.update(access_token,'utf8','hex');
    crypted += cipher.final('hex');
    res.send(crypted)
}))
router.get("/unloadWXApp",co.wrap(function *(req,res) {
    let data=yield wxtools.unloadApp(req.query.appid)
    res.send(data?data._id:"not loaded")
}))