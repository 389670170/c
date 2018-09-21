var express = require('express');
var data=require('../datas/mysql')
var tplfile=require("../tools/tplfile")

var router = express.Router();

/* GET messages listing. */
router.get('/', function(req, res, next) {
  data.Message.findAll().then(function (msg) {
      /*msg.forEach(function (one) {
          res.write(one.id+' '+one.message+' '+one.get('updatedAt')+' ')
      })
      res.end();*/
      var data=tplfile.load("list.html")
      data=data.formatO({listdata:JSON.stringify(msg)})
      res.end(data)
  })
});

module.exports = router;
