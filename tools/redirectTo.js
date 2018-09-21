/**
 * Created by chenx on 2017/2/22.
 */
const config=require("../config")

function fun1(ukey,wxdata) {
    for(const i in config.redrictlist){
        one=config.redrictlist[i]
        if(one[0] instanceof RegExp){
            if(one[0].test(ukey)){
                return ukey.replace(one[0],one[1])
            }
        }
        else if(one[0]==ukey){
            return one[1].formatO(wxdata)
        }
    }
}
module.exports=fun1

//console.log(fun1("sharecoupon:587f11f5f525bc0b7473654e"))