const electron = require('electron');
const ipc = require('electron').ipcRenderer;
const {dialog} = require('electron');

console.log("App is started");

(function () {
    let messageForm = document.getElementById('mail-form'),
        logs = document.getElementById('logs'),
        startButton = document.getElementById('start'),
        stopButton = document.getElementById('stop');

    stopButton.addEventListener('click', function (e) {
        ipc.send("stopMessage");
    });

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

    ipc.on('asyncReply', (event, args) => {
        logs.innerHTML += "\n" + args;
        logs.scrollTo(0, logs.scrollHeight);
    });

})();
