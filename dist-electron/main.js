import { BrowserWindow, app, dialog, ipcMain } from "electron";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
//#region electron/main.ts
var __filename = fileURLToPath(import.meta.url);
var __dirname = path.dirname(__filename);
var isDev = process.env.NODE_ENV === "development";
function createWindow() {
	const win = new BrowserWindow({
		width: 1280,
		height: 800,
		minWidth: 900,
		minHeight: 600,
		frame: false,
		titleBarStyle: "hidden",
		webPreferences: {
			preload: path.join(__dirname, "preload.js"),
			contextIsolation: true,
			nodeIntegration: false
		},
		backgroundColor: "#faf8f5"
	});
	if (isDev) {
		win.loadURL("http://localhost:5173");
		win.webContents.openDevTools();
	} else win.loadFile(path.join(__dirname, "../dist/index.html"));
	ipcMain.on("window-minimize", () => win.minimize());
	ipcMain.on("window-maximize", () => {
		if (win.isMaximized()) win.unmaximize();
		else win.maximize();
	});
	ipcMain.on("window-close", () => win.close());
	ipcMain.handle("save-file", async (_event, content, defaultName) => {
		const { filePath } = await dialog.showSaveDialog(win, {
			defaultPath: defaultName,
			filters: [{
				name: "JSON",
				extensions: ["json"]
			}]
		});
		if (filePath) {
			fs.writeFileSync(filePath, content, "utf-8");
			return { success: true };
		}
		return { success: false };
	});
}
app.whenReady().then(createWindow);
app.on("window-all-closed", () => {
	if (process.platform !== "darwin") app.quit();
});
app.on("activate", () => {
	if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
//#endregion

//# sourceMappingURL=main.js.map