import * as vscode from 'vscode';
import puppeteer from 'puppeteer-core';
import fs from 'fs';
import path from 'path';
//@ts-ignore
import { Parser } from '@syuilo/aiscript';
import { ErrorInfo, formatErrorMessage } from './errorHandler';

interface AIScriptConfig {
	file: string;
	browserUrl?: string;
	baseUrl: string;
	endUrl: string;
	pipeConsole?: boolean;
}

let watcher: fs.FSWatcher | undefined;

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

		const filePath = path.resolve(workspaceFolder, config.file);
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
					} else {
						//output.appendLine(`[browser:${msg.type()}] ${values.join(' ')}`);
					}
				} catch (err) {
					output.appendLine(`[Error parsing console message] ${err}`);
				}
			});

		await page.setUserAgent(
			'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36'
		);

		const injectPlugin = () => {
			const data = fs.readFileSync(filePath, 'utf8');
			
			try {
				Parser.parse(data);
			} catch (error) {
				try {
					output.appendLine(formatErrorMessage(error as ErrorInfo));
				} catch (error) {
					output.appendLine('❌ Unknown Error in code');
				}
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
			}, data).catch(console.error);
		};

		await page.goto(`${config.baseUrl}/settings/plugin`);
		injectPlugin();

		watcher = fs.watch(filePath, { persistent: true }, (eventType) => {
			if (eventType === 'change') {
				output.appendLine('✅ [Detected file change. Reloading]');
				injectPlugin();
				page.reload().catch(console.error);
			}
		});

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
			file: "plugin.is",
			baseUrl: "https://example.com",
			endUrl: "/",
			pipeConsole: true
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

export function deactivate() {
	watcher?.close();
}
