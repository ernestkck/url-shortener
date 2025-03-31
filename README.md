# URL Shortener

A fast URL shortening service that creates unique, randomised short URLs with customisable aliases and expiration, built with Node.js and hosted on AWS.

## Features

- **Custom Aliases**: Create branded or memorable short links
- **Expiration Control**: Set custom expiration dates or use the default 1-year lifespan
- **Fast redirects with in-memory cache**: Amazon ElastiCache for Redis is used for caching
- **Unique and randomised URLs**: Unique counter with ID obfuscation to guarantee collision-free and randomised URL generation
- **High availability and scalability**: PostgreSQL database on Amazon RDS
- **Base62 Encoding**: Creates short, alphanumeric codes for all URLs

## Tech Stack

- **Backend**: Node.js with Express
- **Database**: PostgreSQL
- **Caching**: Redis
- **Libraries**: 
  - [optimus-js](https://www.npmjs.com/package/optimus-js) (ID obfuscation)
  - valid-url (URL validation)
  - dotenv (environment configuration)

## Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/ernestkck/url-shortener.git
   cd url-shortener
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure environment variables**
   - Copy `.env.example` to .env (create this file based on the variables below)
   - Update the values to match your environment

4. **Start the server**
   ```bash
   # Development mode with auto-reload
   npm run dev
   
   # Production mode
   npm start # or pm2 start src/server.js
   ```

## Environment Variables

Create a .env file in the project root with these variables:

```
# PostgreSQL Configuration
DB_HOST=your_postgres_host
DB_PORT=5432
DB_USER=your_username
DB_PASSWORD=your_password
DB_DATABASE=your_database

# Redis Configuration
REDIS_HOST=your_redis_host
REDIS_PORT=6379

# Application Configuration
PORT=3000
BASE_URL=your_url:3000

# Optimus Configuration (Generate your own values)
OPTIMUS_PRIME=2123809381
OPTIMUS_INVERSE=1885413229
OPTIMUS_RANDOM=146808189
```

## API Documentation

### Create a Short URL

**Endpoint:** `POST /urls`

**Request Body:**
```json
{
  "longUrl": "https://example.com/very/long/path",
  "customAlias": "mylink",       // Optional
  "expirationDate": "2026-04-01" // Optional (ISO 8601 date)
}
```

**Response:**
```json
{
  "shortUrl": "http://your_url:3000/xyz123",
  "longUrl": "https://example.com/very/long/path"
}
```

### Access a Short URL

**Endpoint:** `GET /:shortCode`

This endpoint redirects to the original URL or returns appropriate status codes:
- `302`: Redirect to the original URL
- `404`: Short URL not found
- `410`: Short URL has expired

## Testing

A simple shell script is included for basic API testing:

```bash
cd tests
chmod +x apiTest.sh
./apiTest.sh
```

## License

This project is licensed under the MIT License - see the LICENSE file for details.
