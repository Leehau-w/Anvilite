const { app } = require('electron')
const fs = require('node:fs'), path = require('node:path'), { pathToFileURL } = require('node:url')
const profile = process.env.ANVILITE_MCP_AUDIT_PROFILE, nonce = process.env.ANVILITE_MCP_AUDIT_NONCE
if (!profile || !nonce || !path.basename(profile).startsWith('anvilite-mcp-audit-') ||
  fs.readFileSync(path.join(profile, 'synthetic-profile.marker'), 'utf8') !== nonce) throw new Error('Synthetic profile required')
app.setName('Anvilite MCP synthetic audit')
app.setPath('userData', profile); app.setPath('sessionData', path.join(profile, 'session')); app.setAppLogsPath(path.join(profile, 'logs'))
app.disableHardwareAcceleration()
app.on('browser-window-created', (_event, win) => { win.hide(); win.webContents.on('did-finish-load', () => win.hide()) })
import(pathToFileURL(path.resolve(__dirname, '../../dist-electron/main.js')).href).catch(() => app.quit())
