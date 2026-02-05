module.exports = {
  apps: [
    {
      name: 'ppafan-backend',
      script: 'server.js',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '500M',
      env: {
        NODE_ENV: 'development',
        HTTP_PORT: 8081
      },
      env_production: {
        NODE_ENV: 'production',
        HTTP_PORT: 8081
      },
      error_file: './logs/ppafan-error.log',
      out_file: './logs/ppafan-out.log',
      log_file: './logs/ppafan-combined.log',
      time: true,
      merge_logs: true,
    }
  ]
};
