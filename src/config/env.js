const env = {
  server: {
    url: process.env.NEXT_PUBLIC_API_URL,
    socket: process.env.NEXT_PUBLIC_WEBSOCKET_HOST,
  },
  node_env: process.env.NEXT_PUBLIC_NODE_ENV || 'development',
};

export default env;
