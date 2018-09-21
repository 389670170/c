var fs = require("fs");
module.exports=(function () {
    var buffer={}
    var funcs={}
    fs.watch('./views/',{recursive:true},(eventType, filename)=>{
        console.log(filename)
        delete buffer[filename]
    })
    funcs.load=function (name){
        if( name in buffer){
            return buffer[name]
        }
        var data = fs.readFileSync('./views/'+name,"utf8");
        buffer[name]=data
        return data
    }
    funcs.setUseBuffer=function (u) {
    }
    return funcs;
})()
