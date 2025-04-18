import * as vscode from 'vscode';
import * as marked from 'marked';
import hljs from 'highlight.js';

// Status bar items
let statusBarItem: vscode.StatusBarItem;
let limitBypassStatusBarItem: vscode.StatusBarItem;
let usageCounterStatusBarItem: vscode.StatusBarItem;

// Flags to track extension state
let enhancementActive = true;
let limitBypassActive = false;

// Usage tracking
let requestCounter = 0;
let sessionStartTime = Date.now();

// Interface for the Augment extension API (if we can access it)
interface AugmentExtension {
  sendInput?: (input: string) => Promise<string>;
  formatOutput?: (output: string) => string;
}

/**
 * Activate the extension
 */
// Store the extension context for later use
let extensionContext: vscode.ExtensionContext;

export function activate(context: vscode.ExtensionContext) {
  // Store the context
  extensionContext = context;
  console.log('Fix Augment extension is now active!');

  // Initialize usage counter
  requestCounter = context.globalState.get('requestCounter', 0);
  sessionStartTime = context.globalState.get('sessionStartTime', Date.now());

  // Load limit bypass state
  limitBypassActive = context.globalState.get('limitBypassActive', false);

  // Create main status bar item
  statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
  statusBarItem.text = '$(megaphone) Augment Fix: ON';
  statusBarItem.tooltip = 'Fix Augment is active. Click to toggle.';
  statusBarItem.command = 'fix-augment.toggleEnhancement';
  statusBarItem.show();
  context.subscriptions.push(statusBarItem);

  // Create limit bypass status bar item
  limitBypassStatusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 99);
  updateLimitBypassStatusBar();
  limitBypassStatusBarItem.show();
  context.subscriptions.push(limitBypassStatusBarItem);

  // Create usage counter status bar item
  usageCounterStatusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 98);
  updateUsageCounterStatusBar();
  usageCounterStatusBarItem.show();
  context.subscriptions.push(usageCounterStatusBarItem);

  // Register commands
  context.subscriptions.push(
    vscode.commands.registerCommand('fix-augment.enhanceInput', enhanceInput),
    vscode.commands.registerCommand('fix-augment.formatOutput', formatOutput),
    vscode.commands.registerCommand('fix-augment.toggleEnhancement', toggleEnhancement),
    vscode.commands.registerCommand('fix-augment.smartChunk', smartChunkInput),
    vscode.commands.registerCommand('fix-augment.applyTheme', applyTheme),
    vscode.commands.registerCommand('fix-augment.optimizeCodeBlocks', optimizeCodeBlocks),
    vscode.commands.registerCommand('fix-augment.setApiKey', setApiKey),
    vscode.commands.registerCommand('fix-augment.toggleLimitBypass', toggleLimitBypass),
    vscode.commands.registerCommand('fix-augment.resetUsageCounter', resetUsageCounter)
  );

  // Listen for text document changes to intercept Augment output
  context.subscriptions.push(
    vscode.workspace.onDidChangeTextDocument(handleTextDocumentChange)
  );

  // Try to find the Augment extension
  checkForAugmentExtension();

  // Check if we need to auto-reset the counter
  checkAndResetCounter(context);
}

/**
 * Check if the Augment extension is installed and available
 */
async function checkForAugmentExtension(): Promise<AugmentExtension | undefined> {
  const augmentExtension = vscode.extensions.getExtension('augment.vscode-augment');

  if (augmentExtension) {
    vscode.window.showInformationMessage('Augment extension detected. Fix Augment is ready!');

    // Note: We no longer prompt for API key by default since Augment currently doesn't require one
    // The API key setting is still available for future use when Augment might require it

    return augmentExtension.exports as AugmentExtension;
  } else {
    vscode.window.showWarningMessage('Augment extension not found. Some features may not work properly.');
    return undefined;
  }
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

  // Look for patterns that might indicate Augment output
  const text = changes[0].text;
  if (text.includes('```') || text.includes('function_results') || text.includes('augment')) {
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

    // Check if this is an Augment response and increment the counter
    if (text.includes('function_results') ||
        (text.includes('```') && text.includes('augment')) ||
        text.includes('<augment_code_snippet')) {
      // This is likely an Augment response
      incrementUsageCounter();

      // If limit bypass is active, check if we need to add a delay
      if (limitBypassActive) {
        const config = vscode.workspace.getConfiguration('fixAugment');
        const requestDelay = config.get<number>('requestDelay') || 500;

        // Add a small delay to avoid rate limiting
        if (requestDelay > 0) {
          await new Promise(resolve => setTimeout(resolve, requestDelay));
        }
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
      }, async (progress, token) => {
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
    vscode.window.showInformationMessage('Fix Augment is now active');
  } else {
    statusBarItem.text = '$(megaphone) Augment Fix: OFF';
    statusBarItem.tooltip = 'Fix Augment is inactive. Click to toggle.';
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
    enhanced = enhanced.replace(/```(\w+)?\s*([\s\S]*?)```/g, (match, language, code) => {
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
    enhanced = enhanced.replace(/<function_results>(([\s\S]*?))<\/function_results>/g, (match, content) => {
      return `<details>\n<summary>Function Results</summary>\n\n\`\`\`\n${content.trim()}\n\`\`\`\n</details>\n`;
    });

    // Add proper XML tags for code snippets
    enhanced = enhanced.replace(/<augment_code_snippet([^>]*)>([\s\S]*?)<\/augment_code_snippet>/g, (match, attrs, content) => {
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
    }, async (progress, token) => {
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
    const optimized = text.replace(/```(\w+)?\s*([\s\S]*?)```/g, (match, language, code) => {
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
 * Set the API key for Augment
 */
async function setApiKey(): Promise<void> {
  // Get the current API key from secure storage
  const config = vscode.workspace.getConfiguration('fixAugment');
  const currentApiKey = config.get<string>('apiKey') || '';

  // Show information about API key usage
  await vscode.window.showInformationMessage(
    'Note: Augment currently does not require an API key. This feature is for future use when Augment might require authentication.'
  );

  // Prompt for the new API key
  const apiKey = await vscode.window.showInputBox({
    prompt: 'Enter your Augment API key (for future use)',
    placeHolder: 'API key (optional)',
    password: true,
    value: currentApiKey
  });

  if (apiKey === undefined) {
    // User cancelled
    return;
  }

  if (apiKey) {
    // Store the API key in settings
    try {
      await config.update('apiKey', apiKey, vscode.ConfigurationTarget.Global);
      vscode.window.showInformationMessage('Augment API key saved successfully');
    } catch (error) {
      vscode.window.showErrorMessage(`Error saving API key: ${error}`);
    }
  } else {
    // Clear the API key if empty
    try {
      await config.update('apiKey', '', vscode.ConfigurationTarget.Global);
      vscode.window.showInformationMessage('Augment API key cleared');
    } catch (error) {
      vscode.window.showErrorMessage(`Error clearing API key: ${error}`);
    }
  }
}

/**
 * Toggle the limit bypass feature
 */
function toggleLimitBypass(): void {
  const context = getExtensionContext();
  if (!context) {
    vscode.window.showErrorMessage('Could not access extension context');
    return;
  }

  // Show information about limit bypass
  if (!limitBypassActive) {
    vscode.window.showInformationMessage(
      'Note: Augment currently does not have usage limits. This feature is for future use when Augment might implement limits.'
    );
  }

  limitBypassActive = !limitBypassActive;
  context.globalState.update('limitBypassActive', limitBypassActive);

  updateLimitBypassStatusBar();

  if (limitBypassActive) {
    vscode.window.showInformationMessage('Augment limit bypass is now active (for future use)');
  } else {
    vscode.window.showInformationMessage('Augment limit bypass is now inactive');
  }
}

/**
 * Update the limit bypass status bar item
 */
function updateLimitBypassStatusBar(): void {
  if (limitBypassActive) {
    limitBypassStatusBarItem.text = '$(zap) Limits: BYPASS (Future)';
    limitBypassStatusBarItem.tooltip = 'Augment limit bypass is active (for future use). Click to toggle.';
    limitBypassStatusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
  } else {
    limitBypassStatusBarItem.text = '$(zap) Limits: NORMAL';
    limitBypassStatusBarItem.tooltip = 'Augment limit bypass is inactive (for future use). Click to toggle.';
    limitBypassStatusBarItem.backgroundColor = undefined;
  }
  limitBypassStatusBarItem.command = 'fix-augment.toggleLimitBypass';
}

/**
 * Reset the usage counter
 */
function resetUsageCounter(): void {
  const context = getExtensionContext();
  if (!context) {
    vscode.window.showErrorMessage('Could not access extension context');
    return;
  }

  requestCounter = 0;
  sessionStartTime = Date.now();

  context.globalState.update('requestCounter', requestCounter);
  context.globalState.update('sessionStartTime', sessionStartTime);

  updateUsageCounterStatusBar();

  vscode.window.showInformationMessage('Augment usage counter reset');
}

/**
 * Update the usage counter status bar item
 */
function updateUsageCounterStatusBar(): void {
  const config = vscode.workspace.getConfiguration('fixAugment');
  const maxRequests = config.get<number>('maxRequestsPerSession') || 50;

  usageCounterStatusBarItem.text = `$(graph) Usage: ${requestCounter}/${maxRequests}`;
  usageCounterStatusBarItem.tooltip = 'Augment usage counter. Click to reset.';
  usageCounterStatusBarItem.command = 'fix-augment.resetUsageCounter';

  // Change color when approaching the limit
  if (requestCounter >= maxRequests * 0.8) {
    usageCounterStatusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.errorBackground');
  } else if (requestCounter >= maxRequests * 0.5) {
    usageCounterStatusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
  } else {
    usageCounterStatusBarItem.backgroundColor = undefined;
  }
}

/**
 * Increment the usage counter
 */
function incrementUsageCounter(): void {
  const context = getExtensionContext();
  if (!context) {
    return;
  }

  requestCounter++;
  context.globalState.update('requestCounter', requestCounter);

  updateUsageCounterStatusBar();

  // Check if we need to auto-reset
  checkAndResetCounter(context);
}

/**
 * Check if we need to auto-reset the counter based on max requests
 */
function checkAndResetCounter(context: vscode.ExtensionContext): void {
  const config = vscode.workspace.getConfiguration('fixAugment');
  const maxRequests = config.get<number>('maxRequestsPerSession') || 50;

  // Auto-reset if we've reached the limit
  if (requestCounter >= maxRequests && limitBypassActive) {
    requestCounter = 0;
    sessionStartTime = Date.now();

    context.globalState.update('requestCounter', requestCounter);
    context.globalState.update('sessionStartTime', sessionStartTime);

    updateUsageCounterStatusBar();

    vscode.window.showInformationMessage('Augment usage counter auto-reset (limit reached)');
  }

  // Also check time-based reset (24 hours)
  const oneDayMs = 24 * 60 * 60 * 1000;
  if (Date.now() - sessionStartTime > oneDayMs) {
    requestCounter = 0;
    sessionStartTime = Date.now();

    context.globalState.update('requestCounter', requestCounter);
    context.globalState.update('sessionStartTime', sessionStartTime);

    updateUsageCounterStatusBar();
  }
}

/**
 * Get the extension context
 */
function getExtensionContext(): vscode.ExtensionContext | undefined {
  return extensionContext;
}

/**
 * Deactivate the extension
 */
export function deactivate() {
  // Clean up resources
  if (statusBarItem) {
    statusBarItem.dispose();
  }
  if (limitBypassStatusBarItem) {
    limitBypassStatusBarItem.dispose();
  }
  if (usageCounterStatusBarItem) {
    usageCounterStatusBarItem.dispose();
  }
}
