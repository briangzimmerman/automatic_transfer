var sqlite3 = require('sqlite3').verbose();
var db = new sqlite3.Database(':files:');

db.serialize(function() {
    db.run("CREATE TABLE file (name TEXT PRIMARY KEY, created INTEGER NOT NULL)")
});

db.close();