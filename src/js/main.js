const electron = require('electron');
const { app, BrowserWindow } = require('electron');
const ipc = electron.ipcMain;
const { dialog } = require('electron');
const fs = require('fs');
const readline = require('readline');
const nodemailer = require('nodemailer');
const twilioClient = require("twilio");
const Store = require('electron-store');
const {phone} = require('phone');
const emailValidator = require("email-validator");

//process.env['NODE_TLS_REJECT_UNAUTHORIZED'] = 0;

const store = new Store();
let isStarted = false;

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

const createWindow = (file = 'index.html', width = 800, height = 700, parent = null, isShown = true) => {
    const win = new BrowserWindow({
        width: width,
        height: height,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false
        },
        resizable: false,
        maximizable: false,
        show: isShown
    });

    win.loadFile(file);

    win.setParentWindow(parent);

    /*win.webContents.openDevTools({
        mode: 'undocked'
    });*/

    return win;
}

app.whenReady().then(() => {
    let win = createWindow();
    let winSettings = createWindow('setting.html', 500, 700, win, false)
        .on('close', function (e) {
            e.preventDefault();
            this.hide();
        });

    console.log('Settings storage: ', app.getPath('userData'));
    console.log('Settings: ', store.get('settings'));

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

    ipc.on("showSettings", (event, data) => {
        winSettings.reload();
        winSettings.show();
    });

    ipc.on("saveSettings", (event, data) => {
        winSettings.hide();
        event.sender.send('asyncReply', message.success("Settings saved"));
    });
});

async function processLineByLine(file, win, data) {
    const settings = store.get('settings');

    let sendSMS;
    let sendEmail = sendSMS = false;

    if (settings && settings.smtpServer && settings.smtpPort && settings.smtpLogin && settings.smtpPassword) {
        sendEmail = true;
    }

    if (settings && settings.accountSid && settings.authToken && settings.phoneFrom) {
        sendSMS = true;
    }

    if ( ! sendSMS && ! sendEmail) {
        win.webContents.send('asyncReply', message.error("Not fully completed settings"));
        return;
    }

    const tClient = new twilioClient(settings.accountSid, settings.authToken);

    const transporter = nodemailer.createTransport({
        host: settings.smtpServer.trim(),
        port: settings.smtpPort.trim(),
        auth: {
            user: settings.smtpLogin.trim(),
            pass: settings.smtpPassword,
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

        const checkPhone = phone(emailTo);

        try {
            if (checkPhone.isValid && sendSMS) {
                await tClient.messages
                    .create({
                        body: data['message'],
                        from: settings.phoneFrom,
                        to: emailTo
                    })
                    .then(messageId => win.webContents.send('asyncReply', message.success(`SMS sent successfully to ${emailTo}`)))
                    .catch(error => win.webContents.send('asyncReply', message.error(`SMS send error to number: ${emailTo} - ${error}`)));
            }
            else if (emailValidator.validate(emailTo) && sendEmail) {
                await transporter.sendMail({
                    from: data['emailFrom'].trim(),
                    to: emailTo,
                    subject: data['subject'],
                    text: data['message'],
                }).then(info => {
                    win.webContents.send('asyncReply', message.success(`Email sent successfully to ${emailTo}`));
                }).catch(error => {
                    win.webContents.send('asyncReply', message.error(`Email send error to email: ${emailTo} - ${error}`));
                });
            }
            else {
                win.webContents.send('asyncReply', message.error(`Oops!!! I can't send email or SMS to this row: ${emailTo}`));
            }
        }
        catch (error) {
            win.webContents.send('asyncReply', message.error(error));
            return;
        }

        await sleep(170);
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
