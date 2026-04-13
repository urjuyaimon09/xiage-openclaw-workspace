module.exports = {
  apps: [{
    name: 'openclaw',
    script: 'C:\\Users\\Administrator\\AppData\\Roaming\\npm\\node_modules\\openclaw\\dist\\index.js',
    args: 'gateway',
    instances: 1,
    autorestart: true,
    watch: false,
    restart_delay: 5000,
    exp_backoff_restart_delay: 1000,
    max_restarts: 10,
    min_uptime: 30000,
    env: {
      NODE_ENV: 'production'
    }
  }]
};
