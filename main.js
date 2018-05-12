require('dotenv').config()
const electron = require('electron')
// Module to control application life.
const app = electron.app
// Module to create native browser window.
const BrowserWindow = electron.BrowserWindow

const fs = require('fs');
const path = require('path')
const url = require('url')

const createWTClient = require('@wetransfer/js-sdk')
let apiClient
let transfers

const {ipcMain, dialog} = electron

// Keep a global reference of the window object, if you don't, the window will
// be closed automatically when the JavaScript object is garbage collected.
let mainWindow

function createWindow () {
  // Create the browser window.
  mainWindow = new BrowserWindow({width: 800, height: 600})

  // and load the index.html of the app.
  mainWindow.loadURL(url.format({
    pathname: path.join(__dirname, 'index.html'),
    protocol: 'file:',
    slashes: true
  }))

  // Open the DevTools.
  // mainWindow.webContents.openDevTools()

  // Emitted when the window is closed.
  mainWindow.on('closed', function () {
    // Dereference the window object, usually you would store windows
    // in an array if your app supports multi windows, this is the time
    // when you should delete the corresponding element.
    mainWindow = null
  })
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', () => {
  createWindow()
})

// Quit when all windows are closed.
app.on('window-all-closed', function () {
  // On OS X it is common for applications and their menu bar
  // to stay active until the user quits explicitly with Cmd + Q
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('activate', function () {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (mainWindow === null) {
    createWindow()
  }
})

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.

ipcMain.on('key-inserted', (event, key) => {
  createWTClient(key).then((client) => {
    apiClient = client
    event.sender.send('key-accepted')
  }).catch((err) => {
    event.sender.send('error', 'Invalid Key Inserted')
  })
})

ipcMain.on('upload', (event) => {
  dialog.showOpenDialog((files) => {
    files.forEach((file) => {
      fs.stat(file, (err, stats) => {
        if (err) {
          event.sender.send('error', err)
          return;
        }
        apiClient.transfer.create({
          name: file,
          // Description is optional.
          description: 'Something about cats, most probably.'
        }).then((transfer) => {
            apiClient.transfer.addItems(transfer.id, [{
              content_identifier: 'file',
              local_identifier: 'delightful-cat',
              filename: path.basename(file),
              filesize: stats.size
            }]).then((transferItems) => {
              fs.readFile(file, (err, contents) => {
                if (err) {
                  event.sender.send('error', err)
                  return
                } 
                Promise.all(transferItems.map((item) => {
                  return apiClient.transfer.uploadFile(item, contents);
                })).then(() => {
                  event.sender.send('success', transfer.shortened_url)
                })
              })
            }).catch((err) => {
              event.sender.send('error', err)    
            })
        }).catch((err) => {
          event.sender.send('error', err)
        })
      })
    })
  })
})
