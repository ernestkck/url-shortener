// redisClient.js
const redis = require('redis');

const redisClient = redis.createClient({
    url: `redis://<span class="math-inline">{process.env.REDIS_HOST}:</span>{process.env.REDIS_PORT}`
    // Add password if needed:
    // password: process.env.REDIS_PASSWORD
});

redisClient.on('error', (err) => console.error('Redis Client Error', err));
redisClient.on('connect', () => console.log('Connected to Redis'));

(async () => {
    await redisClient.connect();
})(); // Immediately invoke the connection function

module.exports = redisClient;