const Redis = require("ioredis");

const client = new Redis.Cluster(
  [{ host: 'redis-ovhn4q.serverless.apse2.cache.amazonaws.com', port: 6379 }],
  {
    dnsLookup: (address, callback) => callback(null, address),
    redisOptions: {
      tls: {},
    },
  });

(async () => {
    const pong = await client.ping();
    console.log(pong);

    // Set and assert
    const setResult = await client.set("key", "value");
    console.assert(setResult === "OK");

    // Get and assert
    const getResult = await client.get("key");
    console.assert(getResult === "value");
    
    // Close the connection
    client.disconnect();
})();
