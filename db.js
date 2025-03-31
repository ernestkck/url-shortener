// db.js
const { Pool } = require('pg');

const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_DATABASE,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT,
    ssl: {
        rejectUnauthorized: false
    }
});


pool.on('connect', () => {
    console.log('Connected to PostgreSQL database');
});

// Function to create the table if it doesn't exist
const createTable = async () => {
    const queryText = `
        CREATE TABLE IF NOT EXISTS urls (
            id SERIAL PRIMARY KEY,
            short_code VARCHAR(20) UNIQUE NOT NULL,
            long_url TEXT NOT NULL,
            created_at TIMESTAMPTZ DEFAULT NOW(),
            expires_at TIMESTAMPTZ
        );
        -- Optional: Index for faster lookups by short_code
        CREATE INDEX IF NOT EXISTS idx_short_code ON urls(short_code);
        -- Optional: Index for checking if long_url exists (might be slow on large tables)
        -- CREATE INDEX IF NOT EXISTS idx_long_url ON urls(long_url);
    `;
    try {
        await pool.query(queryText);
        console.log('URLs table checked/created successfully.');
    } catch (err) {
        console.error('Error creating table:', err.stack);
    }
};

module.exports = {
    query: (text, params) => pool.query(text, params),
    createTable, // Export the function
};