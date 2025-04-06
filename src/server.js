require('dotenv').config();
const express = require('express');
const Optimus = require('optimus-js');
const app = express();
const port = process.env.PORT || 3000;
const validUrl = require('valid-url');
const { toBase62 } = require('./utils');
const db = require('./db');
const redisClient = require('./redisClient');

const optimus = new Optimus(process.env.OPTIMUS_PRIME, process.env.OPTIMUS_INVERSE, process.env.OPTIMUS_RANDOM);

// Initialise the database and create the table if it doesn't exist
db.createTable().catch(err => {
    console.error('Error initialising database:', err.stack);
    process.exit(1);
});


app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get('/', (req, res) => {
    res.send('URL Shortener API is running!');
});

// Handle favicon.ico requests separately to prevent hitting the main logic
app.get('/favicon.ico', (req, res) => {
    // Respond with 204 No Content
    res.status(204).end();
});

// GET endpoint to retrieve the long URL from the short code
app.get('/:shortCode', async (req, res) => {
    const { shortCode } = req.params;
    const cacheKey = `url:${shortCode}`;

    try {
        // Check cache first
        const cachedUrl = await redisClient.get(cacheKey);
        if (cachedUrl) {
            console.log(`Cache hit for ${shortCode}`);
            return res.redirect(302, cachedUrl);
        }

        console.log(`Cache miss for ${shortCode}, checking DB...`);

        // If cache miss, query database
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

        // Check expiration
        if (expires_at && new Date(expires_at) < new Date()) {
            await redisClient.del(cacheKey);
            return res.status(410).send('Short URL has expired.'); // 410 Gone
        }

        // Cache the result
        await redisClient.set(cacheKey, long_url);
        if (expires_at) {
            const expiryTimestamp = Math.floor(new Date(expires_at).getTime() / 1000);
            if (expiryTimestamp > Math.floor(Date.now() / 1000)) {
                await redisClient.expireAt(cacheKey, expiryTimestamp);
            } else {
                await redisClient.del(cacheKey);
            }
        }

        // Redirect
        return res.redirect(302, long_url);

    } catch (error) {
        console.error('Error retrieving/redirecting URL:', error);
        res.status(500).send('Internal Server Error');
    }
});

// POST endpoint to create a new short URL
app.post('/api/urls', async (req, res) => {
    const { longUrl, customAlias, expirationDate } = req.body;

    // Validate Long URL
    if (!validUrl.isWebUri(longUrl)) {
        return res.status(400).json({ error: 'Invalid URL format' });
    }

    let shortCode = customAlias;
    let isCustom = !!customAlias;
    let uniqueId = null;

    // Use customAlias or generate a short code
    try {
        if (isCustom) {
            // Validate customAlias 
            if (!/^[a-zA-Z0-9_-]+$/.test(customAlias) || customAlias.length < 1 || customAlias.length > 14) {
                return res.status(400).json({ error: 'Invalid custom alias format or length.' });
            }
            // Check if custom alias already exists in DB
            const aliasCheck = await db.query('SELECT id FROM urls WHERE short_code = $1', [customAlias]);
            if (aliasCheck.rows.length > 0) {
                return res.status(409).json({ error: 'Custom alias already in use.' });
            }
        } else {
            // Generate unique ID using PostgreSQL sequence
            try {
                const sequenceResult = await db.query('SELECT nextval(\'urls_id_seq\') AS id;');
                uniqueId = sequenceResult.rows[0].id;
                console.log(`Unique ID: ${uniqueId}`);
                const obfuscatedId = optimus.encode(uniqueId);
                console.log(`Obfuscated ID: ${obfuscatedId}`);
                shortCode = toBase62(obfuscatedId);
                console.log(`Generated short code: ${shortCode}`);
            } catch (err) {
                console.error('Error getting nextval from sequence:', err);
                return res.status(500).json({ error: 'Failed to generate short URL' });
            }
        }

        // Handle expiration date
        let expiresAt = null;
        if (expirationDate) {
            // Basic validation
            const date = new Date(expirationDate);
            if (!isNaN(date)) {
                expiresAt = date.toISOString();
            } else {
                return res.status(400).json({ error: 'Invalid expiration date format.' });
            }
        } else {
            // Default expiration time is 1 year
            const defaultExpiration = new Date();
            defaultExpiration.setFullYear(defaultExpiration.getFullYear() + 1);
            expiresAt = defaultExpiration.toISOString();
        }

        // Insert into database
        let insertQuery;
        let queryParams;
        if (isCustom) {
            insertQuery = `
                INSERT INTO urls (short_code, long_url, expires_at)
                VALUES ($1, $2, $3)
                RETURNING short_code;
            `;
            queryParams = [shortCode, longUrl, expiresAt];
        } else {
            insertQuery = `
                INSERT INTO urls (id, short_code, long_url, expires_at)
                VALUES ($1, $2, $3, $4)
                RETURNING short_code;
            `;
            queryParams = [uniqueId, shortCode, longUrl, expiresAt];
        }
        const result = await db.query(insertQuery, queryParams);
        const generatedShortCode = result.rows[0].short_code;

        // Cache the new entry in Redis
        const cacheKey = `url:${generatedShortCode}`;
        await redisClient.set(cacheKey, longUrl);
        if (expiresAt) {
            // Set Redis expiration to match DB expiration
            const expiryTimestamp = Math.floor(new Date(expiresAt).getTime() / 1000);
            const nowTimestamp = Math.floor(Date.now() / 1000);
            if (expiryTimestamp > nowTimestamp) {
                await redisClient.expireAt(cacheKey, expiryTimestamp);
            } else {
                // Handle case where expiration is in the past
                await redisClient.del(cacheKey); // Delete if already expired
            }
        }

        // Return short URL
        const shortUrl = `${process.env.BASE_URL}/${generatedShortCode}`;
        res.status(201).json({ shortUrl, longUrl });

    } catch (error) {
        console.error('Error creating short URL:', error);
        // Handle potential duplicate key error
        if (error.code === '23505' && isCustom) { // PostgreSQL unique violation code
            return res.status(409).json({ error: 'Custom alias already in use.' });
        }
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});

module.exports = app;

