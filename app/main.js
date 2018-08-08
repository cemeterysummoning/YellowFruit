var electron = require('electron');
var dialog = electron.dialog;
var BrowserWindow = electron.BrowserWindow;
var Menu = electron.Menu;
var app = electron.app;
var ipc = electron.ipcMain;
var myAppMenu, menuTemplate;
var reportWindow;

// load a new report window, or, if one is already open, reload and focus it
function showReportWindow() {
  if(reportWindow != undefined && !reportWindow.isDestroyed()) {
    reportWindow.focus();
    reportWindow.reload();
  }
  else {
    reportWindow = new BrowserWindow({
      width: 900,
      height: 500,
      show: false,
      autoHideMenuBar: true
    }); //reportWindow

    reportWindow.loadURL('file://' + __dirname + '/standings.html');

    reportWindow.once('ready-to-show', function () {
      reportWindow.show();
    });
  }
} //showReportWindow

//open file dialog to save as a new file
function saveTournamentAs(focusedWindow) {
  dialog.showSaveDialog(focusedWindow,
    {filters: [{name: 'YellowFruit Tournament', extensions: ['yft']}]},
    (fileName) => {
      if(fileName != undefined) {
        focusedWindow.webContents.send('saveTournamentAs', fileName);
      }
    }
  );
}

//load a tournament from file
function openTournament(focusedWindow) {
  dialog.showOpenDialog(focusedWindow,
    {filters: [{name: 'YellowFruit Tournament', extensions: ['yft']}]},
    (fileName) => {
      if(fileName != undefined) {
        focusedWindow.webContents.send('openTournament', fileName);
      }
    }
  );
}

app.on('ready', function() {
  var appWindow;
  appWindow = new BrowserWindow({
    width: 1200,
    height: 700,
    show: false
  }); //appWindow

  appWindow.loadURL('file://' + __dirname + '/index.html');

  appWindow.once('ready-to-show', function() {
    appWindow.show();
  }); //ready-to-show

  appWindow.on('closed', function() {
    if(reportWindow != undefined && !reportWindow.isDestroyed()) {
      reportWindow.close();
    }
  });

  // ipc.on('openReportWindow', function(event, arg){
  //   event.returnValue='';
  //   reportWindow.show();
  // }); //openreportWindow
  //
  // ipc.on('closeReportWindow', function(event, arg){
  //   event.returnValue='';
  //   reportWindow.hide();
  // }); //closereportWindow

  menuTemplate = [
    {
      label: 'YellowFruit',
      submenu: [
        {
          label: 'View Full Report',
          accelerator: process.platform === 'darwin' ? 'Command+I': 'Ctrl+I',
          click(item, focusedWindow) {
            focusedWindow.webContents.send('compileStatReport');
            showReportWindow();
          }
        },
        {
          label: 'Open',
          click(item, focusedWindow) {
            openTournament(focusedWindow);
          }
        },
        {
          label: 'Save As',
          click(item, focusedWindow) {
            saveTournamentAs(focusedWindow);
          }
        },
        {
          label: 'Save',
          click(item, focusedWindow) {

          }
        },
        {type: 'separator'},
        {role: 'close'},
        {role: 'quit'}
      ]
    },{
      label: 'Edit',
      submenu: [
        {role: 'cut'},
        {role: 'copy'},
        {role: 'paste'},
        {type: 'separator'},
        {
          label: 'Add Team',
          accelerator: process.platform === 'darwin' ? 'Command+T':'Ctrl+T',
          click(item,focusedWindow) {
            if (focusedWindow == appWindow) focusedWindow.webContents.send('addTeam');
          }
        }
      ]
    },{
        label: 'View',
        submenu: [
          {
            label: 'Reload',
            accelerator: 'CmdOrCtrl+R',
            click (item, focusedWindow) {
              if (focusedWindow) focusedWindow.reload()
            }
          },
          {
            label: 'Toggle Developer Tools',
            accelerator: process.platform === 'darwin' ? 'Alt+Command+I' : 'Ctrl+Shift+I',
            click (item, focusedWindow) {
              if (focusedWindow) focusedWindow.webContents.toggleDevTools()
            }
          }
        ]
      },
  ];

  myAppMenu = Menu.buildFromTemplate(menuTemplate);
  Menu.setApplicationMenu(myAppMenu);

}); //app is ready
