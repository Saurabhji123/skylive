#!/bin/bash

# SKYLIVE CINEMA - Environment Verification Script
# Run this to check if your production environment is correctly configured

echo "🔍 SKYLIVE CINEMA - Production Environment Check"
echo "================================================"
echo ""

# Check Backend
echo "📡 Checking Backend (Railway)..."
BACKEND_URL="https://skylive-backend-production.up.railway.app"

echo "  Testing root endpoint..."
curl -s -o /dev/null -w "  Status: %{http_code}\n" "$BACKEND_URL/"

echo "  Testing health endpoint..."
HEALTH=$(curl -s "$BACKEND_URL/health")
echo "  $HEALTH"

echo ""

# Check Frontend
echo "🌐 Checking Frontend (Vercel)..."
FRONTEND_URL="https://skylive-cinema.vercel.app"

echo "  Testing homepage..."
curl -s -o /dev/null -w "  Status: %{http_code}\n" "$FRONTEND_URL/"

echo ""

# Check CORS
echo "🔒 Testing CORS..."
curl -s -H "Origin: https://skylive-cinema.vercel.app" \
     -H "Access-Control-Request-Method: GET" \
     -H "Access-Control-Request-Headers: Content-Type" \
     -X OPTIONS \
     -I "$BACKEND_URL/health" 2>&1 | grep -i "access-control"

echo ""
echo "================================================"
echo "✅ Environment check complete!"
echo ""
echo "If you see errors above, check:"
echo "  1. Railway environment variables (CLIENT_ORIGIN)"
echo "  2. Vercel environment variables (NEXT_PUBLIC_*)"
echo "  3. MongoDB Atlas connection"
echo "  4. Railway deployment logs"
echo ""
