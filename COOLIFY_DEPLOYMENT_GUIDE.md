# Coolify Deployment Guide for Pickplace Backend

This guide will walk you through deploying your Node.js backend to Coolify, a self-hosted alternative to Heroku/Vercel.

## 📋 Prerequisites

1. **Coolify Server**: You need a Coolify instance running on your server
2. **MongoDB Database**: Either MongoDB Atlas or a self-hosted MongoDB instance
3. **Domain**: A domain or subdomain for your backend API
4. **Git Repository**: Your code should be in a Git repository (GitHub, GitLab, etc.)

## 🚀 Deployment Steps

### Step 1: Prepare Your Environment Variables

1. Copy the `env.example` file to create your environment configuration:
   ```bash
   cp env.example .env.production
   ```

2. Fill in all the required environment variables in `.env.production`:

   **Essential Variables:**
   ```env
   NODE_ENV=production
   PORT=5000
   MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/pickplace-db
   JWT_SECRET=your_super_long_and_secure_jwt_secret_key_here
   FRONTEND_URL=https://your-frontend-domain.com
   ```

   **Admin Credentials:**
   ```env
   ADMIN_EMAIL=admin@yourdomain.com
   ADMIN_PASSWORD=your_secure_admin_password
   ```

   **Cloudinary (for file uploads):**
   ```env
   CLOUDINARY_CLOUD_NAME=your_cloudinary_cloud_name
   CLOUDINARY_API_KEY=your_cloudinary_api_key
   CLOUDINARY_API_SECRET=your_cloudinary_api_secret
   ```

   **Email Configuration (Gmail OAuth):**
   ```env
   GMAIL_USER=your-gmail@gmail.com
   GMAIL_APP_PASSWORD=your_gmail_app_password
   GOOGLE_CLIENT_ID=your_google_client_id
   GOOGLE_CLIENT_SECRET=your_google_client_secret
   GOOGLE_REDIRECT_URI=https://developers.google.com/oauthplayground
   GOOGLE_REFRESH_TOKEN=your_google_refresh_token
   ```

   **SSLCommerz Payment Gateway:**
   ```env
   SSLCOMMERZ_STORE_ID=your_sslcommerz_store_id
   SSLCOMMERZ_STORE_PASSWORD=your_sslcommerz_store_password
   SSLCOMMERZ_IS_SANDBOX=false
   SSLCOMMERZ_SUCCESS_URL=https://your-frontend-domain.com/payment/success
   SSLCOMMERZ_FAIL_URL=https://your-frontend-domain.com/payment/fail
   SSLCOMMERZ_CANCEL_URL=https://your-frontend-domain.com/payment/cancel
   SSLCOMMERZ_IPN_URL=https://your-backend-domain.com/api/payments/sslcommerz/ipn
   ```

### Step 2: Create a New Application in Coolify

1. **Login to your Coolify dashboard**

2. **Create a new application:**
   - Click on "New Application"
   - Choose "Git Repository" as the source
   - Connect your Git repository (GitHub/GitLab)

3. **Configure the application:**
   - **Name**: `pickplace-backend`
   - **Repository**: Select your repository
   - **Branch**: `main` (or your production branch)
   - **Build Pack**: Docker (Coolify will auto-detect the Dockerfile)

### Step 3: Configure Build Settings

1. **Build Configuration:**
   - **Dockerfile Path**: `backend/Dockerfile`
   - **Docker Context**: `backend/`
   - **Port**: `5000`

2. **Environment Variables:**
   - Go to the "Environment" tab
   - Add all the environment variables from your `.env.production` file
   - Make sure to mark sensitive variables as "Secret"

### Step 4: Configure Domain and SSL

1. **Domain Configuration:**
   - Go to the "Domains" tab
   - Add your domain: `api.yourdomain.com` (or subdomain)
   - Coolify will automatically generate SSL certificates

2. **Update CORS Settings:**
   - Make sure your `FRONTEND_URL` environment variable matches your frontend domain
   - Update the CORS configuration in your code if needed

### Step 5: Configure Health Checks

Coolify will use the health check endpoint we added to your server:
- **Health Check URL**: `/api/health`
- **Port**: `5000`

### Step 6: Deploy

1. **Initial Deployment:**
   - Click "Deploy" in your Coolify dashboard
   - Monitor the build logs for any errors
   - The deployment should complete in 2-5 minutes

2. **Verify Deployment:**
   - Visit `https://your-backend-domain.com/api/health`
   - You should see a JSON response with server status

### Step 7: Configure Persistent Storage (Optional)

If you need persistent file uploads:

1. **Volume Configuration:**
   - Go to "Storage" tab in Coolify
   - Add a volume: `/app/uploads` → `/data/uploads`
   - This ensures uploaded files persist across deployments

## 🔧 Advanced Configuration

### Custom Build Commands

If you need custom build commands, create a `coolify.yml` file in your repository root:

```yaml
version: "3.8"
services:
  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile
    environment:
      - NODE_ENV=production
    ports:
      - "5000:5000"
    volumes:
      - uploads:/app/uploads
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:5000/api/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s

volumes:
  uploads:
```

### Database Connection

**For MongoDB Atlas:**
```env
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/pickplace-db?retryWrites=true&w=majority
```

**For Self-hosted MongoDB:**
```env
MONGODB_URI=mongodb://mongodb-server:27017/pickplace-db
```

### SSL/HTTPS Configuration

Coolify automatically provides SSL certificates via Let's Encrypt. Make sure:
1. Your domain DNS points to your Coolify server
2. Your domain is properly configured in Coolify
3. Wait 2-5 minutes for certificate generation

## 🐛 Troubleshooting

### Common Issues

1. **Build Fails:**
   - Check the build logs in Coolify
   - Ensure all dependencies are in `package.json`
   - Verify the Dockerfile syntax

2. **Application Won't Start:**
   - Check environment variables are set correctly
   - Verify MongoDB connection string
   - Check the application logs

3. **Health Check Fails:**
   - Ensure the health check endpoint returns 200 status
   - Check if the application is binding to the correct port (5000)

4. **Database Connection Issues:**
   - Verify MongoDB URI is correct
   - Check if MongoDB server allows connections from your Coolify server
   - For MongoDB Atlas, whitelist your server IP

5. **File Upload Issues:**
   - Configure persistent storage volumes
   - Check Cloudinary configuration
   - Verify upload directory permissions

### Monitoring and Logs

1. **Application Logs:**
   - View logs directly in Coolify dashboard
   - Use the "Logs" tab for real-time monitoring

2. **Performance Monitoring:**
   - Monitor CPU and memory usage in Coolify
   - Set up alerts for high resource usage

3. **Health Monitoring:**
   - Coolify automatically monitors your health check endpoint
   - Configure notifications for downtime

## 🔄 Continuous Deployment

### Automatic Deployments

1. **Webhook Configuration:**
   - Coolify provides a webhook URL
   - Add this webhook to your Git repository
   - Automatic deployments on push to main branch

2. **Manual Deployments:**
   - Use the "Deploy" button in Coolify dashboard
   - Monitor deployment progress and logs

### Rollback Strategy

1. **Quick Rollback:**
   - Coolify keeps previous deployments
   - Use the "Rollback" feature for quick recovery

2. **Database Migrations:**
   - Always backup database before major updates
   - Test migrations in staging environment

## 📝 Post-Deployment Checklist

- [ ] Health check endpoint responds correctly
- [ ] All API endpoints are accessible
- [ ] Database connection is working
- [ ] File uploads are functioning
- [ ] Email service is configured
- [ ] Payment gateway is working (test mode first)
- [ ] CORS is properly configured for your frontend
- [ ] SSL certificate is active
- [ ] Environment variables are set correctly
- [ ] Monitoring and logging are working

## 🔗 Useful Links

- [Coolify Documentation](https://coolify.io/docs)
- [MongoDB Atlas](https://www.mongodb.com/atlas)
- [Cloudinary Setup](https://cloudinary.com/documentation)
- [SSLCommerz Integration](https://developer.sslcommerz.com/)

## 💡 Tips

1. **Use staging environment**: Test deployments in a staging environment first
2. **Monitor resources**: Keep an eye on CPU/memory usage
3. **Regular backups**: Set up automated database backups
4. **Security updates**: Keep dependencies updated
5. **Error tracking**: Consider integrating error tracking services

---

**Need Help?** If you encounter issues during deployment, check the Coolify community forums or documentation for additional support.
