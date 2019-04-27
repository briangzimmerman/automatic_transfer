const config = require('./config.json');
const chokidar = require('chokidar');
const notifier = require('node-notifier');
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

    console.log(`Found ${basename}`);

    notifier.notify({
        title: 'Automatic Transer',
        message: `Transfering ${basename} to ${config.upload_ip}...`
    });

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
        }, (err) => {
            if(err) {
                console.log("Could not run command", err);
                notifier.notify({
                    title: 'Automatic Transfer Failed',
                    message: `Could not transfer ${basename} to ${config.upload_ip}`
                });
                return;
            }

            console.log("Updating db");
            notifier.notify({
                title: 'Automatic Transfer Complete',
                message: `Transfered ${basename} to ${config.upload_ip}`
            });
    
            db.run(
                "INSERT OR REPLACE INTO file(name, created) VALUES(?, ?)",
                [basename, mtime]
            );
        });
    }, 1000);
});

//Remove old upload files
setInterval(() => {
    var now = Math.round(Date.now() / 1000);
    var oldest = now - (config.delete_after_days * 24 * 60 * 60);

    db.each(`SELECT * FROM file WHERE created < ${oldest}`, (err, row) => {
        console.log(config.watch_dir+'/'+row.name);
        db.run("DELETE FROM file WHERE name = ?", [row.name], (err) => {
            if(err) {
                notifier.notify({
                    title: 'Upload Delete Failed',
                    message: `Could not remove ${row.name} from DB`
                });
                
                return;
            }

            fs.unlink(config.watch_dir+'/'+row.name, (err) => {
                if(err) {
                    notifier.notify({
                        title: 'Upload Delete Failed',
                        message: `Could not delete ${row.name}`
                    });
                }
            });
        });
    });
}, 900000); //Every 15 minutes