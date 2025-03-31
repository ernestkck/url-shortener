#!/bin/bash
# Simple API Tests

BASE_URL="http://localhost:3000"
LONG_URL_1="https://www.google.com/search?q=test1"
LONG_URL_2="https://www.google.com/search?q=test2"

echo "Testing POST /urls (no custom alias)"
curl -X POST -H "Content-Type: application/json" \
     -d "{\"longUrl\": \"$LONG_URL_1\"}" \
     "$BASE_URL/urls"
echo -e "\n---"

# echo "Testing POST /urls (with custom alias)"
# ALIAS="test-$(date +%s | tail -c 9)"
# curl -X POST -H "Content-Type: application/json" \
#      -d "{\"longUrl\": \"$LONG_URL_2\", \"customAlias\": \"$ALIAS\"}" \
#      "$BASE_URL/urls"
# echo -e "\n---"

# echo "Testing GET /$ALIAS (should redirect)"
# REDIRECT_TARGET=$(curl -s -o /dev/null -w '%{redirect_url}' "$BASE_URL/$ALIAS")
# echo "Redirected to: $REDIRECT_TARGET"
# if [ "$REDIRECT_TARGET" == "$LONG_URL_2" ]; then
#     echo "Redirect target matches expected URL ($LONG_URL_2)."
# else
#     echo "WARNING: Redirect target does NOT match expected URL!"
#     echo "  Expected: $LONG_URL_2"
#     echo "  Got: $REDIRECT_TARGET"
# fi
# echo -e "\n---"

# echo "Testing GET /nonexistent (should be 404)..."
# STATUS_CODE=$(curl -s -o nul -w '%{http_code}' "$BASE_URL/nonexistent")
# echo "Status Code: $STATUS_CODE"
# if [ "$STATUS_CODE" == "404" ]; then
#     echo "Status code is 404 (Not Found) as expected."
# else
#     echo "WARNING: Status code is NOT 404!"
# fi
# echo -e "\n---"