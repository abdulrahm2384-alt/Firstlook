#!/bin/bash

# Configuration
BASE_URL="${APP_URL:-http://localhost:3000}"
SECRET="${FOREX_API_SECRET:-FL-SECURE-API-SECRET-182390234123512}"

# Text colors
GREEN='\033[0;32m'
RED='\033[0;31m'
BLUE='\033[0;34m'
YELLOW='\033[0;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

echo -e "${CYAN}====================================================${NC}"
echo -e "${CYAN}   FIRSTLOOK ADMIN API INTERFACES INTEGRATION TESTER${NC}"
echo -e "${CYAN}====================================================${NC}"
echo -e "Target Base URL: ${YELLOW}${BASE_URL}${NC}"
echo -e "Admin API Key  : ${YELLOW}${SECRET:0:15}... (hidden)${NC}"
echo -e ""
echo -e "Tip: You can override these variables like so:"
echo -e "     APP_URL=\"https://your-live-deployment.com\" FOREX_API_SECRET=\"your-secret\" ./test_admin_api.sh"
echo -e ""

test_endpoint() {
    local method="$1"
    local endpoint="$2"
    local full_url="${BASE_URL}${endpoint}"
    
    echo -e "${BLUE}----------------------------------------------------${NC}"
    echo -e "Testing: ${GREEN}${method} ${endpoint}${NC}"
    echo -e "Executing: curl -s -H \"Authorization: Bearer <secret>\" \"${full_url}\""
    
    # Run curl instruction
    local response
    response=$(curl -s -w "\nHTTP_STATUS:%{http_code}" -H "Authorization: Bearer ${SECRET}" "${full_url}")
    
    # Extract HTTP status
    local http_status
    http_status=$(echo "$response" | tail -n1 | cut -d':' -f2)
    
    # Extract Body
    local body
    body=$(echo "$response" | sed '$d')
    
    # Output Results
    if [ "$http_status" -eq 200 ]; then
        echo -e "Status: ${GREEN}${http_status} OK${NC}"
        echo -e "Response Body:"
        if command -v jq &> /dev/null; then
            echo "$body" | jq .
        else
            echo "$body"
        fi
    else
        echo -e "Status: ${RED}${http_status} FAILED${NC}"
        echo -e "Response Body:"
        if echo "$body" | grep -q "{" 2>/dev/null; then
            if command -v jq &> /dev/null; then
                echo "$body" | jq .
            else
                echo "$body"
            fi
        else
            echo "$body"
        fi
    fi
    echo ""
}

# Run the suites of admin endpoints
test_endpoint "GET" "/api/admin/dashboard"
test_endpoint "GET" "/api/admin/finance/overview"
test_endpoint "GET" "/api/admin/finance/revenue-by-plan"
test_endpoint "GET" "/api/admin/finance/payments?page=1&limit=2"
test_endpoint "GET" "/api/admin/finance/revenue-trends"
test_endpoint "GET" "/api/admin/users/overview"
test_endpoint "GET" "/api/admin/users/list?page=1&limit=2"
test_endpoint "GET" "/api/admin/users/demographics"
test_endpoint "GET" "/api/admin/users/growth"
test_endpoint "GET" "/api/admin/subscriptions/overview"
test_endpoint "GET" "/api/admin/subscriptions/expiring"
test_endpoint "GET" "/api/admin/audit-logs?limit=3"

echo -e "${CYAN}====================================================${NC}"
echo -e "${GREEN}Admin API test suite execution complete.${NC}"
echo -e "${CYAN}====================================================${NC}"
