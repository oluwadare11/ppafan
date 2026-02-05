# PPAfan Deployment Guide

## Server: 159.198.46.248
## Domain: app.ppafan.org

---

## Step 1: Create MongoDB Atlas Database

1. Go to MongoDB Atlas: https://cloud.mongodb.com
2. Create a new cluster or use existing
3. Create a new database: `ppafan_db`
4. Create a database user for PPAfan:
   - Username: `ppafan_db_user`
   - Password: (generate a strong password)
5. Add IP whitelist: `159.198.46.248` (your server IP)
6. Get connection string and update `.env`:
   ```
   MONGO_URI=mongodb+srv://ppafan_db_user:PASSWORD@YOUR_CLUSTER.mongodb.net/ppafan_db?retryWrites=true&w=majority
   ```

---

## Step 2: Upload Code to Server

```bash
# On your local machine
scp -r /Users/FreshOlutimi/Desktop/ppafan-app root@159.198.46.248:/var/www/

# Or use rsync (recommended)
rsync -avz --exclude 'node_modules' /Users/FreshOlutimi/Desktop/ppafan-app/ root@159.198.46.248:/var/www/ppafan-app/
```

---

## Step 3: Server Setup

SSH into server:
```bash
ssh root@159.198.46.248
```

### Install dependencies:
```bash
cd /var/www/ppafan-app/backend
npm install

cd /var/www/ppafan-app/frontend
npm install
npm run build
```

### Set production environment:
```bash
cd /var/www/ppafan-app/backend
nano .env
# Update NODE_ENV=production
# Update MONGO_URI with actual connection string
# Update MAIL_PASSWORD with actual email password
```

---

## Step 4: Configure Nginx

Create nginx config:
```bash
nano /etc/nginx/sites-available/ppafan
```

Paste this configuration:
```nginx
# PPAfan - app.ppafan.org
server {
    listen 80;
    server_name app.ppafan.org;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name app.ppafan.org;

    # SSL - Cloudflare Origin Certificate (or Let's Encrypt)
    ssl_certificate /etc/ssl/ppafan/origin.pem;
    ssl_certificate_key /etc/ssl/ppafan/origin-key.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_prefer_server_ciphers on;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header X-Content-Type-Options "nosniff" always;

    # Frontend (built static files)
    root /var/www/ppafan-app/frontend/dist;
    index index.html;

    # API proxy to backend
    location /api {
        proxy_pass http://127.0.0.1:8081;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 86400;
    }

    # ZKTeco ADMS integration
    location /iclock {
        proxy_pass http://127.0.0.1:8081;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 300;
        client_max_body_size 10M;
    }

    # Uploads
    location /uploads {
        proxy_pass http://127.0.0.1:8081;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    # SPA fallback
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Static assets caching
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # Gzip
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_proxied any;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml;
}
```

### Enable site and SSL:
```bash
# Create SSL directory
mkdir -p /etc/ssl/ppafan

# Option A: Cloudflare Origin Certificate (recommended if using Cloudflare)
# Generate certificate in Cloudflare dashboard and save as:
# /etc/ssl/ppafan/origin.pem
# /etc/ssl/ppafan/origin-key.pem

# Option B: Let's Encrypt (if not using Cloudflare proxy)
certbot certonly --nginx -d app.ppafan.org

# Enable site
ln -s /etc/nginx/sites-available/ppafan /etc/nginx/sites-enabled/

# Test and reload nginx
nginx -t
systemctl reload nginx
```

---

## Step 5: Start Backend with PM2

```bash
cd /var/www/ppafan-app/backend

# Start with PM2
pm2 start ecosystem.config.js --env production

# Save PM2 process list
pm2 save

# Setup PM2 to start on boot (if not already done)
pm2 startup
```

---

## Step 6: Verify Deployment

1. Visit https://app.ppafan.org
2. Check backend health: https://app.ppafan.org/api/system/status
3. Login with admin credentials
4. Test attendance features

---

## Useful Commands

```bash
# View PM2 logs
pm2 logs ppafan-backend

# Restart backend
pm2 restart ppafan-backend

# View nginx logs
tail -f /var/log/nginx/error.log

# Check server status
pm2 status
```

---

## Notes

- Backend runs on port 8081 (different from Pumphouse which uses 8080)
- Frontend dev server would use port 5174 (if running locally)
- Cloudflare DNS is already configured: A record for "app" pointing to 159.198.46.248
