# ONE desktop app with Tauri

ONE can run as the existing React/Vite web app and as a native desktop application through Tauri v2. The React source remains the single frontend implementation; `src-tauri/` only provides the desktop shell and build configuration.

## Prerequisites on macOS

Install the normal Node.js dependencies plus a Rust toolchain and Apple command-line build tools.

```sh
xcode-select --install
rustup toolchain install stable
npm install
```

If `rustup` is not installed yet, install it from the official Rust installation instructions first.

## Development

Start ONE inside a Tauri desktop window:

```sh
npm run tauri dev
```

Tauri starts the existing Vite development server at `http://127.0.0.1:5173` and loads it in the desktop WebView.

The normal browser workflow remains available:

```sh
npm run dev
```

## Build the desktop application

```sh
npm run tauri build
```

On macOS, the generated application and installer artifacts are written below `src-tauri/target/release/bundle/`. A typical app bundle is under `macos/ONE.app` and a disk image is under `dmg/` when the target supports it.

## Storage behavior

ONE currently keeps timer state, progress, preferences, and recovery data in `localStorage`. Tauri's WebView has its own application origin/storage area, so desktop data is persistent across launches but is separate from data saved by Safari, Chrome, or a Vercel deployment.

This Tauri integration does not add a server, account system, database, analytics, or network API. Device-to-device synchronization would still require a separate shared backend or another synchronization mechanism.

## Security boundary

The desktop shell enables only Tauri's minimal `core:default` capability for the main window. No filesystem, shell, HTTP, opener, or other Tauri plugin permissions are added by this integration. The existing frontend CSP in `index.html` remains in place.

## App icon

The initial integration relies on Tauri's default application icon. When ONE has a dedicated icon source image, generate platform-specific icons with:

```sh
npm run tauri icon path/to/app-icon.png
```

Then review and commit the generated files under `src-tauri/icons/`.
