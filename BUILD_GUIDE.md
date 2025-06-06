# Fix Augment VS Code扩展构建指南

本文档说明如何使用提供的脚本来构建和打包Fix Augment VS Code扩展。

## 🚀 快速开始

### 基本打包
```bash
# 使用Node.js脚本 (推荐)
node build-vsix.js

# 使用Shell脚本 (macOS/Linux)
./build-vsix.sh

# 使用批处理脚本 (Windows)
build-vsix.bat

# 使用npm script
npm run build:vsix
```

## 📋 可用脚本

### 1. Node.js主脚本 (`build-vsix.js`)
这是核心的打包脚本，提供完整的构建流程：

```bash
# 基本构建
node build-vsix.js

# 快速构建（跳过测试和代码检查）
node build-vsix.js --skip-tests --skip-lint

# 指定输出目录
node build-vsix.js --output=./dist

# 更新版本并构建
node build-vsix.js --version=patch   # 2.2.5 -> 2.2.6
node build-vsix.js --version=minor   # 2.2.5 -> 2.3.0
node build-vsix.js --version=major   # 2.2.5 -> 3.0.0

# 构建并发布到VS Code市场
node build-vsix.js --publish

# 显示帮助信息
node build-vsix.js --help
```

### 2. Shell脚本 (`build-vsix.sh`) - macOS/Linux
跨平台兼容的Shell包装器：

```bash
# 基本构建
./build-vsix.sh

# 快速构建
./build-vsix.sh -q

# 更新版本
./build-vsix.sh -v minor

# 构建并发布
./build-vsix.sh -p

# 自定义输出目录
./build-vsix.sh -o ./dist

# 显示帮助
./build-vsix.sh -h
```

### 3. 批处理脚本 (`build-vsix.bat`) - Windows
Windows系统的批处理包装器：

```batch
REM 基本构建
build-vsix.bat

REM 快速构建
build-vsix.bat -q

REM 更新版本
build-vsix.bat -v minor

REM 构建并发布
build-vsix.bat -p

REM 显示帮助
build-vsix.bat -h
```

### 4. NPM Scripts
在package.json中预定义的便捷脚本：

```bash
npm run build:vsix      # 基本构建
npm run build:quick     # 快速构建
npm run build:patch     # 更新补丁版本
npm run build:minor     # 更新次版本
npm run build:major     # 更新主版本
npm run build:publish   # 构建并发布
```

## 🛠️ 构建流程

所有脚本都执行以下标准化构建流程：

1. **清理构建文件** - 删除`out`和`dist`目录
2. **安装依赖包** - 运行`npm ci`或`npm install`
3. **代码检查** - 运行ESLint（可跳过）
4. **编译TypeScript** - 将TypeScript编译为JavaScript
5. **复制静态资源** - 复制webview相关文件
6. **运行测试** - 执行单元测试（可跳过）
7. **打包扩展** - 使用vsce创建.vsix文件
8. **可选发布** - 发布到VS Code市场

## 📁 输出结构

默认情况下，构建的.vsix文件会保存在`./packages/`目录下：

```
packages/
└── fix-augment-2.2.5.vsix
```

您可以使用`--output`参数自定义输出目录。

## 🔧 命令行选项

### Node.js脚本选项
- `--skip-tests` - 跳过测试步骤
- `--skip-lint` - 跳过代码检查
- `--output=<目录>` - 指定输出目录
- `--version=<类型>` - 更新版本号（patch/minor/major）
- `--publish` - 构建后发布到VS Code市场
- `--help` - 显示帮助信息

### Shell脚本选项
- `-t, --skip-tests` - 跳过测试
- `-l, --skip-lint` - 跳过代码检查
- `-o, --output <目录>` - 指定输出目录
- `-v, --version <类型>` - 更新版本号
- `-p, --publish` - 构建并发布
- `-q, --quick` - 快速构建（跳过测试和检查）
- `-h, --help` - 显示帮助

## 🔍 环境要求

确保您的系统已安装以下软件：

- **Node.js** (v16+)
- **npm** (随Node.js安装)
- **vsce** (Visual Studio Code Extension工具)

脚本会自动检查并在必要时安装vsce。

## 📝 版本管理

脚本支持自动版本管理：

```bash
# 当前版本: 2.2.5

# 补丁版本（错误修复）
node build-vsix.js --version=patch  # -> 2.2.6

# 次版本（新功能）
node build-vsix.js --version=minor  # -> 2.3.0

# 主版本（重大更改）
node build-vsix.js --version=major  # -> 3.0.0
```

版本更新会自动修改`package.json`文件。

## 🚀 发布流程

要发布扩展到VS Code市场：

1. **配置发布令牌**：
   ```bash
   vsce login <publisher-name>
   ```

2. **构建并发布**：
   ```bash
   node build-vsix.js --publish
   ```

或者分步执行：
```bash
# 先构建
node build-vsix.js

# 再发布
vsce publish
```

## 🐛 故障排除

### 常见问题

1. **vsce未找到**
   - 脚本会自动安装vsce，如失败请手动安装：
   ```bash
   npm install -g vsce
   ```

2. **TypeScript编译失败**
   - 检查TypeScript语法错误
   - 确保所有依赖都已安装

3. **测试失败**
   - 使用`--skip-tests`跳过测试
   - 或修复测试中的问题

4. **权限问题** (macOS/Linux)
   - 为脚本设置执行权限：
   ```bash
   chmod +x build-vsix.sh
   ```

### 日志和调试

脚本提供彩色日志输出，便于识别问题：
- 🔵 信息消息
- 🟢 成功操作
- 🟡 警告信息
- 🔴 错误消息

## 📄 许可证

本构建脚本遵循与Fix Augment扩展相同的许可证。

---

**作者**: 陈鸿斌  
**项目**: Fix Augment VS Code Extension  
**最后更新**: 2024年12月 