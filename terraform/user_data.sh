#!/bin/bash

# HealthWeb Clone EC2 User Data Script
# This script sets up the application on EC2 instance

set -e

# Update system
apt-get update
apt-get upgrade -y

# Install Node.js
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt-get install -y nodejs

# Install PM2
npm install -g pm2

# Install PostgreSQL client
apt-get install -y postgresql-client

# Create application directory
mkdir -p /opt/healthweb-clone
cd /opt/healthweb-clone

# Download application code (you'll need to upload this)
# For now, we'll create a placeholder
cat > package.json << 'EOF'
{
  "name": "healthweb-clone",
  "version": "1.0.0",
  "main": "app.js",
  "scripts": {
    "start": "node app.js"
  },
  "dependencies": {
    "express": "^4.21.0",
    "sequelize": "^6.37.3",
    "pg": "^8.13.0",
    "bcryptjs": "^2.4.3",
    "multer": "^1.4.5-lts.1",
    "aws-sdk": "^2.1691.0",
    "@sendgrid/mail": "^8.1.4",
    "winston": "^3.15.0",
    "dotenv": "^16.4.5"
  }
}
EOF

# Install dependencies
npm install

# Create environment file
cat > .env << EOF
NODE_ENV=production
PORT=3000

# Database Configuration
DB_HOST=${rds_endpoint}
DB_PORT=${rds_port}
DB_DATABASE=${db_name}
DB_USER=${db_username}
DB_PASSWORD=${db_password}

# AWS Configuration
AWS_REGION=${aws_region}
S3_BUCKET_NAME=${s3_bucket_name}

# SendGrid Configuration
SENDGRID_API_KEY=${sendgrid_api_key}
FROM_EMAIL=${from_email}

# SNS Configuration
SNS_TOPIC_ARN=${sns_topic_arn}
EOF

# Create basic app.js (placeholder - you'll replace this with your actual code)
cat > app.js << 'EOF'
require('dotenv').config();
const express = require('express');
const app = express();

app.use(express.json());

app.get('/', (req, res) => {
  res.json({
    message: 'HealthWeb Clone is running!',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV
  });
});

app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
EOF

# Create logs directory
mkdir -p logs

# Create systemd service
cat > /etc/systemd/system/healthweb-clone.service << EOF
[Unit]
Description=HealthWeb Clone Application
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/opt/healthweb-clone
ExecStart=/usr/bin/node app.js
Restart=always
RestartSec=10
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
EOF

# Enable and start service
systemctl daemon-reload
systemctl enable healthweb-clone
systemctl start healthweb-clone

# Install CloudWatch agent
wget https://s3.amazonaws.com/amazoncloudwatch-agent/ubuntu/amd64/latest/amazon-cloudwatch-agent.deb
dpkg -i amazon-cloudwatch-agent.deb

# Create CloudWatch config
cat > /opt/aws/amazon-cloudwatch-agent/etc/amazon-cloudwatch-agent.json << EOF
{
  "logs": {
    "logs_collected": {
      "files": {
        "collect_list": [
          {
            "file_path": "/opt/healthweb-clone/logs/*.log",
            "log_group_name": "/aws/ec2/healthweb-clone",
            "log_stream_name": "{instance_id}"
          }
        ]
      }
    }
  },
  "metrics": {
    "namespace": "HealthWeb/EC2",
    "metrics_collected": {
      "cpu": {
        "measurement": ["cpu_usage_idle", "cpu_usage_iowait", "cpu_usage_user", "cpu_usage_system"],
        "metrics_collection_interval": 60
      },
      "disk": {
        "measurement": ["used_percent"],
        "metrics_collection_interval": 60,
        "resources": ["*"]
      },
      "mem": {
        "measurement": ["mem_used_percent"],
        "metrics_collection_interval": 60
      }
    }
  }
}
EOF

# Start CloudWatch agent
/opt/aws/amazon-cloudwatch-agent/bin/amazon-cloudwatch-agent-ctl \
  -a fetch-config \
  -m ec2 \
  -c file:/opt/aws/amazon-cloudwatch-agent/etc/amazon-cloudwatch-agent.json \
  -s

echo "HealthWeb Clone setup completed!"
