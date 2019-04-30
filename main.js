const config = require('./config.json');
const chokidar = require('chokidar');
const notifier = require('node-notifier');
const path = require('path');
const { exec } = require('child_process');
var SSH = require('simple-ssh');

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

            console.log("Finished transfering");
            notifier.notify({
                title: 'Automatic Transfer Complete',
                message: `Transfered ${trunc_basename} to ${config.upload_ip}`
            });
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