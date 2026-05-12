const path = require('path')
const { execFileSync } = require('child_process')
const fs = require('fs')

exports.default = async function afterPack(context) {
  if (context.electronPlatformName !== 'win32') return

  const projectRoot = path.resolve(__dirname, '..')
  const rcedit = path.join(projectRoot, 'node_modules', 'electron-winstaller', 'vendor', 'rcedit.exe')
  const iconPath = path.join(projectRoot, 'build', 'icon.ico')
  const exeName = `${context.packager.appInfo.productFilename}.exe`
  const exePath = path.join(context.appOutDir, exeName)

  if (!fs.existsSync(rcedit)) throw new Error(`rcedit not found: ${rcedit}`)
  if (!fs.existsSync(iconPath)) throw new Error(`icon not found: ${iconPath}`)
  if (!fs.existsSync(exePath)) throw new Error(`exe not found: ${exePath}`)

  const info = context.packager.appInfo
  const version = info.version
  const productName = info.productName
  const companyName = info.companyName || 'Anvilite'

  const args = [
    exePath,
    '--set-icon', iconPath,
    '--set-version-string', 'FileDescription', productName,
    '--set-version-string', 'ProductName', productName,
    '--set-version-string', 'CompanyName', companyName,
    '--set-version-string', 'LegalCopyright', `Copyright © ${new Date().getFullYear()} ${companyName}`,
    '--set-file-version', version,
    '--set-product-version', version,
  ]

  console.log(`[after-pack] rcedit ${exeName} → embed icon + metadata`)
  execFileSync(rcedit, args, { stdio: 'inherit' })
}
