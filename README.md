# Fix Augment

An enhanced unofficial extension for the Augment VSCode extension by Romy Rianata. This extension significantly improves the input and output capabilities of the Augment extension, allowing for larger inputs, better formatted outputs, and a more seamless experience.

## Features

- **Enhanced Input Processing**: Automatically chunks large inputs to make them more digestible for Augment
- **Smart Chunking**: Preserves context and code blocks when splitting large inputs
- **Improved Output Formatting**: Formats Augment's output with better code highlighting and organization
- **Syntax Detection**: Automatically detects and applies the correct language syntax highlighting
- **Multiple Syntax Themes**: Choose from various syntax highlighting themes
- **Auto-Formatting**: Automatically formats Augment outputs as they appear
- **Code Block Optimization**: Special handling for code blocks to maintain their structure
- **API Key Management**: Securely store and manage your Augment API key (for future use - Augment currently doesn't require an API key)
- **Usage Limit Bypass**: Features to help manage and bypass potential future Augment usage limits (Augment currently has unlimited usage)
- **Usage Tracking**: Monitor your Augment usage with a convenient status bar counter (for informational purposes)
- **Auto-Reset**: Automatically reset usage counters to avoid potential future limits
- **Highly Customizable**: Configure all aspects of the extension to suit your workflow

## Requirements

- Visual Studio Code 1.99.0 or higher
- Augment extension (augment.vscode-augment)

## Extension Settings

This extension contributes the following settings:

- `fixAugment.enabled`: Enable or disable the Fix Augment extension
- `fixAugment.maxInputSize`: Maximum size of input to process at once (in characters)
- `fixAugment.outputFormat`: Format to use for Augment outputs (default, enhanced, markdown, html)
- `fixAugment.autoFormatOutput`: Automatically format Augment outputs as they appear
- `fixAugment.syntaxTheme`: Syntax highlighting theme for code blocks (default, github, monokai, dracula, nord)
- `fixAugment.smartChunking`: Use smart chunking to preserve context when splitting large inputs
- `fixAugment.preserveCodeBlocks`: Keep code blocks intact when chunking large inputs
- `fixAugment.apiKey`: API key for Augment (for future use - Augment currently doesn't require an API key)
- `fixAugment.bypassLimits`: Enable features to bypass potential future Augment usage limits (Augment currently has unlimited usage)
- `fixAugment.requestDelay`: Delay between requests in milliseconds (for future use - to avoid potential rate limiting)
- `fixAugment.maxRequestsPerSession`: Maximum number of requests per session before auto-reset (for future use)

## Known Issues

- The extension may not detect all Augment outputs automatically
- Some syntax highlighting may not be accurate for all languages

## Release Notes

### 1.1.0

- Added API key management with secure storage
- Added usage limit bypass features
- Added usage tracking with status bar indicator
- Added auto-reset functionality to avoid hitting limits
- Added request delay to prevent rate limiting
- Improved extension stability and performance

### 1.0.0

- Major update to version 1.0.0
- Fixed highlight.js TypeScript integration
- Improved extension activation - now automatically enabled on installation
- Enhanced performance and reliability
- Streamlined user interface
- Better error handling and diagnostics

### 0.0.5

- Added smart chunking to preserve context in large inputs
- Added multiple syntax highlighting themes
- Added automatic output formatting
- Added code block optimization
- Fixed highlight.js integration
- Improved overall performance and reliability

### 0.0.1

- Initial release
- Basic input enhancement and output formatting
- Automatic chunking of large inputs
- Syntax highlighting for common languages

## How to Use

1. Install the extension
2. Make sure you have the official Augment extension installed
3. Select text in your editor
4. Right-click and choose "Augment: Enhance Input" to optimize it for Augment
5. After receiving output from Augment, select it and use "Augment: Format Output" to improve its formatting

## Commands

- **Augment: Enhance Input**: Process selected text to optimize it for Augment
- **Augment: Format Output**: Format selected Augment output for better readability
- **Augment: Toggle Enhancement**: Turn the extension on or off
- **Augment: Smart Chunk Large Input**: Intelligently split large inputs while preserving context
- **Augment: Apply Syntax Theme**: Change the syntax highlighting theme for code blocks
- **Augment: Optimize Code Blocks**: Improve formatting of code blocks in the selection
- **Augment: Set API Key**: Securely store your Augment API key
- **Augment: Toggle Limit Bypass**: Enable or disable the limit bypass features
- **Augment: Reset Usage Counter**: Manually reset the usage counter

## About the Author

This extension is developed and maintained by MrXploisLite. For support, feature requests, or bug reports, please visit the [GitHub repository](https://github.com/MrXploisLite/fix-augment).

**Enjoy using Fix Augment!**
