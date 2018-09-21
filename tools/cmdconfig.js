const commander = require('commander');
const config=require("../config")

commander
    .option('-h, --mysql-host <mysqlhost>', 'mysql-host')
    .option('-u, --mysql-user <mysqluser>', 'mysql-user')
    .option('-p, --mysql-psw <mysqlpassword>', 'mysql-password')
    .option('-d, --mysql-db <mysqldb>', 'mysql-db')
    .option("-m, --mongo <mongo>","mongo uri")
    .option("-c, --memcache <memcache>","memcache host")
    .option("-r, --rabbitmq <rabbitmq>","rabbitmq link")
    .option("-s, --site <site>","host site")
    .parse(process.argv);

if(commander.mysqlHost)
    config.mysql.host=commander.mysqlHost
if(commander.mysqlUser)
    config.mysql.user=commander.mysqlUser
if(commander.mysqlPsw)
    config.mysql.password=commander.mysqlPsw
if(commander.mysqlDb)
    config.mysql.database=commander.mysqlDb
if(commander.mongo)
    config.mongo.link=commander.mongo
if(commander.memcache)
    config.memcache.host=commander.memcache
if(commander.rabbitmq)
    config.rabbitmq.link=commander.rabbitmq
if(commander.site)
    config.host=commander.site

console.log(config)
