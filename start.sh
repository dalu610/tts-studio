#!/bin/bash
# TTS Studio 一键启动脚本

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
BACKEND_DIR="$SCRIPT_DIR/backend"
FRONTEND_DIR="$SCRIPT_DIR/frontend"

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

log() { echo -e "${GREEN}[TTS]${NC} $1"; }
warn() { echo -e "${YELLOW}[TTS]${NC} $1"; }
info() { echo -e "${CYAN}[TTS]${NC} $1"; }
error() { echo -e "${RED}[TTS]${NC} $1"; exit 1; }

echo ""
echo "╔══════════════════════════════════════╗"
echo "║       TTS Studio 启动脚本             ║"
echo "╚══════════════════════════════════════╝"
echo ""

# 1. 检查并安装后端依赖
log "检查后端依赖..."
if [ ! -d "$BACKEND_DIR" ]; then
  error "后端目录不存在: $BACKEND_DIR"
fi

cd "$BACKEND_DIR"
if ! python3 -c "import fastapi" 2>/dev/null; then
  warn "安装后端依赖..."
  pip3 install -r requirements.txt
  log "后端依赖安装完成"
fi

# 2. 检查并安装前端依赖
log "检查前端依赖..."
if [ ! -d "$FRONTEND_DIR" ]; then
  error "前端目录不存在: $FRONTEND_DIR"
fi

cd "$FRONTEND_DIR"
if [ ! -d "node_modules" ]; then
  warn "安装前端依赖..."
  npm install
  log "前端依赖安装完成"
fi

# 3. 停止已有进程
log "停止已有服务..."
pkill -f "python3.*main.py" 2>/dev/null || true
pkill -f "vite" 2>/dev/null || true
# 释放端口
lsof -ti:8000 | xargs kill -9 2>/dev/null || true
lsof -ti:3000 | xargs kill -9 2>/dev/null || true
sleep 2

# 4. 启动后端
log "启动后端 (FastAPI :8000)..."
cd "$BACKEND_DIR"
nohup python3 main.py > /tmp/tts_backend.log 2>&1 &
BACKEND_PID=$!
echo $BACKEND_PID > /tmp/tts_backend.pid
sleep 2

if ! kill -0 $BACKEND_PID 2>/dev/null; then
  error "后端启动失败，查看日志: /tmp/tts_backend.log"
fi

# 5. 启动前端
log "启动前端 (Vite :3000)..."
cd "$FRONTEND_DIR"
nohup npm run dev > /tmp/tts_frontend.log 2>&1 &
FRONTEND_PID=$!
echo $FRONTEND_PID > /tmp/tts_frontend.pid
sleep 3

if ! kill -0 $FRONTEND_PID 2>/dev/null; then
  error "前端启动失败，查看日志: /tmp/tts_frontend.log"
fi

# 6. 完成
echo ""
echo "╔══════════════════════════════════════╗"
echo "║           ✅ 启动完成！              ║"
echo "╚══════════════════════════════════════╝"
echo ""
info "后端:  http://localhost:8000  (PID $BACKEND_PID)"
info "前端:  http://localhost:3000  (PID $FRONTEND_PID)"
echo ""
info "日志位置:"
info "  后端: /tmp/tts_backend.log"
info "  前端: /tmp/tts_frontend.log"
echo ""
info "停止服务: kill \$(cat /tmp/tts_backend.pid) \$(cat /tmp/tts_frontend.pid)"
echo ""
