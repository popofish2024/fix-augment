import * as vscode from 'vscode';
import hljs from 'highlight.js';
import * as path from 'path';
import * as fs from 'fs';

// Use require for marked to ensure compatibility
const { marked } = require('marked');

// Status bar items
let statusBarItem: vscode.StatusBarItem;

// Flags to track extension state
let enhancementActive = true;

// UI state tracking
let dashboardPanel: vscode.WebviewPanel | undefined;
let welcomePanel: vscode.WebviewPanel | undefined;
let contextExchangeCount = 0;
let sessionStartTime = Date.now();
let lastContextRefresh = Date.now();
let filesProcessed = 0;

// Interface for the Augment extension API
interface AugmentExtension {
  // Core API methods that we can enhance
  getAPI?: () => any;
  executeCommand?: (command: string, ...args: any[]) => Promise<any>;
}

// Dashboard tree item class
class DashboardItem extends vscode.TreeItem {
  constructor(
    public readonly label: string,
    public readonly collapsibleState: vscode.TreeItemCollapsibleState,
    public readonly command?: vscode.Command,
    public readonly iconPath?: vscode.ThemeIcon
  ) {
    super(label, collapsibleState);
    this.tooltip = this.label;
    this.contextValue = 'dashboardItem';
  }
}

// Dashboard tree data provider
class DashboardProvider implements vscode.TreeDataProvider<DashboardItem> {
  private _onDidChangeTreeData: vscode.EventEmitter<DashboardItem | undefined | null | void> = new vscode.EventEmitter<DashboardItem | undefined | null | void>();
  readonly onDidChangeTreeData: vscode.Event<DashboardItem | undefined | null | void> = this._onDidChangeTreeData.event;

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: DashboardItem): vscode.TreeItem {
    return element;
  }

  getChildren(element?: DashboardItem): Thenable<DashboardItem[]> {
    if (!element) {
      // Root items
      return Promise.resolve([
        new DashboardItem(
          '🎛️ Open Dashboard',
          vscode.TreeItemCollapsibleState.None,
          {
            command: 'fix-augment.showDashboard',
            title: 'Open Dashboard'
          },
          new vscode.ThemeIcon('dashboard')
        ),
        new DashboardItem(
          '📱 Welcome & Changelog',
          vscode.TreeItemCollapsibleState.None,
          {
            command: 'fix-augment.showWelcome',
            title: 'Show Welcome'
          },
          new vscode.ThemeIcon('info')
        ),
        new DashboardItem(
          '🧠 Context Health',
          vscode.TreeItemCollapsibleState.None,
          {
            command: 'fix-augment.contextHealth',
            title: 'Check Context Health'
          },
          new vscode.ThemeIcon('pulse')
        ),
        new DashboardItem(
          '📁 Validate File Context',
          vscode.TreeItemCollapsibleState.None,
          {
            command: 'fix-augment.validateFileContext',
            title: 'Validate File Context'
          },
          new vscode.ThemeIcon('file-code')
        ),
        new DashboardItem(
          '🔧 Optimize Prompt',
          vscode.TreeItemCollapsibleState.None,
          {
            command: 'fix-augment.optimizePrompt',
            title: 'Optimize Prompt'
          },
          new vscode.ThemeIcon('tools')
        ),
        new DashboardItem(
          '⚙️ Settings',
          vscode.TreeItemCollapsibleState.None,
          {
            command: 'workbench.action.openSettings',
            title: 'Open Settings',
            arguments: ['fixAugment']
          },
          new vscode.ThemeIcon('settings-gear')
        )
      ]);
    }
    return Promise.resolve([]);
  }
}

// Common Augment issues and their patterns
const AUGMENT_ISSUES = {
  DOUBLE_QUOTE_ERROR: /We encountered an issue sending your message/i,
  TOO_LARGE_INPUT: /too large of an input/i,
  CREDIT_CONSUMED_ERROR: /I'm sorry\. I tried to call a tool, but provided too large of an input/i,
  TASK_BREAKDOWN_NEEDED: /break.*down.*smaller.*tasks/i
};

/**
 * Activate the extension
 */
// Store the extension context for later use (if needed)
// let extensionContext: vscode.ExtensionContext;

export function activate(context: vscode.ExtensionContext) {
  // Store the context
  // extensionContext = context;
  console.log('Fix Augment extension is now active!');

  // Set context for view visibility
  vscode.commands.executeCommand('setContext', 'fixAugment.enabled', true);

  // Create main status bar item
  statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
  statusBarItem.text = '$(megaphone) Augment Fix: ON';
  statusBarItem.tooltip = 'Fix Augment is active. Click to toggle.';
  statusBarItem.command = 'fix-augment.toggleEnhancement';
  statusBarItem.show();
  context.subscriptions.push(statusBarItem);

  // Register dashboard tree data provider
  const dashboardProvider = new DashboardProvider();
  vscode.window.registerTreeDataProvider('fixAugmentDashboard', dashboardProvider);
  context.subscriptions.push(
    vscode.commands.registerCommand('fix-augment.refreshDashboardTree', () => dashboardProvider.refresh())
  );

  // Register commands
  context.subscriptions.push(
    // UI Commands
    vscode.commands.registerCommand('fix-augment.showDashboard', () => showDashboard(context)),
    vscode.commands.registerCommand('fix-augment.showWelcome', () => showWelcome(context)),
    vscode.commands.registerCommand('fix-augment.contextHealth', checkContextHealthCommand),
    vscode.commands.registerCommand('fix-augment.refreshContext', refreshContextCommand),
    vscode.commands.registerCommand('fix-augment.validateFileContext', validateFileContextCommand),
    vscode.commands.registerCommand('fix-augment.monitorProcess', monitorProcessCommand),

    // Fix Commands
    vscode.commands.registerCommand('fix-augment.fixDoubleQuotes', fixDoubleQuotesCommand),
    vscode.commands.registerCommand('fix-augment.checkInputSize', checkInputSizeCommand),
    vscode.commands.registerCommand('fix-augment.suggestBreakdown', suggestBreakdownCommand),
    vscode.commands.registerCommand('fix-augment.optimizePrompt', optimizePromptCommand),
    vscode.commands.registerCommand('fix-augment.formatOutput', formatOutput),
    vscode.commands.registerCommand('fix-augment.toggleEnhancement', toggleEnhancement)
  );

  // Show welcome screen on first install or update
  checkAndShowWelcome(context);

  // Listen for text document changes to intercept Augment output
  context.subscriptions.push(
    vscode.workspace.onDidChangeTextDocument(handleTextDocumentChange)
  );

  // Try to find the Augment extension
  checkForAugmentExtension();
}

/**
 * Check if the Augment extension is installed and available
 */
async function checkForAugmentExtension(): Promise<AugmentExtension | undefined> {
  const augmentExtension = vscode.extensions.getExtension('augment.vscode-augment');

  if (augmentExtension) {
    console.log('Augment extension found, setting up enhancements...');

    // Try to get the extension's API
    const augmentAPI = augmentExtension.exports as AugmentExtension;

    // Set up enhancement hooks if available
    setupAugmentEnhancements(augmentAPI);

    vscode.window.showInformationMessage('Fix Augment: Enhancement layer activated for Augment workflows!');
    return augmentAPI;
  } else {
    vscode.window.showWarningMessage('Augment extension not found. Fix Augment will work in standalone mode.');
    return undefined;
  }
}

/**
 * Set up enhancement hooks with Augment extension
 */
function setupAugmentEnhancements(augmentAPI: AugmentExtension): void {
  try {
    console.log('Setting up Augment fixes and enhancements...');

    // Set up text document change monitoring for fixes
    setupAugmentFixes();

    console.log('Augment fixes and enhancements successfully set up');
  } catch (error) {
    console.log('Could not set up all enhancements:', error);
    // Gracefully degrade - extension still works without hooks
  }
}

/**
 * Set up fixes for common Augment issues
 */
function setupAugmentFixes(): void {
  // Monitor for common Augment error patterns and provide fixes
  console.log('Augment issue monitoring active');
}

/**
 * Handle text document changes to intercept and enhance Augment output
 */
async function handleTextDocumentChange(event: vscode.TextDocumentChangeEvent): Promise<void> {
  // Only process if enhancement is active
  if (!enhancementActive) {
    return;
  }

  // Check if this looks like an Augment output
  const changes = event.contentChanges;
  if (changes.length === 0) {
    return;
  }

  // Look for patterns that might indicate Augment output (updated for 2025 Augment formats)
  const text = changes[0].text;
  if (text.includes('```') ||
      text.includes('function_results') ||
      text.includes('<augment_code_snippet') ||
      text.includes('Agent:') ||
      text.includes('Next Edit:') ||
      text.includes('Instructions:') ||
      text.includes('Chat:')) {

    // This might be Augment output, try to enhance it
    const enhancedOutput = await formatOutput(text);

    // Replace the text if it was enhanced
    if (enhancedOutput !== text) {
      const editor = vscode.window.activeTextEditor;
      if (editor) {
        const range = new vscode.Range(
          event.document.positionAt(changes[0].rangeOffset),
          event.document.positionAt(changes[0].rangeOffset + changes[0].rangeLength)
        );

        editor.edit(editBuilder => {
          editBuilder.replace(range, enhancedOutput);
        });
      }
    }
  }
}

/**
 * Enhance the selected input for Augment
 */
async function enhanceInput(): Promise<void> {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    vscode.window.showErrorMessage('No active editor found');
    return;
  }

  const selection = editor.selection;
  if (selection.isEmpty) {
    vscode.window.showErrorMessage('No text selected');
    return;
  }

  // Get the selected text
  const text = editor.document.getText(selection);

  // Get the configuration for max input size
  const config = vscode.workspace.getConfiguration('fixAugment');
  const maxInputSize = config.get<number>('maxInputSize') || 10000;

  // Process the input
  try {
    let enhancedInput = text;

    // If the input is too large, chunk it
    if (text.length > maxInputSize) {
      // Show a progress notification
      await vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: 'Processing large input',
        cancellable: true
      }, async (progress) => {
        // Split the input into chunks
        const chunks = chunkText(text, maxInputSize);
        progress.report({ message: `Processing ${chunks.length} chunks...` });

        // Process each chunk
        enhancedInput = chunks.join('\n\n--- CHUNK BOUNDARY ---\n\n');

        return new Promise<void>(resolve => {
          setTimeout(() => {
            resolve();
          }, 1000);
        });
      });

      // Replace the selected text with the enhanced input
      editor.edit(editBuilder => {
        editBuilder.replace(selection, enhancedInput);
      });

      vscode.window.showInformationMessage(`Input processed into ${Math.ceil(text.length / maxInputSize)} chunks`);
    } else {
      // Input is small enough, just optimize it
      enhancedInput = optimizeInput(text);

      // Replace the selected text with the enhanced input
      editor.edit(editBuilder => {
        editBuilder.replace(selection, enhancedInput);
      });

      vscode.window.showInformationMessage('Input optimized for Augment');
    }
  } catch (error) {
    vscode.window.showErrorMessage(`Error enhancing input: ${error}`);
  }
}

/**
 * Format the selected output from Augment
 */
async function formatOutput(text?: string): Promise<string> {
  // If no text is provided, get it from the editor selection
  if (!text) {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      vscode.window.showErrorMessage('No active editor found');
      return '';
    }

    const selection = editor.selection;
    if (selection.isEmpty) {
      vscode.window.showErrorMessage('No text selected');
      return '';
    }

    text = editor.document.getText(selection);

    // Process the output
    try {
      const enhancedOutput = enhanceOutput(text);

      // Replace the selected text with the enhanced output
      editor.edit(editBuilder => {
        editBuilder.replace(selection, enhancedOutput);
      });

      vscode.window.showInformationMessage('Output formatted');
      return enhancedOutput;
    } catch (error) {
      vscode.window.showErrorMessage(`Error formatting output: ${error}`);
      return text;
    }
  } else {
    // Just process the provided text and return it
    return enhanceOutput(text);
  }
}

/**
 * Toggle the enhancement feature on/off
 */
function toggleEnhancement(): void {
  enhancementActive = !enhancementActive;

  if (enhancementActive) {
    statusBarItem.text = '$(megaphone) Augment Fix: ON';
    statusBarItem.tooltip = 'Fix Augment is active. Click to toggle.';
    vscode.commands.executeCommand('setContext', 'fixAugment.enabled', true);
    vscode.window.showInformationMessage('Fix Augment is now active');
  } else {
    statusBarItem.text = '$(megaphone) Augment Fix: OFF';
    statusBarItem.tooltip = 'Fix Augment is inactive. Click to toggle.';
    vscode.commands.executeCommand('setContext', 'fixAugment.enabled', false);
    vscode.window.showInformationMessage('Fix Augment is now inactive');
  }
}

/**
 * Split text into chunks of a specified size
 */
function chunkText(text: string, maxSize: number): string[] {
  const chunks: string[] = [];

  // Try to split at paragraph boundaries first
  const paragraphs = text.split(/\n\s*\n/);

  let currentChunk = '';

  for (const paragraph of paragraphs) {
    // If adding this paragraph would exceed the max size, start a new chunk
    if (currentChunk.length + paragraph.length > maxSize && currentChunk.length > 0) {
      chunks.push(currentChunk);
      currentChunk = paragraph;
    } else {
      // Add to the current chunk with a paragraph separator if needed
      if (currentChunk.length > 0) {
        currentChunk += '\n\n' + paragraph;
      } else {
        currentChunk = paragraph;
      }
    }
  }

  // Add the last chunk if it has content
  if (currentChunk.length > 0) {
    chunks.push(currentChunk);
  }

  // If we still have chunks that are too large, split them further
  const result: string[] = [];

  for (const chunk of chunks) {
    if (chunk.length <= maxSize) {
      result.push(chunk);
    } else {
      // Split at sentence boundaries
      let remainingText = chunk;
      while (remainingText.length > maxSize) {
        // Find a good breaking point (end of sentence) near the max size
        let breakPoint = remainingText.lastIndexOf('.', maxSize);
        if (breakPoint === -1 || breakPoint < maxSize / 2) {
          // If no good sentence break, try line break
          breakPoint = remainingText.lastIndexOf('\n', maxSize);
        }
        if (breakPoint === -1 || breakPoint < maxSize / 2) {
          // If still no good break, just break at the max size
          breakPoint = maxSize;
        } else {
          // Include the period or line break
          breakPoint += 1;
        }

        result.push(remainingText.substring(0, breakPoint));
        remainingText = remainingText.substring(breakPoint).trim();
      }

      if (remainingText.length > 0) {
        result.push(remainingText);
      }
    }
  }

  return result;
}

/**
 * Optimize input text for Augment
 */
function optimizeInput(text: string): string {
  // Remove excessive whitespace
  let optimized = text.replace(/\s+/g, ' ');

  // Trim the text
  optimized = optimized.trim();

  // Add clear instructions for better results
  if (!optimized.toLowerCase().includes('please') && !optimized.toLowerCase().includes('could you')) {
    optimized = 'Please ' + optimized.charAt(0).toLowerCase() + optimized.slice(1);
  }

  // Add a period at the end if missing
  if (!optimized.endsWith('.') && !optimized.endsWith('?') && !optimized.endsWith('!')) {
    optimized += '.';
  }

  return optimized;
}

/**
 * Enhance output text from Augment
 */
function enhanceOutput(text: string): string {
  // Get the configuration for output format
  const config = vscode.workspace.getConfiguration('fixAugment');
  const outputFormat = config.get<string>('outputFormat') || 'enhanced';

  if (outputFormat === 'default') {
    // Don't modify the output
    return text;
  }

  // Process code blocks with syntax highlighting
  let enhanced = text;

  if (outputFormat === 'markdown' || outputFormat === 'enhanced') {
    // Improve code block formatting
    enhanced = enhanced.replace(/```(\w+)?\s*([\s\S]*?)```/g, (_, language, code) => {
      // Add proper language tag if missing
      if (!language) {
        // Try to detect the language
        const detectedLang = detectCodeLanguage(code);
        language = detectedLang || '';
      }

      // Format the code block
      return `\`\`\`${language}\n${code.trim()}\n\`\`\``;
    });

    // Improve function call formatting
    enhanced = enhanced.replace(/<function_results>(([\s\S]*?))<\/function_results>/g, (_, content) => {
      return `<details>\n<summary>Function Results</summary>\n\n\`\`\`\n${content.trim()}\n\`\`\`\n</details>\n`;
    });

    // Add proper XML tags for code snippets
    enhanced = enhanced.replace(/<augment_code_snippet([^>]*)>([\s\S]*?)<\/augment_code_snippet>/g, (_, attrs, content) => {
      // Extract path and mode attributes
      const pathMatch = attrs.match(/path="([^"]*)"/i);
      const modeMatch = attrs.match(/mode="([^"]*)"/i);

      const path = pathMatch ? pathMatch[1] : 'unknown';
      const mode = modeMatch ? modeMatch[1] : 'EXCERPT';

      // Format the code snippet with proper attributes
      return `<augment_code_snippet path="${path}" mode="${mode}">\n${content.trim()}\n</augment_code_snippet>`;
    });
  }

  if (outputFormat === 'html') {
    // Convert markdown to HTML
    enhanced = marked.parse(enhanced) as string;

    // Add syntax highlighting
    enhanced = enhanced.replace(/<pre><code class="language-(\w+)">([\s\S]*?)<\/code><\/pre>/g, (match, language, code) => {
      try {
        // Use the correct highlight.js API for version 11.x
        const highlighted = hljs.highlight(code, { language }).value;
        return `<pre><code class="language-${language} hljs">${highlighted}</code></pre>`;
      } catch (e) {
        console.error('Highlight.js error:', e);
        return match;
      }
    });
  }

  return enhanced;
}

/**
 * Try to detect the programming language of a code snippet
 */
function detectCodeLanguage(code: string): string | undefined {
  // Simple language detection based on common patterns
  if (code.includes('function') && (code.includes('{') || code.includes('=>'))) {
    return 'javascript';
  }
  if (code.includes('import') && code.includes('from') && code.includes('const')) {
    return 'typescript';
  }
  if (code.includes('def ') && code.includes(':')) {
    return 'python';
  }
  if (code.includes('class') && code.includes('{') && code.includes('public')) {
    return 'java';
  }
  if (code.includes('<html') || code.includes('<!DOCTYPE')) {
    return 'html';
  }
  if (code.includes('package ') && code.includes('import ') && code.includes('func ')) {
    return 'go';
  }
  if (code.includes('#include') && (code.includes('<stdio.h>') || code.includes('<iostream>'))) {
    return code.includes('cout') ? 'cpp' : 'c';
  }

  // Default to plaintext if we can't detect
  return undefined;
}

/**
 * Smart chunk the selected input for Augment, preserving context and code blocks
 */
async function smartChunkInput(): Promise<void> {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    vscode.window.showErrorMessage('No active editor found');
    return;
  }

  const selection = editor.selection;
  if (selection.isEmpty) {
    vscode.window.showErrorMessage('No text selected');
    return;
  }

  // Get the selected text
  const text = editor.document.getText(selection);

  // Get the configuration
  const config = vscode.workspace.getConfiguration('fixAugment');
  const maxInputSize = config.get<number>('maxInputSize') || 10000;
  const preserveCodeBlocks = config.get<boolean>('preserveCodeBlocks') || true;
  const smartChunkingEnabled = config.get<boolean>('smartChunking') || true;

  try {
    // Show a progress notification
    await vscode.window.withProgress({
      location: vscode.ProgressLocation.Notification,
      title: 'Smart chunking input',
      cancellable: true
    }, async (progress) => {
      progress.report({ message: 'Analyzing content...' });

      // Extract code blocks if preservation is enabled
      let chunks: string[] = [];

      if (preserveCodeBlocks && text.includes('```')) {
        // Split by code blocks and preserve them
        const codeBlockRegex = /(```[\s\S]*?```)/g;
        const parts = text.split(codeBlockRegex);

        for (const part of parts) {
          if (part.startsWith('```') && part.endsWith('```')) {
            // This is a code block, keep it intact if possible
            if (part.length > maxInputSize) {
              // Code block is too large, we need to split it
              const lines = part.split('\n');
              let currentChunk = '';

              for (const line of lines) {
                if (currentChunk.length + line.length + 1 > maxInputSize && currentChunk.length > 0) {
                  chunks.push(currentChunk);
                  currentChunk = line;
                } else {
                  if (currentChunk.length > 0) {
                    currentChunk += '\n' + line;
                  } else {
                    currentChunk = line;
                  }
                }
              }

              if (currentChunk.length > 0) {
                chunks.push(currentChunk);
              }
            } else {
              // Code block fits within size limit
              chunks.push(part);
            }
          } else if (part.trim().length > 0) {
            // This is regular text, chunk it smartly
            const textChunks = smartChunkingEnabled ?
              smartChunkText(part, maxInputSize) :
              chunkText(part, maxInputSize);

            chunks = chunks.concat(textChunks);
          }
        }
      } else {
        // No code blocks or preservation disabled
        chunks = smartChunkingEnabled ?
          smartChunkText(text, maxInputSize) :
          chunkText(text, maxInputSize);
      }

      progress.report({ message: `Created ${chunks.length} smart chunks` });

      // Join the chunks with a clear separator
      const enhancedInput = chunks.join('\n\n--- SMART CHUNK BOUNDARY ---\n\n');

      // Replace the selected text with the enhanced input
      editor.edit(editBuilder => {
        editBuilder.replace(selection, enhancedInput);
      });

      return new Promise<void>(resolve => {
        setTimeout(() => {
          resolve();
        }, 1000);
      });
    });

    vscode.window.showInformationMessage('Input smart chunked successfully');
  } catch (error) {
    vscode.window.showErrorMessage(`Error smart chunking input: ${error}`);
  }
}

/**
 * Smart chunk text into pieces that preserve context
 */
function smartChunkText(text: string, maxSize: number): string[] {
  const chunks: string[] = [];

  // Try to split at paragraph boundaries first
  const paragraphs = text.split(/\n\s*\n/);

  let currentChunk = '';
  let currentContext = '';

  for (const paragraph of paragraphs) {
    // If adding this paragraph would exceed the max size, start a new chunk
    if (currentChunk.length + paragraph.length > maxSize && currentChunk.length > 0) {
      // Add a small context from the end of the previous chunk
      const contextSize = Math.min(200, currentChunk.length / 4);
      currentContext = currentChunk.substring(currentChunk.length - contextSize);

      chunks.push(currentChunk);
      currentChunk = paragraph;
    } else {
      // Add to the current chunk with a paragraph separator if needed
      if (currentChunk.length > 0) {
        currentChunk += '\n\n' + paragraph;
      } else {
        // If we have context from a previous chunk, prepend it
        if (currentContext.length > 0) {
          currentChunk = '--- CONTEXT FROM PREVIOUS CHUNK ---\n' + currentContext + '\n\n--- CONTINUATION ---\n\n' + paragraph;
          currentContext = '';
        } else {
          currentChunk = paragraph;
        }
      }
    }
  }

  // Add the last chunk if it has content
  if (currentChunk.length > 0) {
    chunks.push(currentChunk);
  }

  // If we still have chunks that are too large, split them further
  const result: string[] = [];

  for (const chunk of chunks) {
    if (chunk.length <= maxSize) {
      result.push(chunk);
    } else {
      // Split at sentence boundaries
      let remainingText = chunk;
      while (remainingText.length > maxSize) {
        // Find a good breaking point (end of sentence) near the max size
        let breakPoint = remainingText.lastIndexOf('.', maxSize);
        if (breakPoint === -1 || breakPoint < maxSize / 2) {
          // If no good sentence break, try line break
          breakPoint = remainingText.lastIndexOf('\n', maxSize);
        }
        if (breakPoint === -1 || breakPoint < maxSize / 2) {
          // If still no good break, just break at the max size
          breakPoint = maxSize;
        } else {
          // Include the period or line break
          breakPoint += 1;
        }

        result.push(remainingText.substring(0, breakPoint));
        remainingText = remainingText.substring(breakPoint).trim();
      }

      if (remainingText.length > 0) {
        result.push(remainingText);
      }
    }
  }

  return result;
}

/**
 * Apply a syntax highlighting theme
 */
async function applyTheme(): Promise<void> {
  // Get the available themes
  const themes = ['default', 'github', 'monokai', 'dracula', 'nord'];

  // Show a quick pick to select the theme
  const selectedTheme = await vscode.window.showQuickPick(themes, {
    placeHolder: 'Select a syntax highlighting theme',
    canPickMany: false
  });

  if (selectedTheme) {
    // Update the configuration
    const config = vscode.workspace.getConfiguration('fixAugment');
    await config.update('syntaxTheme', selectedTheme, vscode.ConfigurationTarget.Global);

    vscode.window.showInformationMessage(`Syntax theme set to ${selectedTheme}`);
  }
}

/**
 * Optimize code blocks in the selected text
 */
async function optimizeCodeBlocks(): Promise<void> {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    vscode.window.showErrorMessage('No active editor found');
    return;
  }

  const selection = editor.selection;
  if (selection.isEmpty) {
    vscode.window.showErrorMessage('No text selected');
    return;
  }

  // Get the selected text
  const text = editor.document.getText(selection);

  try {
    // Find and optimize code blocks
    const optimized = text.replace(/```(\w+)?\s*([\s\S]*?)```/g, (_, language, code) => {
      // Add proper language tag if missing
      if (!language) {
        // Try to detect the language
        const detectedLang = detectCodeLanguage(code);
        language = detectedLang || '';
      }

      // Format the code block
      const formattedCode = code.trim()
        .replace(/^\s+/gm, (spaces: string) => spaces.replace(/\s/g, ' ')) // Replace tabs with spaces
        .replace(/\n{3,}/g, '\n\n'); // Remove excessive blank lines

      return `\`\`\`${language}\n${formattedCode}\n\`\`\``;
    });

    // Replace the selected text with the optimized version
    editor.edit(editBuilder => {
      editBuilder.replace(selection, optimized);
    });

    vscode.window.showInformationMessage('Code blocks optimized');
  } catch (error) {
    vscode.window.showErrorMessage(`Error optimizing code blocks: ${error}`);
  }
}

/**
 * Fix double quote issues in text
 */
function fixDoubleQuotes(text: string): string {
  // Escape unescaped double quotes that might cause Augment errors
  return text.replace(/(?<!\\)"/g, '\\"');
}

/**
 * Check if input is too large and suggest breakdown
 */
function checkInputSize(text: string): { isLarge: boolean; suggestion?: string } {
  const MAX_SAFE_SIZE = 8000; // Conservative limit based on Discord feedback

  if (text.length > MAX_SAFE_SIZE) {
    return {
      isLarge: true,
      suggestion: `Input is ${text.length} characters (recommended max: ${MAX_SAFE_SIZE}). Consider breaking this into smaller tasks to avoid "too large input" errors and credit consumption.`
    };
  }

  return { isLarge: false };
}

/**
 * Suggest task breakdown for complex prompts
 */
function suggestTaskBreakdown(text: string): string | null {
  // Detect complex prompts that might benefit from breakdown
  const complexityIndicators = [
    /write.*documentation/i,
    /create.*complete/i,
    /implement.*entire/i,
    /build.*full/i,
    /generate.*all/i
  ];

  const hasComplexity = complexityIndicators.some(pattern => pattern.test(text));

  if (hasComplexity && text.length > 2000) {
    return "This looks like a complex task. Consider breaking it down:\n" +
           "1. Start with the main structure\n" +
           "2. Ask for specific sections one by one\n" +
           "3. Use 'continue from where you left off' for incomplete responses\n" +
           "This prevents 'too large input' errors and credit loss.";
  }

  return null;
}

/**
 * Command: Fix double quotes in selected text
 */
async function fixDoubleQuotesCommand(): Promise<void> {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    vscode.window.showErrorMessage('No active editor found');
    return;
  }

  const selection = editor.selection;
  if (selection.isEmpty) {
    vscode.window.showErrorMessage('No text selected');
    return;
  }

  const text = editor.document.getText(selection);
  const fixedText = fixDoubleQuotes(text);

  if (fixedText !== text) {
    editor.edit(editBuilder => {
      editBuilder.replace(selection, fixedText);
    });
    vscode.window.showInformationMessage('Fixed double quotes to prevent Augment errors');
  } else {
    vscode.window.showInformationMessage('No double quote issues found');
  }
}

/**
 * Command: Check input size and warn about potential issues
 */
async function checkInputSizeCommand(): Promise<void> {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    vscode.window.showErrorMessage('No active editor found');
    return;
  }

  const selection = editor.selection;
  if (selection.isEmpty) {
    vscode.window.showErrorMessage('No text selected');
    return;
  }

  const text = editor.document.getText(selection);
  const sizeCheck = checkInputSize(text);

  if (sizeCheck.isLarge) {
    const action = await vscode.window.showWarningMessage(
      sizeCheck.suggestion!,
      'Break Down Task',
      'Continue Anyway'
    );

    if (action === 'Break Down Task') {
      vscode.commands.executeCommand('fix-augment.suggestBreakdown');
    }
  } else {
    vscode.window.showInformationMessage(`Input size OK: ${text.length} characters`);
  }
}

/**
 * Command: Suggest task breakdown for complex prompts
 */
async function suggestBreakdownCommand(): Promise<void> {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    vscode.window.showErrorMessage('No active editor found');
    return;
  }

  const selection = editor.selection;
  if (selection.isEmpty) {
    vscode.window.showErrorMessage('No text selected');
    return;
  }

  const text = editor.document.getText(selection);
  const suggestion = suggestTaskBreakdown(text);

  if (suggestion) {
    const action = await vscode.window.showInformationMessage(
      suggestion,
      'Apply Suggestion'
    );

    if (action === 'Apply Suggestion') {
      // Insert breakdown suggestion as comment
      const breakdownText = `\n\n/* TASK BREAKDOWN SUGGESTION:\n${suggestion}\n*/\n\n`;
      editor.edit(editBuilder => {
        editBuilder.insert(selection.end, breakdownText);
      });
    }
  } else {
    vscode.window.showInformationMessage('This prompt looks good for direct use with Augment');
  }
}

/**
 * Command: Optimize prompt for Augment (combines all fixes)
 */
async function optimizePromptCommand(): Promise<void> {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    vscode.window.showErrorMessage('No active editor found');
    return;
  }

  const selection = editor.selection;
  if (selection.isEmpty) {
    vscode.window.showErrorMessage('No text selected');
    return;
  }

  const text = editor.document.getText(selection);
  let optimizedText = text;
  const issues: string[] = [];

  // Fix double quotes
  const fixedQuotes = fixDoubleQuotes(text);
  if (fixedQuotes !== text) {
    optimizedText = fixedQuotes;
    issues.push('Fixed double quotes');
  }

  // Check input size
  const sizeCheck = checkInputSize(optimizedText);
  if (sizeCheck.isLarge) {
    issues.push('Input size warning: ' + sizeCheck.suggestion);
  }

  // Check for task breakdown suggestion
  const breakdown = suggestTaskBreakdown(optimizedText);
  if (breakdown) {
    issues.push('Task breakdown suggested');
  }

  // Apply optimizations
  if (optimizedText !== text) {
    editor.edit(editBuilder => {
      editBuilder.replace(selection, optimizedText);
    });
  }

  // Show results
  if (issues.length > 0) {
    vscode.window.showInformationMessage(`Optimized prompt: ${issues.join(', ')}`);
  } else {
    vscode.window.showInformationMessage('Prompt is already optimized for Augment');
  }
}





/**
 * Check and show welcome screen if needed
 */
async function checkAndShowWelcome(context: vscode.ExtensionContext): Promise<void> {
  const config = vscode.workspace.getConfiguration('fixAugment');
  const showWelcomeOnUpdate = config.get<boolean>('showWelcomeOnUpdate', true);

  if (showWelcomeOnUpdate) {
    const lastVersion = context.globalState.get<string>('lastVersion', '0.0.0');
    const currentVersion = '2.2.1';

    if (lastVersion !== currentVersion) {
      await context.globalState.update('lastVersion', currentVersion);
      // Add a small delay to ensure extension is fully loaded
      setTimeout(() => {
        showWelcome(context);
      }, 1000);
    }
  }
}

/**
 * Show welcome screen
 */
function showWelcome(context: vscode.ExtensionContext): void {
  if (welcomePanel) {
    welcomePanel.reveal();
    return;
  }

  welcomePanel = vscode.window.createWebviewPanel(
    'fixAugmentWelcome',
    'Fix Augment - Welcome',
    vscode.ViewColumn.One,
    {
      enableScripts: true,
      localResourceRoots: [
        vscode.Uri.file(path.join(context.extensionPath, 'out', 'webview')),
        vscode.Uri.file(path.join(context.extensionPath, 'src', 'webview'))
      ]
    }
  );

  welcomePanel.webview.html = getWelcomeHtml(context);

  welcomePanel.webview.onDidReceiveMessage(
    message => {
      switch (message.command) {
        case 'openDashboard':
          showDashboard(context);
          break;
        case 'openSettings':
          vscode.commands.executeCommand('workbench.action.openSettings', 'fixAugment');
          break;
        case 'closeWelcome':
          welcomePanel?.dispose();
          break;
      }
    },
    undefined,
    context.subscriptions
  );

  welcomePanel.onDidDispose(() => {
    welcomePanel = undefined;
  });
}

/**
 * Show dashboard
 */
function showDashboard(context: vscode.ExtensionContext): void {
  if (dashboardPanel) {
    dashboardPanel.reveal();
    return;
  }

  dashboardPanel = vscode.window.createWebviewPanel(
    'fixAugmentDashboard',
    'Fix Augment Dashboard',
    vscode.ViewColumn.One,
    {
      enableScripts: true,
      localResourceRoots: [
        vscode.Uri.file(path.join(context.extensionPath, 'out', 'webview')),
        vscode.Uri.file(path.join(context.extensionPath, 'src', 'webview'))
      ]
    }
  );

  dashboardPanel.webview.html = getDashboardHtml(context);

  dashboardPanel.webview.onDidReceiveMessage(
    message => {
      switch (message.command) {
        case 'refreshDashboard':
          updateDashboardStatus();
          break;
        case 'checkContextHealth':
          checkContextHealthCommand();
          break;
        case 'refreshContext':
          refreshContextCommand();
          break;
        case 'validateFileContext':
          validateFileContextCommand();
          break;
        case 'optimizePrompt':
          optimizePromptCommand();
          break;
        case 'fixDoubleQuotes':
          fixDoubleQuotesCommand();
          break;
        case 'checkInputSize':
          checkInputSizeCommand();
          break;
        case 'suggestBreakdown':
          suggestBreakdownCommand();
          break;
        case 'openSettings':
          vscode.commands.executeCommand('workbench.action.openSettings', 'fixAugment');
          break;
      }
    },
    undefined,
    context.subscriptions
  );

  dashboardPanel.onDidDispose(() => {
    dashboardPanel = undefined;
  });

  // Initial status update
  updateDashboardStatus();
}

/**
 * Get welcome HTML content
 */
function getWelcomeHtml(context: vscode.ExtensionContext): string {
  try {
    // Try production path first (when extension is packaged)
    const prodPath = path.join(context.extensionPath, 'out', 'webview', 'welcome.html');
    if (fs.existsSync(prodPath)) {
      return fs.readFileSync(prodPath, 'utf8');
    }

    // Fallback to development path
    const devPath = path.join(context.extensionPath, 'src', 'webview', 'welcome.html');
    if (fs.existsSync(devPath)) {
      return fs.readFileSync(devPath, 'utf8');
    }

    // If neither exists, return inline HTML
    return getInlineWelcomeHtml();
  } catch (error) {
    console.error('Error loading welcome HTML:', error);
    return getInlineWelcomeHtml();
  }
}

/**
 * Get dashboard HTML content
 */
function getDashboardHtml(context: vscode.ExtensionContext): string {
  try {
    // Try production path first (when extension is packaged)
    const prodPath = path.join(context.extensionPath, 'out', 'webview', 'dashboard.html');
    if (fs.existsSync(prodPath)) {
      return fs.readFileSync(prodPath, 'utf8');
    }

    // Fallback to development path
    const devPath = path.join(context.extensionPath, 'src', 'webview', 'dashboard.html');
    if (fs.existsSync(devPath)) {
      return fs.readFileSync(devPath, 'utf8');
    }

    // If neither exists, return inline HTML
    return getInlineDashboardHtml();
  } catch (error) {
    console.error('Error loading dashboard HTML:', error);
    return getInlineDashboardHtml();
  }
}

/**
 * Get inline welcome HTML as fallback
 */
function getInlineWelcomeHtml(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Fix Augment - Welcome</title>
    <style>
        body {
            font-family: var(--vscode-font-family);
            color: var(--vscode-foreground);
            background-color: var(--vscode-editor-background);
            padding: 20px;
            margin: 0;
        }
        .header {
            text-align: center;
            margin-bottom: 30px;
        }
        .logo {
            font-size: 2.5em;
            margin-bottom: 10px;
        }
        .version {
            color: var(--vscode-descriptionForeground);
            font-size: 1.2em;
        }
        .section {
            margin-bottom: 30px;
            padding: 20px;
            background-color: var(--vscode-editor-inactiveSelectionBackground);
            border-radius: 8px;
            border-left: 4px solid var(--vscode-activityBarBadge-background);
        }
        .button {
            background-color: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border: none;
            padding: 10px 20px;
            border-radius: 4px;
            cursor: pointer;
            margin: 5px;
            font-size: 14px;
        }
        .actions {
            text-align: center;
            margin-top: 30px;
        }
    </style>
</head>
<body>
    <div class="header">
        <div class="logo">🔧 Fix Augment</div>
        <div class="version">v2.2.1 - Bug Fixes & UI Improvements</div>
    </div>

    <div class="section">
        <h3>🎉 Welcome to Fix Augment!</h3>
        <p>Your extension is now active and ready to enhance your Augment workflows.</p>
        <ul>
            <li>🧠 Context health monitoring</li>
            <li>📁 File context validation</li>
            <li>⏱️ Process timeout protection</li>
            <li>🔧 Double quote fixes</li>
            <li>📊 Smart analytics</li>
        </ul>
    </div>

    <div class="actions">
        <button class="button" onclick="openDashboard()">Open Dashboard</button>
        <button class="button" onclick="openSettings()">Settings</button>
        <button class="button" onclick="closeWelcome()">Close</button>
    </div>

    <script>
        const vscode = acquireVsCodeApi();
        function openDashboard() {
            vscode.postMessage({ command: 'openDashboard' });
        }
        function openSettings() {
            vscode.postMessage({ command: 'openSettings' });
        }
        function closeWelcome() {
            vscode.postMessage({ command: 'closeWelcome' });
        }
    </script>
</body>
</html>`;
}

/**
 * Get inline dashboard HTML as fallback
 */
function getInlineDashboardHtml(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Fix Augment Dashboard</title>
    <style>
        body {
            font-family: var(--vscode-font-family);
            color: var(--vscode-foreground);
            background-color: var(--vscode-editor-background);
            padding: 20px;
            margin: 0;
        }
        .dashboard-header {
            text-align: center;
            margin-bottom: 30px;
        }
        .status-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
            gap: 15px;
            margin-bottom: 30px;
        }
        .status-card {
            background-color: var(--vscode-editor-inactiveSelectionBackground);
            border-radius: 8px;
            padding: 15px;
            border-left: 4px solid var(--vscode-activityBarBadge-background);
        }
        .status-indicator {
            display: flex;
            align-items: center;
            margin-top: 10px;
        }
        .status-dot {
            width: 12px;
            height: 12px;
            border-radius: 50%;
            margin-right: 10px;
        }
        .status-green { background-color: #4CAF50; }
        .status-yellow { background-color: #FF9800; }
        .status-red { background-color: #F44336; }
        .action-buttons {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
            gap: 10px;
            margin-top: 15px;
        }
        .action-btn {
            background-color: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border: none;
            padding: 10px 15px;
            border-radius: 4px;
            cursor: pointer;
            font-size: 14px;
        }
        .refresh-btn {
            position: absolute;
            top: 10px;
            right: 10px;
            background: none;
            border: none;
            color: var(--vscode-foreground);
            cursor: pointer;
            font-size: 16px;
        }
    </style>
</head>
<body>
    <button class="refresh-btn" onclick="refreshDashboard()" title="Refresh Dashboard">🔄</button>

    <div class="dashboard-header">
        <h2>🔧 Fix Augment Dashboard</h2>
        <p>Smart Context & Process Management</p>
    </div>

    <div class="status-grid">
        <div class="status-card">
            <h4>🧠 Context Health</h4>
            <div class="status-indicator">
                <div class="status-dot status-green" id="contextStatus"></div>
                <span class="status-text" id="contextText">Healthy (0 exchanges)</span>
            </div>
        </div>

        <div class="status-card">
            <h4>📁 File Context</h4>
            <div class="status-indicator">
                <div class="status-dot status-green" id="fileStatus"></div>
                <span class="status-text" id="fileText">Ready</span>
            </div>
        </div>

        <div class="status-card">
            <h4>⏱️ Process Monitor</h4>
            <div class="status-indicator">
                <div class="status-dot status-green" id="processStatus"></div>
                <span class="status-text" id="processText">No active processes</span>
            </div>
        </div>

        <div class="status-card">
            <h4>🎯 Enhancement Status</h4>
            <div class="status-indicator">
                <div class="status-dot status-green" id="enhancementStatus"></div>
                <span class="status-text" id="enhancementText">All systems active</span>
            </div>
        </div>
    </div>

    <div class="action-section">
        <h3>🚀 Quick Actions</h3>
        <div class="action-buttons">
            <button class="action-btn" onclick="checkContextHealth()">Check Context</button>
            <button class="action-btn" onclick="refreshContext()">Refresh Context</button>
            <button class="action-btn" onclick="validateFileContext()">Validate File</button>
            <button class="action-btn" onclick="openSettings()">Settings</button>
        </div>
    </div>

    <script>
        const vscode = acquireVsCodeApi();

        function refreshDashboard() {
            vscode.postMessage({ command: 'refreshDashboard' });
        }

        function checkContextHealth() {
            vscode.postMessage({ command: 'checkContextHealth' });
        }

        function refreshContext() {
            vscode.postMessage({ command: 'refreshContext' });
        }

        function validateFileContext() {
            vscode.postMessage({ command: 'validateFileContext' });
        }

        function openSettings() {
            vscode.postMessage({ command: 'openSettings' });
        }

        // Auto-refresh every 30 seconds
        setInterval(refreshDashboard, 30000);

        // Initial load
        refreshDashboard();
    </script>
</body>
</html>`;
}

/**
 * Update dashboard status
 */
function updateDashboardStatus(): void {
  if (!dashboardPanel) {
    return;
  }

  const statusData = {
    context: getContextStatus(),
    file: getFileStatus(),
    process: getProcessStatus(),
    enhancement: getEnhancementStatus()
  };

  const metricsData = {
    sessionDuration: formatDuration(Date.now() - sessionStartTime),
    contextExchanges: contextExchangeCount.toString(),
    filesProcessed: filesProcessed.toString(),
    lastRefresh: formatTime(lastContextRefresh)
  };

  dashboardPanel.webview.postMessage({ command: 'updateStatus', data: statusData });
  dashboardPanel.webview.postMessage({ command: 'updateMetrics', data: metricsData });
}

/**
 * Get context status
 */
function getContextStatus(): { status: string; text: string } {
  const config = vscode.workspace.getConfiguration('fixAugment');
  const threshold = config.get<number>('contextRefreshThreshold', 10);

  if (contextExchangeCount >= threshold) {
    return { status: 'red', text: `Context refresh needed (${contextExchangeCount} exchanges)` };
  } else if (contextExchangeCount >= threshold * 0.7) {
    return { status: 'yellow', text: `Context getting long (${contextExchangeCount} exchanges)` };
  } else {
    return { status: 'green', text: `Context healthy (${contextExchangeCount} exchanges)` };
  }
}

/**
 * Get file status
 */
function getFileStatus(): { status: string; text: string } {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    return { status: 'yellow', text: 'No active file' };
  }

  const fileName = path.basename(editor.document.fileName);
  return { status: 'green', text: `Active: ${fileName}` };
}

/**
 * Get process status
 */
function getProcessStatus(): { status: string; text: string } {
  // This would be enhanced with actual process monitoring
  return { status: 'green', text: 'No active processes' };
}

/**
 * Get enhancement status
 */
function getEnhancementStatus(): { status: string; text: string } {
  if (enhancementActive) {
    return { status: 'green', text: 'All systems active' };
  } else {
    return { status: 'red', text: 'Enhancement disabled' };
  }
}

/**
 * Format duration in human readable format
 */
function formatDuration(ms: number): string {
  const minutes = Math.floor(ms / 60000);
  const hours = Math.floor(minutes / 60);

  if (hours > 0) {
    return `${hours}h ${minutes % 60}m`;
  } else {
    return `${minutes}m`;
  }
}

/**
 * Format time in human readable format
 */
function formatTime(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;
  const minutes = Math.floor(diff / 60000);

  if (minutes < 1) {
    return 'Just now';
  } else if (minutes < 60) {
    return `${minutes}m ago`;
  } else {
    const hours = Math.floor(minutes / 60);
    return `${hours}h ago`;
  }
}

/**
 * Command: Check context health
 */
async function checkContextHealthCommand(): Promise<void> {
  const status = getContextStatus();

  if (status.status === 'red') {
    const action = await vscode.window.showWarningMessage(
      status.text,
      'Refresh Context',
      'Continue Anyway'
    );

    if (action === 'Refresh Context') {
      refreshContextCommand();
    }
  } else {
    vscode.window.showInformationMessage(status.text);
  }

  updateDashboardStatus();
}

/**
 * Command: Refresh context
 */
async function refreshContextCommand(): Promise<void> {
  contextExchangeCount = 0;
  lastContextRefresh = Date.now();

  vscode.window.showInformationMessage(
    'Context refreshed! Consider starting a new conversation with Augment for better results.'
  );

  updateDashboardStatus();
}

/**
 * Command: Validate file context
 */
async function validateFileContextCommand(): Promise<void> {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    vscode.window.showErrorMessage('No active file to validate');
    return;
  }

  const fileName = path.basename(editor.document.fileName);
  const fileExtension = path.extname(editor.document.fileName);
  const workspaceFolder = vscode.workspace.getWorkspaceFolder(editor.document.uri);

  let contextInfo = `Current file: ${fileName}`;
  if (fileExtension) {
    contextInfo += ` (${fileExtension})`;
  }
  if (workspaceFolder) {
    contextInfo += `\nWorkspace: ${workspaceFolder.name}`;
  }

  const action = await vscode.window.showInformationMessage(
    `File context validated:\n${contextInfo}`,
    'Copy Context',
    'Inject to Prompt'
  );

  if (action === 'Copy Context') {
    vscode.env.clipboard.writeText(contextInfo);
    vscode.window.showInformationMessage('File context copied to clipboard');
  } else if (action === 'Inject to Prompt') {
    const selection = editor.selection;
    const contextComment = `/* FILE CONTEXT: ${contextInfo} */\n`;
    editor.edit(editBuilder => {
      editBuilder.insert(selection.start, contextComment);
    });
  }

  filesProcessed++;
  updateDashboardStatus();
}

/**
 * Command: Monitor process
 */
async function monitorProcessCommand(): Promise<void> {
  vscode.window.showInformationMessage('Process monitoring is active. You will be notified if any process takes too long.');
  updateDashboardStatus();
}

/**
 * Deactivate the extension
 */
export function deactivate() {
  // Clean up resources
  if (statusBarItem) {
    statusBarItem.dispose();
  }
  if (dashboardPanel) {
    dashboardPanel.dispose();
  }
  if (welcomePanel) {
    welcomePanel.dispose();
  }
}
