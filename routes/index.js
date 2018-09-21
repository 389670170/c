var express = require('express');
var weixin=require('../tools/weixin')
var router = express.Router();
const fs = require('fs');
const dc = require('../tools/discount_calc');

/* GET home page. */
router.get('/', function(req, res, next) {
  req.session.i+=1;
  res.end(req.session.i+"")
});

router.get('/discount', function (req, res) {
  fs.readFile('amount_property.json',function (err, data) {
    if(err) {
      return console.error(err);
    }
    let amount_property = JSON.parse(data.toString());
    console.log(JSON.stringify(amount_property));
    let dcp = dc(amount_property, req.query.oilNo, req.query.price);
    res.end(JSON.stringify(dcp));
  })
});

module.exports = router;
