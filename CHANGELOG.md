# Change Log

All notable changes to the "fix-augment" extension will be documented in this file.

Check [Keep a Changelog](http://keepachangelog.com/) for recommendations on how to structure this file.

## [2.0.0] - 2025-01-28

### Added
- Agent workflow enhancement with context injection
- Next Edit context optimization for better suggestions
- Instructions formatting for improved clarity
- Enhanced integration with Augment's 2025 feature set
- Support for Agent, Chat, Next Edit, Instructions, and Completions
- Modern output detection for current Augment formats
- Workspace and file context injection for Agent workflows

### Changed
- Complete modernization for Augment's current capabilities
- Updated output detection patterns for 2025 Augment formats
- Streamlined user interface focused on current features
- Enhanced performance and reliability
- Updated documentation to reflect current Augment capabilities

### Removed
- Obsolete usage tracking and limit bypass features (no longer needed)
- API key management (Augment doesn't require API keys)
- Usage counters and auto-reset functionality
- Limit bypass status bar items

### Fixed
- Improved integration with modern Augment extension
- Better error handling and user feedback
- Enhanced code formatting and syntax detection

## [1.1.1] - 2024-07-17

### Changed

- Clarified that API key management is for future use (Augment currently doesn't require an API key)
- Updated limit bypass features to indicate they're for potential future use
- Improved UI messages to avoid confusion about API keys and usage limits
- Updated documentation to reflect that Augment currently has unlimited usage

## [1.1.0] - 2024-07-16

### Added

- API key management with secure storage
- Usage limit bypass features
- Usage tracking with status bar indicator
- Auto-reset functionality to avoid hitting limits
- Request delay to prevent rate limiting
- New commands for managing API keys and limits

### Changed

- Updated version to 1.1.0
- Improved extension stability and performance
- Enhanced user interface with status indicators

### Fixed

- Fixed issues with extension context access
- Improved error handling for API operations

## [1.0.0] - 2024-07-15

### Added

- Automatic activation on installation
- Improved error handling and diagnostics
- Better performance optimizations

### Changed

- Updated extension name to "Fix Augment"
- Updated version to 1.0.0
- Fixed highlight.js TypeScript integration
- Enhanced user interface

### Fixed

- Fixed TypeScript error with highlight.js module
- Improved error handling in syntax highlighting

## [0.0.5] - 2024-07-01

### Added

- Smart chunking feature to preserve context in large inputs
- Multiple syntax highlighting themes (default, github, monokai, dracula, nord)
- Automatic output formatting
- Code block optimization
- New commands:
  - Smart Chunk Large Input
  - Apply Syntax Theme
  - Optimize Code Blocks
- New configuration options:
  - autoFormatOutput
  - syntaxTheme
  - smartChunking
  - preserveCodeBlocks

### Changed

- Updated extension configuration
- Improved README with more detailed information
- Fixed highlight.js integration

### Fixed

- Fixed TypeScript error with highlight.js module
- Improved error handling in syntax highlighting

## [0.0.1] - 2024-06-15

### Initial Release

- Basic input enhancement and output formatting
- Automatic chunking of large inputs
- Syntax highlighting for common languages
