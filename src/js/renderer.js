const electron = require('electron');
const ipc = require('electron').ipcRenderer;
const {dialog} = require('electron');
const twilioClient = require("twilio");
const Store = require('electron-store');

console.log("App is started");

(function () {
    const store = new Store();

    let messageForm = document.getElementById('mail-form'),
        settingsForm = document.getElementById('settings-form'),
        logs = document.getElementById('logs'),
        settingsButton = document.getElementById('settings'),
        stopButton = document.getElementById('stop'),
        settings = store.get('settings');

    if (settings && typeof settings == "object")
        for (let key in settings) {
            let field = document.getElementById(key);
            if (field) {
                field.value = settings[key];
            }
        }

    if (stopButton)
        stopButton.addEventListener('click', function (e) {
            ipc.send("stopMessage");
        });

    if (messageForm)
        messageForm.addEventListener('submit', function (e) {
            e.preventDefault();

            const data = new FormData(this);
            let object = [];

            data.forEach((value, key) => {
                object[key] = value;
            });

            ipc.send("fromDataMessage", object);
            ipc.send("startMessage");

            return false;
        });

    console.log(store.get('settings'));

    if (settingsButton)
        settingsButton.addEventListener('click', function (e) {
            ipc.send("showSettings");
        });

    if (settingsForm)
        settingsForm.addEventListener('submit', function (e) {
            e.preventDefault();

            const data = new FormData(this);
            let object = {};

            data.forEach((value, key) => {
                object[key] = value;
            });

            store.set('settings', object);

            ipc.send("saveSettings");

            return false;
        });

    ipc.on('asyncReply', (event, args) => {
        if ( ! logs)
            return;

        logs.innerHTML += "\n" + args;
        logs.scrollTo(0, logs.scrollHeight);
    });

})();
