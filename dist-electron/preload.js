let electron = require("electron");
//#region electron/preload.ts
electron.contextBridge.exposeInMainWorld("electronAPI", {
	minimize: () => electron.ipcRenderer.send("window-minimize"),
	maximize: () => electron.ipcRenderer.send("window-maximize"),
	close: () => electron.ipcRenderer.send("window-close"),
	saveFile: (content, defaultName) => electron.ipcRenderer.invoke("save-file", content, defaultName)
});
//#endregion

//# sourceMappingURL=preload.js.map