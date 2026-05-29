// electron-builder skips its own signing (mac.identity = null), which leaves the
// stale Electron signature in place after the bundle is modified — an invalid
// signature that Apple Silicon rejects as "damaged".  This hook re-signs the
// whole bundle ad-hoc (`codesign --sign -`) so it has a *valid* signature.
//
// Ad-hoc signed (no Apple Developer ID) means testers must still clear the
// download quarantine once — right-click → Open, or `xattr -cr <app>` — but the
// app then launches normally.  Swap in a Developer ID identity + notarization
// when you want a no-prompt install.
const path = require("node:path");
const { execFileSync } = require("node:child_process");

exports.default = async function afterPack(context) {
	if (context.electronPlatformName !== "darwin") return;

	const appName = context.packager.appInfo.productFilename;
	const appPath = path.join(context.appOutDir, `${appName}.app`);

	console.log(`[afterPack] Ad-hoc signing ${appPath}`);
	execFileSync("codesign", ["--force", "--deep", "--sign", "-", appPath], {
		stdio: "inherit",
	});
};
