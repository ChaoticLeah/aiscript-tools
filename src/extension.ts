import * as vscode from 'vscode';
import puppeteer from 'puppeteer-core';
import fs from 'fs';
import chokidar, { FSWatcher } from 'chokidar';
import path from 'path';
//@ts-ignore
import { Parser } from '@syuilo/aiscript';
import { ErrorInfo, formatErrorMessage } from './errorHandler';
import { resolveIncludes } from './multiFileHandler';

interface AIScriptConfig {
	browserUrl?: string;
	baseUrl: string;
	endUrl: string;
	pipeConsole?: boolean;
	srcDir?: string;
	entry?: string;
	export?: string;
}

let watcher: FSWatcher | undefined;

export function activate(context: vscode.ExtensionContext) {
	const output = vscode.window.createOutputChannel('AIscript Plugin Runner');

	const runPluginWatcher = vscode.commands.registerCommand('aiscript.runPluginWatcher', async () => {

		const workspaceFolder = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
		if (!workspaceFolder) {
			vscode.window.showErrorMessage('No workspace folder is open.');
			return;
		}

		const configPath = path.join(workspaceFolder, 'aiscript.json');
		let config: AIScriptConfig;

		try {
			const raw = fs.readFileSync(configPath, 'utf8');
			config = JSON.parse(raw);
		} catch (err) {
			vscode.window.showErrorMessage('Could not read aiscript.json. Please make sure it exists and is valid JSON.');
			return;
		}

		config.entry = config.entry ?? 'src/main.is';
		config.srcDir = config.srcDir ?? 'src';

		const filePath = path.resolve(workspaceFolder, config.entry);
		if (!fs.existsSync(filePath)) {
			vscode.window.showErrorMessage(`Plugin file not found: ${filePath}`);
			return;
		}

		const browser = await puppeteer.connect({
			browserURL: config.browserUrl ?? 'http://127.0.0.1:9222',
		});

		const page = await browser.newPage();

		if (config.pipeConsole ?? true)
			page.on('console', async msg => {
				try {
					const args = msg.args();
					const values = await Promise.all(args.map(arg => arg.jsonValue()));
					const first = values[0];
					if (first && typeof first === 'object' && 'type' in first && 'value' in first) {
						output.appendLine(`[browser:${msg.type()}] ${first.value}`);
					}
				} catch (err) {
					output.appendLine(`[Error parsing console message] ${err}`);
				}
			});

		await page.setUserAgent(
			'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36'
		);

		const injectPlugin = () => {
			try {
				const entryPath = path.resolve(workspaceFolder, config.entry ?? 'src/main.is');
				const combinedSource = resolveIncludes(entryPath);

				if (config.export) {
					const exportPath = path.resolve(workspaceFolder, config.export);
					fs.mkdirSync(path.dirname(exportPath), { recursive: true });
					fs.writeFileSync(exportPath, combinedSource, 'utf8');
				}

				page.evaluate((data) => {
					//@ts-ignore
					const raw = localStorage.getItem('miux:plugins') ?? '[]';
					let plugins;
					try {
						plugins = JSON.parse(raw);
					} catch {
						console.error('Invalid plugin JSON');
						return;
					}

					if (!Array.isArray(plugins) || plugins.length < 1) {
						console.error("Please install your plugin manually");
						return;
					}

					plugins[0].src = data;
					//@ts-ignore
					localStorage.setItem('miux:plugins', JSON.stringify(plugins));
					console.log('[Plugin updated]');
				}, combinedSource).catch(console.error);
			} catch (err) {
				output.appendLine(`[Error injecting plugin] ${err}`);
			}
		};

		await page.goto(`${config.baseUrl}/settings/plugin`);
		injectPlugin();

		// watcher = fs.watch(filePath, { persistent: true }, (eventType) => {
		// 	if (eventType === 'change') {
		// 		output.appendLine('✅ [Detected file change. Reloading]');
		// 		injectPlugin();
		// 		page.reload().catch(console.error);
		// 	}
		// });

		if (watcher) {
			await watcher.close();
			watcher = undefined;
		}

		const srcDir = path.resolve(workspaceFolder, config.srcDir).replaceAll("\\", "/");

		watcher = chokidar.watch(srcDir, {
			persistent: true,
			ignoreInitial: true,
			awaitWriteFinish: true,
			interval: 200,
			depth: 99,
			followSymlinks: true,
		});

		const reloadPlugin = () => {
			output.appendLine('[Detected file change. Reloading]');
			injectPlugin();
			page.reload().catch((err) => output.appendLine(`[Page reload error] ${err}`));
		};

		watcher
			.on('add', reloadPlugin)
			.on('change', reloadPlugin)
			.on('unlink', reloadPlugin)
			.on('error', (error) => output.appendLine(`[Watcher error] ${error}`));


		output.appendLine('[Watching for changes...]');


		await page.setViewport({ width: 1080, height: 1024 });
		await page.goto(`${config.baseUrl}${config.endUrl}`);
		output.show(true);
	});

	const generateConfig = vscode.commands.registerCommand('aiscript.generateConfig', async () => {
		const workspaceFolder = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
		if (!workspaceFolder) {
			vscode.window.showErrorMessage('No workspace folder is open.');
			return;
		}

		const configPath = path.join(workspaceFolder, 'aiscript.json');
		const defaultConfig = {
			baseUrl: "https://example.com",
			endUrl: "/",
			pipeConsole: true,
			entry: "src/main.is",
			export: "dist/plugin_combined.is",
		};

		try {
			fs.writeFileSync(configPath, JSON.stringify(defaultConfig, null, 2));
			vscode.window.showInformationMessage('AIscript configuration file generated successfully.');
		} catch (err) {
			vscode.window.showErrorMessage('Failed to write aiscript.json.');
		}
	});

	const clearOutputCommand = vscode.commands.registerCommand('aiscript.clearOutput', () => {
		output.clear();
	});

	context.subscriptions.push(runPluginWatcher, generateConfig, clearOutputCommand);
}

export async function deactivate() {
	if (watcher) {
		await watcher.close();
		watcher = undefined;
	}
}
