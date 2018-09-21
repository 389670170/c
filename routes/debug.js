/**
 * Created by chenx on 2017/2/8.
 */
const express = require('express');
const sql_data=require("../datas/mysql")
const mongo_data=require("../datas/mongo")
const router = express.Router();

/* GET home page. */
router.post('/createshop', function(req, res, next) {
    sql_data.Shop.create(req.body).then(function (shop) {
        var shop_m=new mongo_data.ShopSetting({_id:shop.id,pos:[shop.lng,shop.lat]})
        shop_m.save().then(function (s) {
            res.write(JSON.stringify(shop))
            res.write(JSON.stringify(s))
            res.end()
        })

    }).catch(function (error) {
        console.log(error)
        res.end()
    })
});

module.exports = router;