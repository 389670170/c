require("./tools/cmdconfig")
const express = require('express');
const path = require('path');
const log4js = require('log4js');
const cookieParser = require('cookie-parser');
const bodyParser = require('body-parser');
require("./tools/stringformato")
const session = require('express-session');
const xmlparser = require('express-xml-bodyparser')
const minify = require('express-minify');
const UglifyJS = require('uglify-js');
const Cssmin = require('cssmin');
const mcStore = require('connect-memcached')(session);
const config=require("./config")
const tplfile=require("./tools/tplfile")
const Promise=require("bluebird")
tplfile.setUseBuffer(config.tplbuffer)
log4js.configure(config.log4js);

const index = require('./routes/index');
const messages = require('./routes/Messages');
const weixin=require('./routes/weixin')
const pay=require('./routes/pay')
const login = require('./routes/login');
const ws_server=require("./routes/ws_server")
const debug_page=require("./routes/debug")

const app = express()
const logger =log4js.getLogger('site')
app.set('port', 8091);
logger.setLevel('INFO');
app.use(log4js.connectLogger(logger, {level:log4js.levels.INFO}));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(xmlparser());
app.use(cookieParser());
app.use(session({
    secret: "fd3??4s@!@dfa453f3DF#$D&W",
    resave: false,
    saveUninitialized: true,
    cookie: {secure: !true },
    // store:new mcStore({hosts: config.memcache.host}),
}));
app.use(minify({
    uglifyJS: UglifyJS,
    cssmin: Cssmin
}))
app.use(express.static(path.join(__dirname, 'public')));
app.use('/', index);
app.use('/messages', messages);
app.use('/weixin',weixin);
app.use("/pay",pay)
app.use("/coupon",require("./routes/coupon"))
try{
    app.use("/alipay",require("./routes/alipay"))
}catch(e){
    logger.error(e.message)
}

app.use('/login', login);
app.use('/ws',ws_server)
app.use('/debug',debug_page)
app.use('/backend',require("./routes/backend"))

// catch 404 and forward to error handler
app.use(function(req, res, next) {
  var err = new Error('Not Found');
  err.status = 404;
  next(err);
});

// error handler
app.use(function(err, req, res, next) {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};

  // render the error page
  res.status(err.status || 500);
  res.end()
  logger.error(err.stack);
});
Promise.onPossiblyUnhandledRejection(function(e, promise) {
    logger.error("Unhandled Rejection:"+e.stack)
});
app.set('trust proxy',true)
app.listen(app.get('port'), function(){
    console.log("........................................................................0.0")
    console.log('Express server listening on port ' + app.get('port'));
});
module.exports = app;
