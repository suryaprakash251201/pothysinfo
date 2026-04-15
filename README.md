# pothysinfo.in

Portfolio website with blog and admin dashboard.

This project now runs with a Node.js backend and CloudPE S3-compatible object storage.

## Tech stack

- Frontend: HTML, CSS, JavaScript
- Backend: Node.js, Express
- Storage: CloudPE S3 (S3-compatible API)

## Project files

- `index.html` - portfolio landing page
- `blog.html` - public blog page
- `admin.html` - admin login and dashboard
- `assets/js/admin.js` - admin authentication and CRUD logic
- `assets/js/blog.js` - blog rendering logic
- `server.js` - Express API and CloudPE S3 integration

## Environment setup

Create a `.env` file in the project root:

```dotenv
PORT=3000
CLOUDPE_ACCESS_KEY=your_access_key
CLOUDPE_SECRET_KEY=your_secret_key
CLOUDPE_ENDPOINT=https://s3.in-west3.purestore.io/
CLOUDPE_BUCKET=your_bucket_name
ADMIN_USERNAME=admin
ADMIN_PASSWORD=change_this_password
```

You can copy from `.env.example` and update values.

## Run locally

```bash
npm install
npm start
```

Open:

- `http://localhost:3000/`
- `http://localhost:3000/blog`
- `http://localhost:3000/admin`

## Cloud deployment guide

The easiest production deployment is a Linux VM (AWS EC2, DigitalOcean, Azure VM, etc.) using PM2 + Nginx.

### 1. Prepare server

```bash
sudo apt update && sudo apt upgrade -y
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs nginx git
sudo npm install -g pm2
```

### 2. Deploy app code

```bash
cd /var/www
sudo git clone https://github.com/suryaprakash251201/pothysinfo.git
cd pothysinfo
npm install --omit=dev
cp .env.example .env
nano .env
```

Set correct CloudPE and admin values in `.env`.

### 3. Start with PM2

```bash
pm2 start server.js --name pothysinfo
pm2 save
pm2 startup
```

### 4. Configure Nginx reverse proxy

Create file `/etc/nginx/sites-available/pothysinfo`:

```nginx
server {
	listen 80;
	server_name your-domain.com www.your-domain.com;

	location / {
		proxy_pass http://127.0.0.1:3000;
		proxy_http_version 1.1;
		proxy_set_header Upgrade $http_upgrade;
		proxy_set_header Connection 'upgrade';
		proxy_set_header Host $host;
		proxy_cache_bypass $http_upgrade;
	}
}
```

Enable site and reload Nginx:

```bash
sudo ln -s /etc/nginx/sites-available/pothysinfo /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### 5. Enable HTTPS (recommended)

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com -d www.your-domain.com
```

## Deployment checks

Use these endpoints after deployment:

- `GET /api/health`
- `GET /api/posts`
- `POST /api/login`

## Security notes

- Never commit `.env` to git.
- Use strong `ADMIN_PASSWORD` in production.
- Rotate CloudPE access keys if they are exposed.
