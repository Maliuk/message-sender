const electron = require('electron');
const { app, BrowserWindow } = require('electron');
const ipc = electron.ipcMain;
const { dialog } = require('electron');
const fs = require('fs');
const readline = require('readline');
const nodemailer = require('nodemailer');

//process.env['NODE_TLS_REJECT_UNAUTHORIZED'] = 0;

var isStarted = false;

const message = {
    error: message => {
        return "<span class='error'>" + message + "</span>";
    },
    success: message => {
        return "<span class='success'>" + message + "</span>";
    },
    message: message => {
        return "<span class='message'>" + message + "</span>";
    }
};

const createWindow = () => {
    const win = new BrowserWindow({
        width: 800,
        height: 700,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false
        },
        resizable: false,
        maximizable: false
    })

    win.loadFile('index.html');

    //win.webContents.openDevTools();

    return win;
}

app.whenReady().then(() => {
    let win = createWindow();

    console.log("App is started");

    ipc.on('fromDataMessage', (event, data) => {
        console.log(data);

        if (isStarted)
            return;

        dialog.showOpenDialog({
            title: 'Open file with emails list',
            filters: [
                { name: 'TXT', extensions: ['txt'] },
                { name: 'All Files', extensions: ['*'] }
            ],
            properties: ['openFile', 'showHiddenFiles']
        }).then(result => {
            if ( ! result.canceled && result.filePaths.length > 0) {

                event.sender.send('asyncReply', message.message("File " + result.filePaths[0] + " is opened"));

                processLineByLine(result.filePaths[0], win, data).then(() => {
                    event.sender.send('asyncReply', message.message("Completed."));
                }).catch(error => {
                    event.sender.send('asyncReply', message.error(error));
                }).finally(() => {
                    start(false);
                });
            }
            else if (result.canceled) {
                start(false);
                event.sender.send('asyncReply', message.error("Operation canceled"));
            }
        }).catch(err => {
            event.sender.send('asyncReply', message.error(err));
        });
    });

    ipc.on("startMessage", (event, data) => {
        if (isStarted) {
            event.sender.send('asyncReply', message.error("Already started."));
            return;
        }

        start();
        event.sender.send('asyncReply', message.message("Starting..."));
    });

    ipc.on("stopMessage", (event, data) => {
        if ( ! isStarted) {
            event.sender.send('asyncReply', message.error("Is not running."));
            return;
        }

        start(false);
        event.sender.send('asyncReply', message.error("Stopped by user."));
    });
});

async function processLineByLine(file, win, data) {
    const transporter = nodemailer.createTransport({
        host: data['smtpServer'].trim(),
        port: data['smtpPort'].trim(),
        auth: {
            user: data['smtpLogin'].trim(),
            pass: data['smtpPassword'],
        },
        tls: {
            rejectUnauthorized: false
        }
    });

    const fileStream = fs.createReadStream(file);

    const rl = readline.createInterface({
        input: fileStream,
        crlfDelay: Infinity
    });

    for await (const emailTo of rl) {
        console.log(`Line from file: ${emailTo}`);

        if ( ! isStarted)
            return;

        try {
            await transporter.sendMail({
                from: data['emailFrom'].trim(),
                to: emailTo,
                subject: data['subject'],
                text: data['message'],
            }).then(info => {
                win.webContents.send('asyncReply', message.success(`Email sent successfully to ${emailTo}`));
            }).catch(error => {
                win.webContents.send('asyncReply', message.error(error));
            });
        }
        catch (error) {
            win.webContents.send('asyncReply', message.error(error));
            return;
        }
    }
}

function linesCount(file) {
    const rl = readline.createInterface({
        input: fs.createReadStream(file),
        output: process.stdout,
        terminal: false
    });

    let linesCount = 0;

    rl.on('line', function (line) {
        linesCount++; // on each linebreak, add +1 to 'linesCount'
    });

    rl.on('close', function () {
        console.log(linesCount); // print the result when the 'close' event is called
    });

    return linesCount;
}

function sleep(ms) {
    return new Promise((resolve) => {
        setTimeout(resolve, ms);
    });
}

function start(start = true) {
    isStarted = start;
}
