// Electron shell for the macOS app: serves the Vite build (dist/) over a custom app:// protocol
// so fetch()/GLTFLoader work like on a web server, and opens one game window.
const { app, BrowserWindow, Menu, protocol, net, shell } = require('electron');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const DIST = path.join(__dirname, '..', 'dist');

protocol.registerSchemesAsPrivileged([
  { scheme: 'app', privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true } },
]);

function createWindow() {
  const win = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 960,
    minHeight: 600,
    title: 'GTA 7 – Vice Bay',
    backgroundColor: '#000000',
    show: false,
    webPreferences: { contextIsolation: true, sandbox: true, backgroundThrottling: false },
  });
  win.once('ready-to-show', () => win.show());
  // external links open in the default browser, never inside the game window
  win.webContents.setWindowOpenHandler(({ url }) => { shell.openExternal(url); return { action: 'deny' }; });
  win.loadURL('app://game/index.html');
}

function buildMenu() {
  Menu.setApplicationMenu(Menu.buildFromTemplate([
    { role: 'appMenu' },
    {
      label: 'Ansicht',
      submenu: [
        { role: 'togglefullscreen', label: 'Vollbild' },
        { role: 'reload', label: 'Neu laden' },
        { type: 'separator' },
        { role: 'toggleDevTools', label: 'Entwicklerwerkzeuge' },
      ],
    },
    { role: 'windowMenu', label: 'Fenster' },
  ]));
}

app.whenReady().then(() => {
  protocol.handle('app', request => {
    const { pathname } = new URL(request.url);
    const file = path.normalize(path.join(DIST, decodeURIComponent(pathname)));
    if (!file.startsWith(DIST)) return new Response('Forbidden', { status: 403 });
    return net.fetch(pathToFileURL(file).toString());
  });
  buildMenu();
  createWindow();
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});

app.on('window-all-closed', () => app.quit());
