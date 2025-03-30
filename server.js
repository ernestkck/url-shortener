require('dotenv').config();
const express = require('express');
const app = express();
const port = process.env.PORT || 3000;
const validUrl = require('valid-url');
const { toBase62 } = require('./utils');
const redisClient = require('./redisClient');
const db = require('./db');

// Initialize the database and create the table if it doesn't exist
db.createTable().catch(err => {
    console.error('Error initializing database:', err.stack);
    process.exit(1); // Exit the process if there's an error
});

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// In server.js

app.get('/:shortCode', async (req, res) => {
    const { shortCode } = req.params;
    const cacheKey = `url:${shortCode}`;

    try {
        // 1. Check Cache First
        const cachedUrl = await redisClient.get(cacheKey);
        if (cachedUrl) {
            console.log(`Cache hit for ${shortCode}`);
            return res.redirect(302, cachedUrl);
        }

        console.log(`Cache miss for ${shortCode}, checking DB...`);
        // 2. If Cache Miss, Query Database
        const queryText = `
            SELECT long_url, expires_at
            FROM urls
            WHERE short_code = $1;
        `;
        const result = await db.query(queryText, [shortCode]);

        if (result.rows.length === 0) {
            return res.status(404).send('Short URL not found.');
        }

        const { long_url, expires_at } = result.rows[0];

        // 3. Check Expiration
        if (expires_at && new Date(expires_at) < new Date()) {
             // Optionally delete expired entry from DB here or run a separate cleanup job
             // await db.query('DELETE FROM urls WHERE short_code = $1', [shortCode]);
             // Optionally remove from cache if it somehow existed
             await redisClient.del(cacheKey);
            return res.status(410).send('Short URL has expired.'); // 410 Gone
        }

        // 4. Cache the Result (if not expired)
        await redisClient.set(cacheKey, long_url);
        if (expires_at) {
             const expiryTimestamp = Math.floor(new Date(expires_at).getTime() / 1000);
             await redisClient.expireAt(cacheKey, expiryTimestamp);
        }
         // If no expiration, maybe set a default TTL in Redis? e.g., redisClient.set(cacheKey, long_url, { EX: 3600 }); // Cache for 1 hour


        // 5. Redirect
        return res.redirect(302, long_url);

    } catch (error) {
        console.error('Error retrieving/redirecting URL:', error);
        res.status(500).send('Internal Server Error');
    }
});

app.post('/urls', async (req, res) => {
    const { longUrl, customAlias, expirationDate } = req.body;

    // Validate Long URL
    if (!validUrl.isWebUri(longUrl)) {
        return res.status(400).json({ error: 'Invalid URL format' });
    }

    // NOTE: Checking if longUrl *already* exists can be complex and might not be
    // strictly necessary if unique short codes are the primary goal.
    // If needed, add a DB query here:
    // const existing = await db.query('SELECT short_code FROM urls WHERE long_url = $1', [longUrl]);
    // if (existing.rows.length > 0) { ... return existing short code ... }

    let shortCode = customAlias;
    let isCustom = !!customAlias;

    try {
        if (isCustom) {
            // Validate customAlias 
            if (!/^[a-zA-Z0-9_-]+$/.test(customAlias) || customAlias.length < 4 || customAlias.length > 20) {
                 return res.status(400).json({ error: 'Invalid custom alias format or length.' });
            }
            // Check if custom alias already exists in DB
            const aliasCheck = await db.query('SELECT id FROM urls WHERE short_code = $1', [customAlias]);
            if (aliasCheck.rows.length > 0) {
                return res.status(409).json({ error: 'Custom alias already in use.' });
            }
        } else {
            // Get unique ID from Redis counter
            const counterKey = 'url_counter';
            const uniqueId = await redisClient.incr(counterKey);
            shortCode = toBase62(uniqueId);
        }

        // Prepare expiration timestamp (optional)
        let expiresAt = null;
        if (expirationDate) {
            // Basic validation, consider using a date library like moment.js or date-fns for robustness
            const date = new Date(expirationDate);
            if (!isNaN(date)) {
                expiresAt = date.toISOString();
            } else {
                return res.status(400).json({ error: 'Invalid expiration date format.' });
            }
        }

        // Insert into Database
        const insertQuery = `
            INSERT INTO urls (short_code, long_url, expires_at)
            VALUES ($1, $2, $3)
            RETURNING short_code;
        `;
        const result = await db.query(insertQuery, [shortCode, longUrl, expiresAt]);
        const generatedShortCode = result.rows[0].short_code;

        // (Optional) Cache the new entry in Redis
        const cacheKey = `url:${generatedShortCode}`;
        await redisClient.set(cacheKey, longUrl);
        if (expiresAt) {
            // Set Redis expiration slightly after DB expiration for safety
            const expiryTimestamp = Math.floor(new Date(expiresAt).getTime() / 1000);
            const nowTimestamp = Math.floor(Date.now() / 1000);
            if (expiryTimestamp > nowTimestamp) {
                 await redisClient.expireAt(cacheKey, expiryTimestamp);
            } else {
                 // Handle case where expiration is in the past (maybe shouldn't insert?)
                 await redisClient.del(cacheKey); // Delete if already expired
            }
        }

        // 6. Return Short URL
        const shortUrl = `<span class="math-inline">\{process\.env\.BASE\_URL\}/</span>{generatedShortCode}`;
        res.status(201).json({ shortUrl, longUrl });

    } catch (error) {
        console.error('Error creating short URL:', error);
        // Handle potential duplicate key error if custom alias race condition occurs (rare)
        if (error.code === '23505' && isCustom) { // PostgreSQL unique violation code
             return res.status(409).json({ error: 'Custom alias already in use (race condition).' });
        }
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

app.get('/', (req, res) => {
    res.send('URL Shortener API');
});

app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});

module.exports = app;

