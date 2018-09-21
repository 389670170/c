/**
 * Created by amen on 1/9/17.
 */
String.prototype.formatO=function(obj){
    return this.replace(/<{(\w+)}>/g, function(match, name) {
        var type=typeof obj[name];
        if(type!='undefined')
            return obj[name];
        else
            return ""
    });
}