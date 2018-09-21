var Sequelize=require("sequelize")
var config=require("../config")
const log4js=require("log4js").getLogger("mysql")

var sequelize = new Sequelize(config.mysql.database, config.mysql.user, config.mysql.password, {
    host: config.mysql.host,
    dialect: 'mysql',
    pool: {
        max: 5,
        min: 0,
        idle: 10000
    },

    define:{
        engine:"MYISAM",
        charset: 'utf8',
        collate: 'utf8_general_ci',
    },

    logging: function(sql) {
        log4js.info(sql)
    }
});

var User = sequelize.define('user', {
    id: {
        type: Sequelize.INTEGER,
        autoIncrement: true,
        primaryKey: true
    },
    name: {
        type: Sequelize.STRING(255)
    },
    sex:{
        type:Sequelize.INTEGER
    },
    location:{
        type:Sequelize.STRING(255)
    },
    balance: {
        type: Sequelize.INTEGER,
        allowNull: false,
        default:0
    }
});
var UserBalanceOLD=sequelize.define('user_balance_wxapp',{
    uid:{
        type:Sequelize.INTEGER,
        allowNull:false
    },
    appid:{
        type:Sequelize.STRING(128),
        allowNull:false
    },
    balance: {
        type: Sequelize.INTEGER,
        allowNull: false,
        default:0
    }
},{
    indexes:[
        {unique:true,fields:["uid","appid"]}
    ]
})
var UserLoginWeixinOLD=sequelize.define("user_login_weixin",{
    uid:{
        type:Sequelize.INTEGER,
        allowNull:false
    },
    appid:{
        type:Sequelize.STRING(128),
        allowNull:false
    },
    openid:{
        type:Sequelize.STRING(128),
        allowNull:false
    },
    access_token:{
        type:Sequelize.STRING(255)
    },
    expires_time:{
        type:Sequelize.INTEGER
    },
    reflash_token:{
        type:Sequelize.STRING(255)
    }
},{
    indexes:[
        {fields:["uid"]},
        {unique:true,fields:["appid","openid"]}
    ]
})
var UserWeiXinUnionIDOLD=sequelize.define("user_weixin_unionid", {
        id: {
            type: Sequelize.INTEGER,
            primaryKey: true
        },
        unionid: {
            type: Sequelize.STRING(128),
            unique: true
        }
    },
    {
        timestamps: false,
    })
var UserLoginPhoneOLD=sequelize.define("user_login_phone",{
    uid:{
        type:Sequelize.INTEGER,
        allowNull:false
    },
    phone:{
        type:Sequelize.STRING(255),
        allowNull:false,
        unique:true
    },
},{
    indexes:[
        {fields:["uid"]},
    ]
})
User.hasMany(UserLoginPhoneOLD,{foreignKey:"uid",targetKey: 'uid'})
User.hasMany(UserLoginWeixinOLD,{foreignKey:"uid",targetKey: 'uid'})
User.hasMany(UserBalanceOLD,{foreignKey:"uid",targetKey: 'uid'})
User.hasOne(UserWeiXinUnionIDOLD,{foreignKey:"id",targetKey: 'id'})
UserLoginPhoneOLD.belongsTo(User,{foreignKey:"uid",targetKey: 'id'})
UserLoginWeixinOLD.belongsTo(User,{foreignKey:"uid",targetKey: 'id'})
UserBalanceOLD.belongsTo(User,{foreignKey:"uid",targetKey: 'id'})
UserWeiXinUnionIDOLD.belongsTo(User,{foreignKey:"id",targetKey: 'id'})
var Shop=sequelize.define("shop",{
    id: {
        type: Sequelize.INTEGER,
        autoIncrement: true,
        primaryKey: true
    },
    name:{
        type:Sequelize.STRING(255),
        allowNull:false
    },
    desc:Sequelize.STRING(1024),
    lng:Sequelize.FLOAT,
    lat:Sequelize.FLOAT,
    tel:Sequelize.STRING(255)
})

var Order=sequelize.define("order",{
    oid:{
        type:Sequelize.STRING(255),
        allowNull:false,
        primaryKey: true
    },
    uid:{
        type:Sequelize.INTEGER,
        allowNull:false
    },
    shopid:{
        type:Sequelize.INTEGER,
        allowNull:false
    },
    prise:{
        type:Sequelize.INTEGER,
        allowNull:false,
        comment:"origin prise"
    },
    amount:{
        type:Sequelize.INTEGER,
        allowNull:false,
        comment:"pay prise"
    },
    type:{
        type:Sequelize.INTEGER,
        allowNull:false
    },
    note:Sequelize.STRING,
    paytype:Sequelize.INTEGER,
    status:{
        type:Sequelize.INTEGER,
        allowNull:false,
        default:0
    },
    paytime:Sequelize.DATE,
    extendinfo:Sequelize.TEXT
},{
    indexes:[
        {fields:["uid"]},
        {fields:["shopid"]}
    ]
})
Order.belongsTo(User,{foreignKey:"uid",targetKey: 'id'})
Order.belongsTo(Shop,{foreignKey:"shopid",targetKey: 'id'})
User.hasMany(Order,{foreignKey:"uid",targetKey: 'id'})
Shop.hasMany(Order,{foreignKey:"shopid",targetKey: 'id'})
sequelize
    .authenticate()
    .then(function(err) {
        log4js.info('Connection has been established successfully.');
        // force: true will drop the table if it already exists
        /*User.sync({force: false})
        UserBalanceOLD.sync({force: false})
        UserLoginWeixinOLD.sync({force: false})
        UserWeiXinUnionIDOLD.sync({force: false})
        UserLoginPhoneOLD.sync({force: false})
        Shop.sync({force: false})
        Order.sync({force: false})*/
    })
    .catch(function (err) {
        log4js.info('Unable to connect to the database:', err);
    });
module.exports.connect=sequelize
module.exports.User=User
module.exports.UserLoginWeixinOLD=UserLoginWeixinOLD
module.exports.UserLoginPhoneOLD=UserLoginPhoneOLD
module.exports.Shop=Shop
module.exports.Order=Order
module.exports.UserBalanceOLD=UserBalanceOLD
module.exports.UserWeiXinUnionIDOLD=UserWeiXinUnionIDOLD