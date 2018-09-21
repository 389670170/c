const Memcached = require('memcached');
const config=require("../config")
const Promise=require("bluebird")
var memcached = new Memcached(config.memcache.host);

module.exports={
    add:function (key,value,lifetime) {
        return new Promise(function (resolve,reject){
            memcached.add(key,value,lifetime,function (err) {
                if(err)
                    reject(err)
                else
                    resolve(true)
            })
        })
    }
}
