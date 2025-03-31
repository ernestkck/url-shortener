const BASE62_CHARS = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";

function toBase62(num) {
    if (num === 0) return BASE62_CHARS[0];
    let base62 = '';
    while (num > 0) {
        base62 = BASE62_CHARS[num % 62] + base62;
        num = Math.floor(num / 62);
    }
    return base62;
}

function toBase10(base62) {
    let num = 0;
    for (const char of base62) {
        num = num * 62 + BASE62_CHARS.indexOf(char);
    }
    return num;
}

module.exports = { toBase62, toBase10 };