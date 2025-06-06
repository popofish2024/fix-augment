@echo off
setlocal EnableDelayedExpansion

REM Fix Augment VS Code扩展打包脚本 (Windows)
REM 作者: 陈鸿斌
REM 用途: 简化VS Code扩展的打包流程

REM 设置脚本目录
set "SCRIPT_DIR=%~dp0"
cd /d "%SCRIPT_DIR%"

REM 定义颜色
set "RED=[91m"
set "GREEN=[92m"
set "YELLOW=[93m"
set "BLUE=[94m"
set "MAGENTA=[95m"
set "CYAN=[96m"
set "NC=[0m"

REM 日志函数
call :log_info "🚀 Fix Augment VS Code扩展打包工具"
call :log_info "==============================================="

REM 检查Node.js
call :check_nodejs
if !errorlevel! neq 0 exit /b 1

REM 检查vsce
call :check_vsce
if !errorlevel! neq 0 exit /b 1

REM 检查必要文件
if not exist "package.json" (
    call :log_error "在当前目录中未找到package.json文件"
    exit /b 1
)

if not exist "build-vsix.js" (
    call :log_error "未找到build-vsix.js脚本文件"
    exit /b 1
)

REM 解析命令行参数
set "args="
set "skip_help=false"

:parse_args
if "%~1"=="" goto :end_parse
if "%~1"=="-h" set "skip_help=true" && goto :show_help
if "%~1"=="--help" set "skip_help=true" && goto :show_help
if "%~1"=="-t" set "args=!args! --skip-tests"
if "%~1"=="--skip-tests" set "args=!args! --skip-tests"
if "%~1"=="-l" set "args=!args! --skip-lint"
if "%~1"=="--skip-lint" set "args=!args! --skip-lint"
if "%~1"=="-o" set "args=!args! --output=%~2" && shift
if "%~1"=="--output" set "args=!args! --output=%~2" && shift
if "%~1"=="-v" set "args=!args! --version=%~2" && shift
if "%~1"=="--version" set "args=!args! --version=%~2" && shift
if "%~1"=="-p" set "args=!args! --publish"
if "%~1"=="--publish" set "args=!args! --publish"
if "%~1"=="-q" set "args=!args! --skip-tests --skip-lint"
if "%~1"=="--quick" set "args=!args! --skip-tests --skip-lint"
shift
goto :parse_args

:end_parse
if "%skip_help%"=="true" goto :show_help

REM 执行Node.js脚本
call :log_info "开始执行打包流程..."
node build-vsix.js !args!

if !errorlevel! equ 0 (
    call :log_success "打包完成！"
    
    REM 显示输出文件
    if exist "packages" (
        call :log_info "生成的文件:"
        dir packages\*.vsix /b 2>nul || call :log_warning "未找到.vsix文件"
    )
) else (
    call :log_error "打包失败，退出代码: !errorlevel!"
    exit /b !errorlevel!
)

goto :eof

REM ============= 函数定义 =============

:log_info
echo %BLUE%ℹ️  %~1%NC%
goto :eof

:log_success
echo %GREEN%✅ %~1%NC%
goto :eof

:log_error
echo %RED%❌ %~1%NC%
goto :eof

:log_warning
echo %YELLOW%⚠️  %~1%NC%
goto :eof

:check_nodejs
where node >nul 2>nul
if !errorlevel! neq 0 (
    call :log_error "Node.js未安装，请先安装Node.js"
    exit /b 1
)

for /f "tokens=*" %%a in ('node --version') do set "node_version=%%a"
call :log_info "Node.js版本: !node_version!"
goto :eof

:check_vsce
where vsce >nul 2>nul
if !errorlevel! neq 0 (
    call :log_warning "vsce未安装，正在安装..."
    npm install -g vsce
    if !errorlevel! equ 0 (
        call :log_success "vsce安装完成"
    ) else (
        call :log_error "vsce安装失败"
        exit /b 1
    )
) else (
    for /f "tokens=*" %%a in ('vsce --version') do set "vsce_version=%%a"
    call :log_info "vsce版本: !vsce_version!"
)
goto :eof

:show_help
echo.
echo Fix Augment VS Code扩展打包脚本
echo.
echo 用法:
echo   build-vsix.bat [选项]
echo.
echo 选项:
echo   -h, --help            显示帮助信息
echo   -t, --skip-tests      跳过测试
echo   -l, --skip-lint       跳过代码检查
echo   -o, --output ^<目录^>   指定输出目录 (默认: ./packages)
echo   -v, --version ^<类型^>  更新版本 (patch^|minor^|major)
echo   -p, --publish         构建后发布到VS Code市场
echo   -q, --quick           快速构建 (跳过测试和代码检查)
echo.
echo 示例:
echo   build-vsix.bat                     # 基本构建
echo   build-vsix.bat -q                  # 快速构建
echo   build-vsix.bat -v minor            # 更新次版本号并构建
echo   build-vsix.bat -p                  # 构建并发布
echo   build-vsix.bat -o ./dist           # 指定输出目录
echo.
goto :eof 