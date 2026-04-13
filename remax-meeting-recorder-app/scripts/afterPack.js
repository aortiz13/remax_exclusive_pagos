const { execSync } = require('child_process');
const path = require('path');

exports.default = async function (context) {
    if (context.electronPlatformName !== 'darwin') return;

    const appPath = path.join(context.appOutDir, `${context.packager.appInfo.productFilename}.app`);
    console.log(`  • post-pack: cleaning & ad-hoc signing ${appPath}`);

    try {
        // Remove .DS_Store, resource forks, and extended attributes that block codesign
        execSync(`find "${appPath}" -name ".DS_Store" -delete 2>/dev/null; find "${appPath}" -name "._*" -delete 2>/dev/null; xattr -cr "${appPath}"`, { stdio: 'pipe' });
        // Ad-hoc sign (required for unsigned Electron apps on macOS)
        execSync(`codesign --force --deep --sign - "${appPath}"`, { stdio: 'inherit' });
        console.log('  • ad-hoc signing complete ✅');
    } catch (err) {
        console.warn('  • ad-hoc signing failed (non-fatal):', err.message);
    }
};
