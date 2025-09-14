#!/bin/bash

# HealthWeb Clone Deployment Script
# This script sets up the application on a fresh Ubuntu server

set -e

echo "🚀 Starting HealthWeb Clone deployment..."

# Update system
echo "📦 Updating system packages..."
sudo apt-get update
sudo apt-get upgrade -y

# Install Node.js
echo "📦 Installing Node.js..."
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install PostgreSQL
echo "📦 Installing PostgreSQL..."
sudo apt-get install -y postgresql postgresql-contrib

# Install PM2 for process management
echo "📦 Installing PM2..."
sudo npm install -g pm2

# Install AWS CLI
echo "📦 Installing AWS CLI..."
sudo apt-get install -y awscli

# Create application directory
echo "📁 Setting up application directory..."
sudo mkdir -p /opt/healthweb-clone
sudo chown $USER:$USER /opt/healthweb-clone

# Copy application files
echo "📁 Copying application files..."
cp -r . /opt/healthweb-clone/

# Install dependencies
echo "📦 Installing application dependencies..."
cd /opt/healthweb-clone
npm install --production

# Set up environment variables
echo "⚙️ Setting up environment variables..."
sudo cp .env.example /opt/healthweb-clone/.env
echo "Please edit /opt/healthweb-clone/.env with your configuration"

# Set up database
echo "🗄️ Setting up database..."
sudo -u postgres createdb healthweb || echo "Database may already exist"

# Set up log directory
echo "📁 Setting up log directory..."
mkdir -p /opt/healthweb-clone/app/logs
chmod 755 /opt/healthweb-clone/app/logs

# Create systemd service
echo "🔧 Creating systemd service..."
sudo tee /etc/systemd/system/healthweb-clone.service > /dev/null <<EOF
[Unit]
Description=HealthWeb Clone Application
After=network.target

[Service]
Type=simple
User=$USER
WorkingDirectory=/opt/healthweb-clone
ExecStart=/usr/bin/node app.js
Restart=always
RestartSec=10
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
EOF

# Enable and start service
echo "🚀 Starting service..."
sudo systemctl daemon-reload
sudo systemctl enable healthweb-clone
sudo systemctl start healthweb-clone

# Check service status
echo "📊 Checking service status..."
sudo systemctl status healthweb-clone --no-pager

echo "✅ Deployment completed!"
echo "📝 Next steps:"
echo "1. Edit /opt/healthweb-clone/.env with your configuration"
echo "2. Restart the service: sudo systemctl restart healthweb-clone"
echo "3. Check logs: sudo journalctl -u healthweb-clone -f"
echo "4. Test the application: curl http://localhost:3000/health"
