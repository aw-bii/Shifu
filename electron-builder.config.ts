module.exports = {
  appId: "com.bii.myra",
  productName: "MyRA",
  // publisherName at the top level applies to all platforms and NSIS metadata
  copyright: "Copyright © 2025 Bertelsmann India Investment",
  directories: { output: "dist" },
  files: ["out/**/*"],
  extraResources: [{ from: "resources/claude-bin", to: "claude-bin" }],
  win: {
    target: "nsis",
    icon: "resources/icon.ico",
    publisherName: "Bertelsmann India Investment",
    // Code signing: set WINDOWS_CERTIFICATE_FILE (path to .pfx) and
    // WINDOWS_CERTIFICATE_PASSWORD env vars in CI, then uncomment:
    // certificateFile: process.env.WINDOWS_CERTIFICATE_FILE,
    // certificatePassword: process.env.WINDOWS_CERTIFICATE_PASSWORD,
    // For fully trusted (no SmartScreen warning) you need an EV Code Signing cert.
    // See: https://www.digicert.com/signing/code-signing-certificates
  },
  mac: {
    target: "dmg",
    icon: "resources/icon.icns",
    category: "public.app-category.productivity",
    // Code signing: set APPLE_ID, APPLE_ID_PASSWORD, APPLE_TEAM_ID env vars in CI.
    // electron-builder reads these automatically when present.
  },
  nsis: {
    oneClick: false,
    allowToChangeInstallationDirectory: true,
    // These values appear in the Windows installer wizard and Add/Remove Programs
    installerIcon: "resources/icon.ico",
    uninstallerIcon: "resources/icon.ico",
    uninstallDisplayName: "MyRA — AI Agent Harness",
    license: "LICENSE",
  },
  publish: {
    provider: "github",
    owner: "aw-bii",
    repo: "MyRA",
    releaseType: "release",
  },
};
