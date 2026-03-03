module.exports = {
  apps: [
    {
      name: "scada-app",
      script: "index.js",
      cwd: ".",
      instances: 1,
      exec_mode: "fork",
      autorestart: true,
      watch: false,
      max_memory_restart: "700M",
      max_restarts: 20,
      exp_backoff_restart_delay: 200,
      kill_timeout: 5000,
      listen_timeout: 10000,
      out_file: "logs/pm2-out.log",
      error_file: "logs/pm2-error.log",
      merge_logs: true,
      time: true,
      env: {
        NODE_ENV: "production",
        PORT: 3001,
        JWT_SECRET: "53f1ca800741353c5ae7a34a11f98413642445df90ba9fe37d6fc4575e23bf0b422d949fcd3f1caae28c6c75699e256e0aed96a0234656b22bc7e485d970c2a0"
      },
      env_production: {
        NODE_ENV: "production",
        PORT: 3001,
        JWT_SECRET: "53f1ca800741353c5ae7a34a11f98413642445df90ba9fe37d6fc4575e23bf0b422d949fcd3f1caae28c6c75699e256e0aed96a0234656b22bc7e485d970c2a0"
      }
    }
  ]
};
