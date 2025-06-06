#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { promisify } = require('util');

// 颜色输出辅助函数
const colors = {
    reset: '\x1b[0m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    magenta: '\x1b[35m',
    cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
    console.log(`${colors[color]}${message}${colors.reset}`);
}

function logStep(step, description) {
    log(`\n[步骤 ${step}] ${description}`, 'cyan');
}

function logSuccess(message) {
    log(`✅ ${message}`, 'green');
}

function logError(message) {
    log(`❌ ${message}`, 'red');
}

function logWarning(message) {
    log(`⚠️  ${message}`, 'yellow');
}

// 执行命令并处理错误
function execCommand(command, options = {}) {
    try {
        log(`执行命令: ${command}`, 'blue');
        const result = execSync(command, {
            encoding: 'utf8',
            stdio: options.silent ? 'pipe' : 'inherit',
            ...options
        });
        return result;
    } catch (error) {
        logError(`命令执行失败: ${command}`);
        logError(`错误: ${error.message}`);
        throw error;
    }
}

// 读取package.json
function readPackageJson() {
    try {
        const packagePath = path.join(process.cwd(), 'package.json');
        const packageContent = fs.readFileSync(packagePath, 'utf8');
        return JSON.parse(packageContent);
    } catch (error) {
        logError('无法读取package.json文件');
        throw error;
    }
}

// 写入package.json
function writePackageJson(packageData) {
    try {
        const packagePath = path.join(process.cwd(), 'package.json');
        fs.writeFileSync(packagePath, JSON.stringify(packageData, null, 2) + '\n');
        logSuccess('package.json已更新');
    } catch (error) {
        logError('无法写入package.json文件');
        throw error;
    }
}

// 版本递增函数
function incrementVersion(version, type = 'patch') {
    const parts = version.split('.').map(num => parseInt(num));
    
    switch (type) {
        case 'major':
            parts[0]++;
            parts[1] = 0;
            parts[2] = 0;
            break;
        case 'minor':
            parts[1]++;
            parts[2] = 0;
            break;
        case 'patch':
        default:
            parts[2]++;
            break;
    }
    
    return parts.join('.');
}

// 清理构建文件
function cleanBuild() {
    logStep(1, '清理构建文件');
    
    const dirsToClean = ['out', 'dist'];
    
    dirsToClean.forEach(dir => {
        if (fs.existsSync(dir)) {
            try {
                execCommand(`rm -rf ${dir}`, { silent: true });
                logSuccess(`已清理目录: ${dir}`);
            } catch (error) {
                logWarning(`清理目录失败: ${dir}`);
            }
        }
    });
}

// 安装依赖
function installDependencies() {
    logStep(2, '安装依赖包');
    
    try {
        execCommand('npm ci');
        logSuccess('依赖包安装完成');
    } catch (error) {
        logWarning('npm ci失败，尝试使用npm install');
        try {
            execCommand('npm install');
            logSuccess('依赖包安装完成');
        } catch (installError) {
            logError('依赖包安装失败');
            throw installError;
        }
    }
}

// 运行代码检查
function runLint() {
    logStep(3, '运行代码检查');
    
    try {
        execCommand('npm run lint');
        logSuccess('代码检查通过');
    } catch (error) {
        logWarning('代码检查发现问题，但继续构建');
    }
}

// 编译TypeScript
function compileTypeScript() {
    logStep(4, '编译TypeScript代码');
    
    try {
        execCommand('npm run compile');
        logSuccess('TypeScript编译完成');
    } catch (error) {
        logError('TypeScript编译失败');
        throw error;
    }
}

// 复制静态资源
function copyStaticAssets() {
    logStep(5, '复制静态资源');
    
    try {
        execCommand('npm run copy-webview');
        logSuccess('静态资源复制完成');
    } catch (error) {
        logWarning('静态资源复制失败，但继续构建');
    }
}

// 运行测试
function runTests(skipTests = false) {
    if (skipTests) {
        logWarning('跳过测试');
        return;
    }
    
    logStep(6, '运行测试');
    
    try {
        execCommand('npm test');
        logSuccess('测试通过');
    } catch (error) {
        logWarning('测试失败，但继续构建');
    }
}

// 打包扩展
function packageExtension(outputDir = './packages') {
    logStep(7, '打包VS Code扩展');
    
    // 确保输出目录存在
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
        logSuccess(`创建输出目录: ${outputDir}`);
    }
    
    const packageData = readPackageJson();
    const extensionName = packageData.name;
    const version = packageData.version;
    const outputFile = path.join(outputDir, `${extensionName}-${version}.vsix`);
    
    try {
        execCommand(`vsce package --out "${outputFile}"`);
        logSuccess(`扩展打包完成: ${outputFile}`);
        
        // 显示文件信息
        const stats = fs.statSync(outputFile);
        const sizeInMB = (stats.size / (1024 * 1024)).toFixed(2);
        log(`文件大小: ${sizeInMB} MB`);
        
        return outputFile;
    } catch (error) {
        logError('扩展打包失败');
        throw error;
    }
}

// 主函数
async function main() {
    const args = process.argv.slice(2);
    const options = {
        skipTests: args.includes('--skip-tests'),
        skipLint: args.includes('--skip-lint'),
        outputDir: args.find(arg => arg.startsWith('--output='))?.replace('--output=', '') || './packages',
        versionType: args.find(arg => arg.startsWith('--version='))?.replace('--version=', '') || null,
        publish: args.includes('--publish')
    };
    
    log('🚀 开始构建VS Code扩展', 'magenta');
    log(`项目: Fix Augment`, 'blue');
    log(`时间: ${new Date().toLocaleString()}`, 'blue');
    
    try {
        // 版本管理
        if (options.versionType) {
            logStep(0, `更新版本 (${options.versionType})`);
            const packageData = readPackageJson();
            const oldVersion = packageData.version;
            const newVersion = incrementVersion(oldVersion, options.versionType);
            packageData.version = newVersion;
            writePackageJson(packageData);
            logSuccess(`版本已从 ${oldVersion} 更新到 ${newVersion}`);
        }
        
        // 构建步骤
        cleanBuild();
        installDependencies();
        
        if (!options.skipLint) {
            runLint();
        }
        
        compileTypeScript();
        copyStaticAssets();
        runTests(options.skipTests);
        
        const outputFile = packageExtension(options.outputDir);
        
        // 发布到市场
        if (options.publish) {
            logStep(8, '发布到VS Code市场');
            try {
                execCommand('vsce publish');
                logSuccess('扩展已发布到VS Code市场');
            } catch (error) {
                logError('发布失败');
                throw error;
            }
        }
        
        log('\n🎉 构建完成!', 'green');
        log(`输出文件: ${outputFile}`, 'cyan');
        
        if (options.publish) {
            log('✅ 扩展已发布到VS Code市场', 'green');
        }
        
    } catch (error) {
        log('\n💥 构建失败!', 'red');
        logError(error.message);
        process.exit(1);
    }
}

// 显示帮助信息
function showHelp() {
    console.log(`
Fix Augment VS Code扩展打包工具

用法:
  node build-vsix.js [选项]

选项:
  --skip-tests          跳过测试
  --skip-lint           跳过代码检查
  --output=<目录>       指定输出目录 (默认: ./packages)
  --version=<类型>      更新版本 (patch|minor|major)
  --publish             构建后发布到VS Code市场
  --help                显示此帮助信息

示例:
  node build-vsix.js                           # 基本构建
  node build-vsix.js --skip-tests              # 跳过测试
  node build-vsix.js --version=minor           # 更新次版本号并构建
  node build-vsix.js --publish                 # 构建并发布
  node build-vsix.js --output=./dist           # 指定输出目录
`);
}

// 入口点
const args = process.argv.slice(2);
if (args.includes('--help') || args.includes('-h')) {
    showHelp();
} else {
    main();
} 