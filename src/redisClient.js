// redisClient.js
const redis = require('redis');

const redisClient = redis.createClient({
    url: `rediss://${process.env.REDIS_HOST}:${process.env.REDIS_PORT}`,
    socket: {
        tls: true,
        rejectUnauthorized: false, // Set to true in production for security
    },
});

redisClient.on('error', (err) => console.error('Redis Client Error: ', err));
redisClient.on('connect', () => console.log('Connected to Redis'));

(async () => {
    await redisClient.connect();
})(); 

module.exports = redisClient;
