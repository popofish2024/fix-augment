#!/bin/bash

# Fix Augment VS Code扩展打包脚本 (macOS/Linux)
# 作者: 陈鸿斌
# 用途: 简化VS Code扩展的打包流程

set -e

# 脚本目录
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
MAGENTA='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# 日志函数
log() {
    echo -e "${2:-$NC}$1${NC}"
}

log_success() {
    log "✅ $1" "$GREEN"
}

log_error() {
    log "❌ $1" "$RED"
}

log_warning() {
    log "⚠️  $1" "$YELLOW"
}

log_info() {
    log "ℹ️  $1" "$BLUE"
}

# 检查Node.js是否安装
check_nodejs() {
    if ! command -v node &> /dev/null; then
        log_error "Node.js未安装，请先安装Node.js"
        exit 1
    fi
    
    local node_version=$(node --version)
    log_info "Node.js版本: $node_version"
}

# 检查vsce是否安装
check_vsce() {
    if ! command -v vsce &> /dev/null; then
        log_warning "vsce未安装，正在安装..."
        npm install -g vsce
        log_success "vsce安装完成"
    else
        local vsce_version=$(vsce --version)
        log_info "vsce版本: $vsce_version"
    fi
}

# 显示帮助信息
show_help() {
    cat << EOF
Fix Augment VS Code扩展打包脚本

用法:
  ./build-vsix.sh [选项]

选项:
  -h, --help            显示帮助信息
  -t, --skip-tests      跳过测试
  -l, --skip-lint       跳过代码检查
  -o, --output <目录>   指定输出目录 (默认: ./packages)
  -v, --version <类型>  更新版本 (patch|minor|major)
  -p, --publish         构建后发布到VS Code市场
  -q, --quick           快速构建 (跳过测试和代码检查)

示例:
  ./build-vsix.sh                     # 基本构建
  ./build-vsix.sh -q                  # 快速构建
  ./build-vsix.sh -v minor            # 更新次版本号并构建
  ./build-vsix.sh -p                  # 构建并发布
  ./build-vsix.sh -o ./dist           # 指定输出目录

EOF
}

# 主函数
main() {
    local args=()
    
    # 解析命令行参数
    while [[ $# -gt 0 ]]; do
        case $1 in
            -h|--help)
                show_help
                exit 0
                ;;
            -t|--skip-tests)
                args+=(--skip-tests)
                shift
                ;;
            -l|--skip-lint)
                args+=(--skip-lint)
                shift
                ;;
            -o|--output)
                args+=(--output="$2")
                shift 2
                ;;
            -v|--version)
                args+=(--version="$2")
                shift 2
                ;;
            -p|--publish)
                args+=(--publish)
                shift
                ;;
            -q|--quick)
                args+=(--skip-tests --skip-lint)
                shift
                ;;
            *)
                log_error "未知选项: $1"
                show_help
                exit 1
                ;;
        esac
    done
    
    log "🚀 Fix Augment VS Code扩展打包工具" "$MAGENTA"
    log "===============================================" "$CYAN"
    
    # 检查环境
    check_nodejs
    check_vsce
    
    # 进入脚本目录
    cd "$SCRIPT_DIR"
    
    # 检查是否存在package.json
    if [[ ! -f "package.json" ]]; then
        log_error "在当前目录中未找到package.json文件"
        exit 1
    fi
    
    # 检查是否存在build-vsix.js
    if [[ ! -f "build-vsix.js" ]]; then
        log_error "未找到build-vsix.js脚本文件"
        exit 1
    fi
    
    # 执行Node.js脚本
    log_info "开始执行打包流程..."
    node build-vsix.js "${args[@]}"
    
    local exit_code=$?
    
    if [[ $exit_code -eq 0 ]]; then
        log_success "打包完成！"
        
        # 显示输出文件
        if [[ -d "packages" ]]; then
            log_info "生成的文件:"
            ls -la packages/*.vsix 2>/dev/null || log_warning "未找到.vsix文件"
        fi
    else
        log_error "打包失败，退出代码: $exit_code"
        exit $exit_code
    fi
}

# 脚本入口
main "$@" 