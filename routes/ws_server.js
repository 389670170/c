var uuid = require('uuid');
var data=require('./../datas/mysql')
var express = require('express');
var router = express.Router();
var expressWs = require('express-ws')(router);
var linklist={}
// Scream server example: "hi" -> "HI!!!"
router.ws('/msg', function(ws, req) {
    var id=uuid.v4()
    linklist[id]=ws
    console.log("New connection:"+id)
    ws.on("message", function (str) {
        console.log("Received "+str)
        data.Message.create({message:str})
        ws.send(str.toUpperCase()+"!!!")
    })
    ws.on("close", function (code, reason) {
        console.log("Connection closed")
        delete linklist[id]
    })
})

module.exports = router;
