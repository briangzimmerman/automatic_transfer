This is a kind of niche application to automatically upload files to a media server running minidlna. 

The application watches a specified folder for files or directories being added to it. When one is added, it will transfer the file to the server using tar and netcat, then restart the minidlna server to add the file to it's list.

The application will delete files in the watched directory after a certain number of days. The number of days is set in the config file.

I'm running this application by putting it in my `/usr/local/bin/` directory and using pm2. Make sure that the `:files:` sqlite3 file is writable.