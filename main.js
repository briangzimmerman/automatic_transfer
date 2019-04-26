const config = require('./config.json');
const chokidar = require('chokidar');
const path = require('path');
const fs = require('fs');
const { exec } = require('child_process');
var SSH = require('simple-ssh');
var sqlite3 = require('sqlite3').verbose();
var db = new sqlite3.Database(':files:');

chokidar.watch(config.watch_dir, {
    ignored: /(^|[\/\\])\../,
    ignoreInitial: true
}).on('add', (file) => {
    var file_stats = fs.statSync(file);
    var mtime = Math.round(new Date(file_stats.mtime).getTime() / 1000);
    var is_new = true;

    db.all(
        "SELECT * FROM file WHERE name = ? AND created >= ?",
        [path.basename(file), mtime],
        (err, rows) => { is_new = !rows || rows.length == 0; }
    );

    if(!is_new) { return; }

    new SSH({
        host: config.upload_ip,
        user: config.upload_usr,
        pass: config.upload_password
    })
    .exec(``)//wait for file
    .exec(``)//reset media server
    .start();

    exec(`${file} ${config.upload_ip}`, (err) => { //upload
        if(err) {
            console.log("Could not run command", err);
            return;
        }

        db.run(
            "INSERT OR REPLACE INTO file(name, created) VALUES(?, ?)"
            [path.basename(file), mtime]
        );
    });
});

setInterval(() => {
    var now = Math.round(Date.now() / 1000);
    var oldest = now - (config.delete_after_days * 24 * 60 * 60);

    db.each(`SELECT * FROM file WHERE created < ${oldest}`, (err, row) => {
        //remove file
        console.log(config.watch_dir+'/'+row.name);
    });
}, 86400000); //Every day