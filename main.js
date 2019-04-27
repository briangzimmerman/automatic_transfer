const config = require('./config.json');
const chokidar = require('chokidar');
const notifier = require('node-notifier');
const path = require('path');
const fs = require('fs');
const { exec } = require('child_process');
var SSH = require('simple-ssh');
var sqlite3 = require('sqlite3').verbose();
var db = new sqlite3.Database(__dirname + '/:files:');

chokidar.watch(config.watch_dir, {
    ignored: /(^|[\/\\])\../,
    ignoreInitial: true,
    depth: 0,
    awaitWriteFinish: true
})
.on('add', transferFile)
.on('addDir', transferFile);

function transferFile(file) {
    var basename = path.basename(file);
    var trunc_basename = truncate(basename);
    var file_stats = fs.statSync(file);
    var mtime = Math.round(new Date(file_stats.mtime).getTime() / 1000);

    console.log(`Found ${basename}`);

    notifier.notify({
        title: 'Automatic Transfer',
        message: `Transfering ${trunc_basename} to ${config.upload_ip}`
    });

    new SSH({
        host: config.upload_ip,
        user: config.upload_usr,
        pass: config.upload_password
    })
    .exec(`nc -l -p 6969 | tar -Pzxf - -C '${config.upload_dir}'`)
    .exec(`sudo service minidlna stop && sudo minidlnad -R && sudo service minidlna restart`, {
        pty: true,
        in: config.upload_password+"\n",
        out: console.log.bind(console)
    })//reset media server
    .start();

    setTimeout(() => {
        exec(`tar Pczf - '${basename}' | nc -w1 ${config.upload_ip} 6969`, {
            cwd: config.watch_dir
        }, (err) => {
            if(err) {
                console.log("Could not run command", err);
                notifier.notify({
                    title: 'Automatic Transfer Failed',
                    message: `Could not transfer ${trunc_basename} to ${config.upload_ip}`
                });
                return;
            }

            console.log("Updating db");
            notifier.notify({
                title: 'Automatic Transfer Complete',
                message: `Transfered ${trunc_basename} to ${config.upload_ip}`
            });
    
            db.run(
                "INSERT OR REPLACE INTO file(name, created) VALUES(?, ?)",
                [basename, mtime]
            );
        });
    }, 1000);
}

function truncate(string) {
    if(string.length > 20) {
        return string.substr(0, 20) + '...';
    } else {
        return string;
    }
}

//Remove old upload files
setInterval(() => {
    var now = Math.round(Date.now() / 1000);
    var oldest = now - (config.delete_after_days * 24 * 60 * 60);

    db.each(`SELECT * FROM file WHERE created < ${oldest}`, (err, row) => {
        console.log('Delete:', config.watch_dir+'/'+row.name);
        var trunc_basename = truncate(row.name);

        db.run("DELETE FROM file WHERE name = ?", [row.name], (err) => {
            if(err) {
                notifier.notify({
                    title: 'Upload Delete Failed',
                    message: `Could not remove ${trunc_basename} from DB`
                });
                
                return;
            }

            fs.unlink(config.watch_dir+'/'+row.name, (err) => {
                if(err) {
                    notifier.notify({
                        title: 'Upload Delete Failed',
                        message: `Could not delete ${trunc_basename}`
                    });
                }
            });
        });
    });
}, 900000); //Every 15 minutes