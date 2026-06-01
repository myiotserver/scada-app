# Deployment Checklist - SCADA v1.0.6

## Pre-Deployment Testing

### 1. Environment Setup
- [ ] Backup current production database
- [ ] Backup current application files
- [ ] Note current running version: `git log -1 --oneline`
- [ ] Set environment variables (if not already set):
  ```bash
  export JWT_SECRET="your-strong-random-secret-here"
  export SCADA_DEFAULT_ADMIN_PASSWORD="strong-password-not-12345678"
  export NODE_ENV="production"
  ```

### 2. Database Migration (New Field)
The `mustChangePassword` field will be auto-created by Sequelize on first run.
- [ ] Verify database connection is working
- [ ] Check if `users` table exists
- [ ] After first startup, verify new column exists:
  ```sql
  SELECT COLUMN_NAME, DATA_TYPE 
  FROM INFORMATION_SCHEMA.COLUMNS 
  WHERE TABLE_NAME = 'users' AND COLUMN_NAME = 'mustChangePassword'
  ```

### 3. Install Dependencies
```bash
cd /home/ubuntu/applications/scada-app
npm install
```
- [ ] No errors during npm install
- [ ] Check for any peer dependency warnings

### 4. Application Startup Test
```bash
# Test startup (don't use PM2 yet)
node index.js
```

**Check for:**
- [ ] ✅ Server starts without errors
- [ ] ✅ JWT_SECRET warning appears (if not set in env)
- [ ] ✅ Database connection successful
- [ ] ✅ Default admin user created (or skipped if exists)
- [ ] ✅ No error about `mustChangePassword` column

**Expected logs:**
```
[SQL] ✓ Connected to SQL Server (database_name)
[AUTH] Default admin user created on startup: admin. Change password after first login.
```

### 5. OPC-UA Connection Test
- [ ] OPC-UA client connects successfully
- [ ] Check logs for OPC-UA connection status:
  ```
  [OPC-UA] Connected to opc.tcp://...
  ```
- [ ] Verify live values are being read from sensors
- [ ] Check carousel data updates in real-time

**Test commands:**
```bash
# Check OPC-UA connection in logs
tail -f logs/scada-*.log | grep -i "opc"
```

### 6. Database Operations Test
- [ ] SQL Server connection pool established
- [ ] Read from PRESET_TABLE (carousel config) works
- [ ] Write to WEIGHT_TABLE works
- [ ] No duplicate inserts (check recent data)

**Test query:**
```sql
-- Check recent inserts (should have no duplicates)
SELECT PACKING_ORDER, CAROUSEL, PRODUCT_COUNT, COUNT(*) as cnt
FROM WEIGHT_TABLE
WHERE TIMESTAMP >= DATEADD(MINUTE, -10, GETDATE())
GROUP BY PACKING_ORDER, CAROUSEL, PRODUCT_COUNT
HAVING COUNT(*) > 1
```

### 7. WebSocket / Socket.IO Test
- [ ] Open web dashboard: `http://server-ip:3000`
- [ ] WebSocket connection established (check browser console)
- [ ] Real-time carousel data updates visible
- [ ] No connection errors in browser console

**Browser console should show:**
```
Socket.IO connected
Carousel data received
```

### 8. Authentication Test
- [ ] Login with existing user works
- [ ] JWT token generated successfully
- [ ] Session persists across page refresh
- [ ] Logout works

**Test default admin (if newly created):**
- [ ] Login with default credentials
- [ ] Response includes `mustChangePassword: true`
- [ ] Dashboard should prompt for password change

### 9. Password Change Test (New Feature)
**API Test:**
```bash
# Get token first
TOKEN="your-jwt-token-here"

# Test change password endpoint
curl -X POST http://localhost:3000/api/auth/change-password \
  -H "Content-Type: application/json" \
  -H "x-access-token: $TOKEN" \
  -d '{
    "oldPassword": "current-password",
    "newPassword": "new-strong-password"
  }'
```

- [ ] Endpoint returns 200 OK
- [ ] Password updated in database
- [ ] `mustChangePassword` flag cleared
- [ ] Can login with new password
- [ ] Cannot login with old password

### 10. Security Validation
- [ ] Run npm audit: `npm audit`
- [ ] Should show only 2 moderate vulnerabilities (uuid + sequelize)
- [ ] No critical or high vulnerabilities
- [ ] Check fail2ban is running (if configured):
  ```bash
  sudo systemctl status fail2ban
  ```

### 11. Performance Test
- [ ] Monitor memory usage: `top` or `htop`
- [ ] Check for memory leaks (run for 10-15 minutes)
- [ ] CPU usage normal during data capture
- [ ] No excessive log file growth

### 12. Data Integrity Test
**Run duplicate check:**
```bash
node -e "
const sql = require('mssql');
const fs = require('fs');
const settings = JSON.parse(fs.readFileSync('./config/scada-settings.json', 'utf8'));
const config = {
    user: settings.sql_uid,
    password: settings.sql_pass,
    server: settings.sql_server,
    database: settings.sql_db,
    options: { encrypt: false, trustServerCertificate: true }
};
(async () => {
    const pool = await sql.connect(config);
    const result = await pool.request().query(\`
        SELECT COUNT(*) as dupes FROM (
            SELECT PACKING_ORDER, CAROUSEL, PRODUCT_COUNT, COUNT(*) as cnt
            FROM [WEIGHT_TABLE]
            WHERE TIMESTAMP >= DATEADD(HOUR, -1, GETDATE())
            GROUP BY PACKING_ORDER, CAROUSEL, PRODUCT_COUNT
            HAVING COUNT(*) > 1
        ) t
    \`);
    console.log('Duplicates in last hour:', result.recordset[0].dupes);
    sql.close();
})();
"
```
- [ ] Zero duplicates in last hour

---

## Production Deployment

### 13. Stop Current Application
```bash
# If using PM2
pm2 stop scada-app

# If using systemd
sudo systemctl stop scada-app

# If running manually
# Find and kill the process
```

### 14. Deploy New Version
```bash
cd /home/ubuntu/applications/scada-app
git pull origin main
npm install
```

### 15. Start Application
```bash
# Using PM2 (recommended)
pm2 start ecosystem.config.js
pm2 save

# Or using systemd
sudo systemctl start scada-app

# Or manually
node index.js
```

### 16. Post-Deployment Verification
- [ ] Application started successfully
- [ ] Check logs for errors: `pm2 logs scada-app` or `tail -f logs/scada-*.log`
- [ ] OPC-UA connected
- [ ] Database connected
- [ ] WebSocket working
- [ ] Dashboard accessible
- [ ] Real-time data flowing

### 17. Monitor for 30 Minutes
- [ ] No errors in logs
- [ ] Data continues to flow
- [ ] No duplicates created
- [ ] Memory usage stable
- [ ] CPU usage normal

---

## Rollback Plan (If Issues Occur)

### Quick Rollback Steps:
```bash
# Stop current version
pm2 stop scada-app

# Revert to previous version
git reset --hard HEAD~1

# Reinstall old dependencies
npm install

# Restart
pm2 start ecosystem.config.js
pm2 save
```

### Database Rollback (if needed):
```sql
-- Remove mustChangePassword column if causing issues
ALTER TABLE users DROP COLUMN mustChangePassword;
```

---

## Post-Deployment Tasks

### 18. Update Documentation
- [ ] Update version number in README
- [ ] Document any new environment variables
- [ ] Update API documentation (new /api/auth/change-password endpoint)

### 19. Notify Team
- [ ] Inform operators about password change feature
- [ ] Provide instructions for changing default admin password
- [ ] Share this checklist with deployment team

### 20. Schedule Follow-up
- [ ] Monitor for 24 hours
- [ ] Check weekly for any anomalies
- [ ] Plan next security audit in 1 month

---

## Emergency Contacts
- **Database Admin:** [contact info]
- **Network Admin:** [contact info]
- **Application Owner:** [contact info]

---

## Version Info
- **Current Version:** v1.0.6
- **Previous Version:** v1.0.5.1
- **Deployment Date:** [fill in]
- **Deployed By:** [fill in]

---

## Notes
- Security patches applied: 18 vulnerabilities fixed
- New feature: Force password change for default admin
- No breaking changes to OPC-UA, database, or WebSocket functionality
- All changes are backward compatible
