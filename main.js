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
    var basename = path.basename(file);
    var file_stats = fs.statSync(file);
    var mtime = Math.round(new Date(file_stats.mtime).getTime() / 1000);
    var is_new = true;

    db.all(
        "SELECT * FROM file WHERE name = ? AND created >= ?",
        [basename, mtime],
        (err, rows) => { is_new = rows && rows.length; }
    );

    console.log(`Found ${basename}`);
    if(!is_new) {
        console.log("It's not new");
        return;
    } else {
        console.log("It's new");
    }

    new SSH({
        host: config.upload_ip,
        user: config.upload_usr,
        pass: config.upload_password
    })
    .exec(`nc -l -p 6969 | tar -Pzxf - -C '${config.upload_dir}'`)
    .exec(`ls`)//reset media server
    .start();

    setTimeout(() => {
        exec(`tar Pczf - '${basename}' | nc -w1 ${config.upload_ip} 6969`, {
            cwd: config.watch_dir
        }, (err) => { //upload
            if(err) {
                console.log("Could not run command", err);
                return;
            }

            console.log("Updating db");
    
            db.run(
                "INSERT OR REPLACE INTO file(name, created) VALUES(?, ?)",
                [basename, mtime]
            );
        });
    }, 1000);
});

// setInterval(() => {
//     var now = Math.round(Date.now() / 1000);
//     var oldest = now - (config.delete_after_days * 24 * 60 * 60);

//     db.each(`SELECT * FROM file WHERE created < ${oldest}`, (err, row) => {
//         //remove file
//         console.log(config.watch_dir+'/'+row.name);
//     });
// }, 900000); //Every 15 minutes