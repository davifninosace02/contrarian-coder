# Changelog

All notable changes to the **Contrarian Coder** extension will be documented in this file.

## [1.0.0] - 2026-04-01

### ✨ Added
- **📋 Copy Code button**: Each code suggestion now has a "Copy" button alongside "Apply Code"
- **⌨️ Keyboard shortcut**: `Ctrl+Shift+C` to instantly analyze the current file
- **🖱️ Context menu**: Right-click on selected code → "Analyze with Contrarian Coder"
- **🎨 Theme support**: The panel now adapts to your VS Code theme (light/dark)
- **⏱️ HTTP timeout**: API requests now timeout after 60 seconds with a clear message
- **💾 State persistence**: Analysis results survive panel visibility changes

### 🔧 Fixed
- Removed duplicate functions in webview script that could cause runtime errors
- Fixed implicit `any` type lint errors in `editBuilder` and file map callbacks
- Sanitized JSON injection to prevent XSS from code containing `<script>` tags

### 🧹 Cleaned
- Removed unused React/ReactDOM dependencies (reduced extension size)
- Removed unused `@types/react` and `@types/react-dom` from devDependencies
- Removed `jsx: react-jsx` from tsconfig (not needed without React)
- Updated categories for VS Code Marketplace visibility
- Added bilingual description (EN/ES)
- Added search keywords for discoverability

### 🏗️ Architecture
- Replaced hardcoded CSS colors with VS Code theme CSS variables (`--vscode-*`)
- Added `onDidChangeVisibility` listener to restore state when switching panels
- Centralized state restoration in `_restoreStateToWebview()` method
- Initial analysis state is now embedded directly in HTML for instant rendering
