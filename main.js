const config = require('./config.json');
const chokidar = require('chokidar');
const { exec } = require('child_process');
var SSH = require('simple-ssh');

chokidar.watch(config.watch_dir, {
    ignored: /(^|[\/\\])\../,
    ignoreInitial: true
}).on('add', (path) => {
    new SSH({
        host: config.upload_ip,
        user: config.upload_usr,
        pass: config.upload_password
    })
    .exec(``)//wait for file
    .exec(``)//reset media server
    .start();

    exec(`${path} ${config.upload_ip}`, (err) => { //upload
        if(err) {
            console.log("Could not run command", err);
            return;
        }
    });
});
