#!/bin/bash

# ===========================================
# PPAfan - Attendance System - Production Deployment Script
# ===========================================

set -e  # Exit on any error

# Configuration
VPS_HOST="159.198.46.248"
VPS_USER="root"
REMOTE_PATH="/var/www/ppafan"
BRANCH="main"

echo "🚀 PPAfan Attendance System - Deployment Starting..."
echo "============================================"

# Step 1: Commit any pending changes
echo ""
echo "📦 Step 1: Checking for uncommitted changes..."
if [[ -n $(git status -s) ]]; then
    echo "Found uncommitted changes. Committing..."
    git add .
    git commit -m "Deploy: $(date '+%Y-%m-%d %H:%M:%S')"
fi

# Step 2: Push to GitHub
echo ""
echo "📤 Step 2: Pushing to GitHub..."
git push origin $BRANCH

# Step 3: Deploy to VPS
echo ""
echo "🖥️  Step 3: Deploying to VPS..."

ssh $VPS_USER@$VPS_HOST << 'ENDSSH'
    set -e

    echo "📁 Navigating to app directory..."
    cd /var/www/ppafan

    # Initialize git if not already
    if [ ! -d ".git" ]; then
        echo "🔧 Initializing git repository..."
        git init
        git remote add origin https://github.com/oluwadare11/ppafan.git
    fi

    # Backup current .env files (preserve server credentials)
    echo "💾 Backing up current .env files..."
    cp backend/.env backend/.env.backup 2>/dev/null || true
    cp frontend/.env frontend/.env.backup 2>/dev/null || true

    # Pull latest code
    echo "⬇️  Pulling latest code..."
    git fetch origin main
    git reset --hard origin/main

    # Restore .env files from backup (preserve server credentials)
    echo "⚙️  Restoring environment configuration..."
    cp backend/.env.backup backend/.env 2>/dev/null || true
    cp frontend/.env.backup frontend/.env 2>/dev/null || true
    echo "✅ Environment files preserved"

    # Install backend dependencies
    echo "📦 Installing backend dependencies..."
    cd backend
    npm install --production

    # Build frontend
    echo ""
    echo "🔨 Building frontend..."
    cd ../frontend

    npm install
    npm run build

    # Copy public assets to dist
    cp public/* dist/ 2>/dev/null || true
    rm -f dist/._* 2>/dev/null || true
    echo "✅ Frontend build complete!"

    # Restart PM2
    echo ""
    echo "🔄 Restarting backend application..."
    cd ../backend
    pm2 restart ppafan-backend || pm2 start ecosystem.config.js --env production

    # Show status
    echo ""
    echo "✅ Deployment complete!"
    pm2 status
ENDSSH

echo ""
echo "============================================"
echo "🎉 Deployment finished successfully!"
echo "🌐 App: https://app.ppafan.org"
echo "============================================"
