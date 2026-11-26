import { readFileSync, readdirSync, writeFileSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { execFileSync } from 'node:child_process'

// Collect the actual installed licenses instead of maintaining copied license text.
const sections = ['Studio Clock - third-party notices\n\nThese components retain their respective licenses.']
const isLicense = name => /^(licen[sc]e|copying|ofl|notice|unlicense)([.\-_]|$)/i.test(name)
function addNotices(name, directory, extraFiles = []) {
  const files = new Set([...readdirSync(directory, { withFileTypes: true }).filter(entry => entry.isFile() && isLicense(entry.name)).map(entry => entry.name), ...extraFiles])
  const content = [...files].filter(file => existsSync(join(directory, file))).map(file => `${file}\n\n${readFileSync(join(directory, file), 'utf8')}`)
  sections.push(`\n${'='.repeat(72)}\n${name}\n${'='.repeat(72)}\n${content.join('\n\n') || 'See the component source repository for its license.'}`)
}
const lock = JSON.parse(readFileSync('package-lock.json', 'utf8'))
for (const [path, info] of Object.entries(lock.packages)) {
  if (!path || info.dev || !existsSync(path)) continue
  const pkg = JSON.parse(readFileSync(join(path, 'package.json'), 'utf8'))
  addNotices(`${pkg.name} ${pkg.version} (${pkg.license ?? info.license ?? ''})`, path)
}
const android = process.argv.includes('--android')
if (android) {
  sections.push('\nAndroidX WebKit and its AndroidX, Kotlin and JetBrains annotation dependencies\nCopyright The Android Open Source Project and respective component authors.\nLicensed under Apache License 2.0.\n\n' + readFileSync('android/licenses/APACHE-2.0.txt', 'utf8'))
} else {
  const metadata = JSON.parse(execFileSync('cargo', ['metadata', '--locked', '--offline', '--format-version', '1', '--filter-platform', 'x86_64-pc-windows-msvc', '--manifest-path', 'src-tauri/Cargo.toml'], { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 }))
  const resolved = new Set(metadata.resolve.nodes.map(node => node.id))
  for (const pkg of metadata.packages) {
    if (!pkg.source || !resolved.has(pkg.id)) continue
    addNotices(`${pkg.name} ${pkg.version} (${pkg.license ?? ''})`, dirname(pkg.manifest_path), pkg.license_file ? [pkg.license_file] : [])
  }
}
writeFileSync(android ? 'ANDROID_THIRD_PARTY_NOTICES.txt' : 'THIRD_PARTY_NOTICES.txt', `${sections.join('\n')}\n`, 'utf8')
console.log(`Wrote third-party notices for ${sections.length - 1} components.`)
