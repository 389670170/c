/**
 * Created by chenx on 2017/2/16.
 */
const config=require("../config")
const extend = require('util')._extend
const amqp = require('amqplib-easy')(config.rabbitmq.link);
const amqpobj={
    exchange_order:{
        exchange:"order",
        exchangeOptions:{
            durable: true
        },
        exchangeType:"topic"
    },
    exchange_user:{
        exchange:"user",
        exchangeOptions:{
            durable: true
        },
        exchangeType:"topic"
    },
    order_finish:function (key,data) {
        return amqp.publish(amqpobj.exchange_order,key,data)
    },
    new_user:function (data) {
        return amqp.publish(amqpobj.exchange_user,"create.user",data)
    }
}
module.exports = amqpobj

/*amqp.consume(extend(
    amqpobj.exchange_order,
    {
        queue:"temp",
        retry:false,
        queueOptions:{
        durable: false,
        autoDelete:true,
        },
        topics:["finish"]
    }
    ),
    function (data,conf) {
        console.log(data)
    }
)
setTimeout(function() {
    amqpobj.order_finish("finish",{aaa:1}).then(function () {
    })
}, 5000);*/
