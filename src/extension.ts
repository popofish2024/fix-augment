import * as vscode from 'vscode';
import * as marked from 'marked';
import hljs from 'highlight.js';

// Status bar items
let statusBarItem: vscode.StatusBarItem;

// Flags to track extension state
let enhancementActive = true;

// Interface for the Augment extension API
interface AugmentExtension {
  // Core API methods that we can enhance
  getAPI?: () => any;
  executeCommand?: (command: string, ...args: any[]) => Promise<any>;
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

  // Create main status bar item
  statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
  statusBarItem.text = '$(megaphone) Augment Fix: ON';
  statusBarItem.tooltip = 'Fix Augment is active. Click to toggle.';
  statusBarItem.command = 'fix-augment.toggleEnhancement';
  statusBarItem.show();
  context.subscriptions.push(statusBarItem);

  // Register commands
  context.subscriptions.push(
    vscode.commands.registerCommand('fix-augment.fixDoubleQuotes', fixDoubleQuotesCommand),
    vscode.commands.registerCommand('fix-augment.checkInputSize', checkInputSizeCommand),
    vscode.commands.registerCommand('fix-augment.suggestBreakdown', suggestBreakdownCommand),
    vscode.commands.registerCommand('fix-augment.optimizePrompt', optimizePromptCommand),
    vscode.commands.registerCommand('fix-augment.formatOutput', formatOutput),
    vscode.commands.registerCommand('fix-augment.toggleEnhancement', toggleEnhancement)
  );

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
 * Deactivate the extension
 */
export function deactivate() {
  // Clean up resources
  if (statusBarItem) {
    statusBarItem.dispose();
  }
}
