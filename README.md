# AIscript Plugin Runner for VSCode

A Visual Studio Code extension to streamline running and live-reloading AIscript plugins inside a browser environment controlled via Puppeteer.

---

## Features

- **Run & watch your AIscript plugin:** Automatically inject your plugin into a target browser page, watching for file changes and reloading the page to reflect updates.
- **Browser console piping:** Forward browser console messages to the VSCode output panel for easy debugging.
- **Configuration generator:** Quickly scaffold a default `aiscript.json` config file in your workspace.

---

## Usage

### Configuration

Create an `aiscript.json` file at your workspace root to configure the plugin runner. You can generate a default config with the command:

`> AIscript: Generate Config`

Example `aiscript.json`:
```json
{
  "baseUrl": "https://woem.men",
  "endUrl": "/",
  "pipeConsole": true,
  "entry": "./src/main.is",
  "export": "plugin.is"
}
```

| Field         | Description                                                                                     |
|---------------|-------------------------------------------------------------------------------------------------|
| `baseUrl`     | Base URL of the target Misskey instance where the plugin will be injected.                     |
| `endUrl`      | The page path to open after plugin injection (e.g., `/notes/abc` or `/explore`).               |
| `pipeConsole` | Whether to pipe plugin-related console output to the VSCode terminal.                          |
| `entry`       | The entry point AIscript file (your main plugin source).                                       |
| `export`      | The output file that contains the compiled, single-file version of your plugin.                |

---


### Running the Plugin Watcher

Run the command:

`> AIscript: Run Plugin Watcher`

This will:

- Connect to the browser via Puppeteer.
- Load your plugin file.
- Open the target page.
- Parse and inject the plugin into the target page's localStorage.
- Watch your plugin file for changes and reload automatically.
- Pipe browser console logs into VSCode output.

### Clear Output

Use the command:

`> AIscript: Clear Output`

To clear the plugin runner output channel.

---

## Requirements

- **Puppeteer Remote Debugging:** Your target browser must be started with remote debugging enabled, for example:

`chrome --remote-debugging-port=9222 --no-sandbox --remote-allow-origins=*`

- **Node.js environment:** VSCode extension runs in Node.js and requires dependencies (`puppeteer-core`, `@syuilo/aiscript`).

## Setup

Before using for the first time make sure you:
- Log into the instance in the browser you are using
- Manually install your plugin in the first plugin slot.

## Shortcomings

For now, these are known issues:

- If you change variables or any metadata of the plugin, it **won't live reload correctly**.
- In this case, please manually re-add the plugin.
