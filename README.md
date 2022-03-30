# Message sender
Send emails/SMS to the recipients from the list in file.

![](images/screenshot.png)

## How to use:
- Fill settings. **You can use SMTP or Twilio only.**
- Save settings
- Fill all fields in main window
- Click the start button, 
- Choose the txt file with emails and phones. Each email/phone should be placed at new line. **See example file - recipients.txt**

_I hope you know how to use SMTP or Twilio services ;)_

## Requirements:
- node js
- npm or yarn
- python (for building)

## Clone repository:
```console
git clone https://github.com/Maliuk/email-spammer.git
```

## Install dependencies:
### npm:
```console
npm i
```
### yarn:
```console
yarn
```

## How to start:
### npm:
```console
npm run scss && npm start
```
### yarn:
```console
yarn scss && yarn start
```

## How to build:
### npm:
```console
npm run scss && npm run dist
```
### yarn:
```console
yarn scss && yarn dist
```

You can find the built app in dist folder.
