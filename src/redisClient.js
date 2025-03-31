// redisClient.js
const redis = require('redis');

const redisClient = redis.createClient({
    url: `rediss://${process.env.REDIS_HOST}:${process.env.REDIS_PORT}`
});

redisClient.on('error', (err) => console.error('Redis Client Error', err));
redisClient.on('connect', () => console.log('Connected to Redis'));

(async () => {
    await redisClient.connect();
})(); 

module.exports = redisClient;
