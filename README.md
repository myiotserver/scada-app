# SCADA App

Aplikasi SCADA (Supervisory Control and Data Acquisition) untuk monitoring dan kontrol sistem weighing carousel industri. Aplikasi ini menggunakan Node.js sebagai backend, dengan integrasi OPC UA untuk komunikasi real-time dengan perangkat industri, dan database MSSQL/PostgreSQL untuk penyimpanan data.

## Fitur Utama

- **Real-time Monitoring**: Dashboard real-time untuk monitoring berat carousel menggunakan Socket.io
- **Autentikasi Pengguna**: Sistem login dengan JWT dan role-based access
- **OPC UA Integration**: Komunikasi dengan server OPC UA untuk data industri
- **Database Integration**: Dukungan MSSQL dan PostgreSQL
- **Data Aggregation**: Agregasi data otomatis dengan cron jobs
- **PKI Certificates**: Manajemen sertifikat untuk keamanan OPC UA

## Prerequisites

Sebelum menjalankan aplikasi ini, pastikan Anda memiliki:

- **Node.js** versi 16 atau lebih tinggi
- **npm** (biasanya sudah terinstall dengan Node.js)
- **Database Server**:
  - Microsoft SQL Server (untuk data weighing)
  - PostgreSQL (untuk autentikasi dan user management)
- **OPC UA Server** (misalnya KEPServerEX) yang terhubung ke perangkat weighing
- **Git** untuk cloning repository

### Untuk Linux

- Pastikan Node.js terinstall:
  ```bash
  node --version
  npm --version
  ```
- Jika belum, install menggunakan package manager:
  ```bash
  # Ubuntu/Debian
  sudo apt update
  sudo apt install nodejs npm

  # CentOS/RHEL
  sudo yum install nodejs npm
  ```

### Untuk Windows

- Download dan install Node.js dari [nodejs.org](https://nodejs.org/)
- Pastikan Node.js dan npm terinstall dengan membuka Command Prompt dan menjalankan:
  ```cmd
  node --version
  npm --version
  ```

## Instalasi

### Langkah 1: Clone Repository

#### Linux
```bash
git clone https://github.com/your-username/scada-app.git
cd scada-app
```

#### Windows
```cmd
git clone https://github.com/your-username/scada-app.git
cd scada-app
```

### Langkah 2: Install Dependencies

#### Linux
```bash
npm install
```

#### Windows
```cmd
npm install
```

### Langkah 3: Setup Database

#### PostgreSQL Setup (untuk autentikasi)

**Linux:**
```bash
# Install PostgreSQL jika belum ada
sudo apt install postgresql postgresql-contrib  # Ubuntu/Debian
# atau
sudo yum install postgresql-server postgresql-contrib  # CentOS/RHEL

# Start PostgreSQL service
sudo systemctl start postgresql
sudo systemctl enable postgresql

# Buat database dan user
sudo -u postgres psql
CREATE DATABASE scada_db;
CREATE USER scada_user WITH PASSWORD 'secure_password';
GRANT ALL PRIVILEGES ON DATABASE scada_db TO scada_user;
\q
```

**Windows:**
- Download dan install PostgreSQL dari [postgresql.org](https://www.postgresql.org/download/windows/)
- Buka pgAdmin atau psql
- Buat database `scada_db` dan user `scada_user` dengan password `secure_password`

#### MSSQL Setup (untuk data weighing)

- Pastikan Microsoft SQL Server terinstall dan berjalan
- Server remote sudah dikonfigurasi (dalam contoh: columba.s-net.id)
- Database `WEIGHER` sudah ada dengan tabel yang diperlukan

### Langkah 4: Konfigurasi Aplikasi

#### Edit File Konfigurasi

1. **Database PostgreSQL** (`config/db.config.js`):
   ```javascript
   module.exports = {
       HOST: "localhost",  // atau IP server PostgreSQL
       USER: "scada_user",
       PASSWORD: "secure_password",
       DB: "scada_db",
       dialect: "postgres",
       // ... konfigurasi pool
   };
   ```

2. **Database MSSQL** (`config/db.config.mssql.js`):
   ```javascript
   module.exports = {
       user: 'sa',
       password: 'VPS@thinkcentre',
       server: 'columba.s-net.id',
       database: 'WEIGHER',
       // ... konfigurasi lainnya
   };
   ```

3. **OPC UA Configuration** (`config/opcua.config.json`):
   ```json
   {
       "endpointUrl": "opc.tcp://147.139.196.244:49320",
       "securityMode": "Sign",
       "securityPolicy": "Basic256",
       "username": "Administrator",
       "password": "thinkcentre",
       // ... nodes configuration
   }
   ```

4. **SCADA Settings** (`config/scada-settings.json`):
   ```json
   {
       "sql_server": "columba.s-net.id",
       "sql_uid": "sa",
       "sql_pass": "VPS@thinkcentre",
       "sql_db": "WEIGHING",
       // ... tabel dan interlocks
   }
   ```

#### Setup Environment Variables (opsional)

Buat file `.env` di root directory:
```
NODE_ENV=development
PORT=3001
JWT_SECRET=your_jwt_secret_key
```

## Menjalankan Aplikasi

### Development Mode

#### Linux
```bash
npm start
# atau
node index.js
```

#### Windows
```cmd
npm start
```

Aplikasi akan berjalan di `http://localhost:3001`

### Production Mode

Untuk production, gunakan process manager seperti PM2:

#### Linux
```bash
npm install -g pm2
pm2 start index.js --name "scada-app"
pm2 startup
pm2 save
```

#### Windows
```cmd
npm install -g pm2
pm2 start index.js --name "scada-app"
```

## Penggunaan

1. **Akses Dashboard**:
   - Buka browser dan navigasi ke `http://localhost:3000`
   - Login dengan kredensial yang valid

2. **Monitoring Real-time**:
   - Dashboard akan menampilkan berat carousel secara real-time
   - Data diperbarui melalui WebSocket connection

3. **OPC UA Connection**:
   - Aplikasi akan otomatis connect ke OPC UA server
   - Monitor status connection di logs

4. **Download Certificates**:
   - Untuk trust dengan OPC UA server, download certificate dari:
     `http://localhost:3001/download/client-cert?format=pem` atau `der`

## API Endpoints

- `POST /api/auth/signup` - Registrasi user baru
- `POST /api/auth/signin` - Login
- `GET /api/scada/data` - Ambil data SCADA
- `GET /api/opcua/status` - Status OPC UA connection
- `GET /api/settings` - Pengaturan aplikasi

## Troubleshooting

### Masalah Umum

1. **Database Connection Error**:
   - Pastikan database server berjalan
   - Periksa kredensial di file konfigurasi
   - Untuk remote MSSQL, pastikan firewall mengizinkan koneksi

2. **OPC UA Connection Failed**:
   - Periksa endpoint URL dan kredensial
   - Pastikan OPC UA server berjalan
   - Download dan install client certificate ke server OPC UA

3. **Port Already in Use**:
   - Ubah PORT di environment atau file konfigurasi
   - Kill process yang menggunakan port:
     ```bash
     # Linux
     sudo lsof -i :3001
     sudo kill -9 <PID>
     
     # Windows
     netstat -ano | findstr :3001
     taskkill /PID <PID> /F
     ```

4. **Node Modules Issues**:
   - Hapus `node_modules` dan `package-lock.json`
   - Jalankan `npm install` ulang

### Logs

- Logs aplikasi akan muncul di terminal/console
- Untuk logging lebih detail, set `NODE_ENV=development`

## Kontribusi

1. Fork repository
2. Buat branch fitur baru (`git checkout -b feature/AmazingFeature`)
3. Commit perubahan (`git commit -m 'Add some AmazingFeature'`)
4. Push ke branch (`git push origin feature/AmazingFeature`)
5. Buat Pull Request

## Lisensi

Distributed under the ISC License. See `LICENSE` for more information.

## Kontak

- Project Link: [https://github.com/myiotserver/scada-app](https://github.com/your-username/scada-app)
