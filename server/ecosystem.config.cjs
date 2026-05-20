module.exports = {
  apps: [
    {
      name: 'mapping-server',
      cwd: __dirname,
      script: 'server.js',
      env: {
        NODE_ENV: 'production',
        SERVE_CLIENT: '1',
        BASE_PATH: '/cordinat'
      }
    }
  ]
};
