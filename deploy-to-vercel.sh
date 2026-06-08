#!/usr/bin/env bash
# ============================================================
# Control de Asistencia - Vercel Deployment Helper
# ============================================================
# This script helps you deploy your application to Vercel
# ============================================================

set -e

echo "🚀 Control de Asistencia - Vercel Deployment Helper"
echo "===================================================="
echo ""

# Check if Vercel CLI is installed
if ! command -v vercel &> /dev/null; then
  echo "📦 Installing Vercel CLI..."
  npm install -g vercel
fi

# Step 1: Verify environment
echo "📋 Step 1: Verifying project structure..."
if [ ! -f "package.json" ]; then
  echo "❌ Error: package.json not found. Run this from the project root."
  exit 1
fi
echo "✅ Project structure OK"

# Step 2: Check for Supabase credentials
echo ""
echo "📋 Step 2: Checking Supabase credentials..."
echo ""
echo "⚠️  IMPORTANT: You need the following Supabase API keys (NOT the publishable key):"
echo ""
echo "   1. NEXT_PUBLIC_SUPABASE_URL"
echo "      → Found in: Supabase Dashboard > Project Settings > API > Project URL"
echo "      → Format: https://xxxxxxxxxxxxx.supabase.co"
echo ""
echo "   2. NEXT_PUBLIC_SUPABASE_ANON_KEY"  
echo "      → Found in: Supabase Dashboard > Project Settings > API > Project API keys > anon public"
echo "      → Format: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
echo ""
echo "   3. SUPABASE_SERVICE_ROLE_KEY"
echo "      → Found in: Supabase Dashboard > Project Settings > API > Project API keys > service_role secret"
echo "      → Format: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
echo "      → ⚠️  KEEP THIS SECRET!"
echo ""

# Step 3: Login to Vercel
echo "📋 Step 3: Logging in to Vercel..."
vercel login

# Step 4: Deploy
echo ""
echo "📋 Step 4: Deploying to Vercel..."
echo ""
echo "When prompted by Vercel:"
echo "  - Link to existing project? No (new account)"
echo "  - Project name: control-de-asistencia (or your preference)"
echo "  - Framework: Next.js (auto-detected)"
echo "  - Build Command: prisma generate && next build"
echo "  - Output Directory: .next"
echo ""

vercel --yes

# Step 5: Set environment variables
echo ""
echo "📋 Step 5: Setting environment variables..."
echo ""
echo "You need to add the following environment variables in Vercel:"
echo "  Dashboard > Your Project > Settings > Environment Variables"
echo ""
echo "  NEXT_PUBLIC_SUPABASE_URL = <your-project-url>"
echo "  NEXT_PUBLIC_SUPABASE_ANON_KEY = <your-anon-key>"
echo "  SUPABASE_SERVICE_ROLE_KEY = <your-service-role-key>"
echo ""
echo "Or use the CLI:"
echo ""
echo "  vercel env add NEXT_PUBLIC_SUPABASE_URL"
echo "  vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY"
echo "  vercel env add SUPABASE_SERVICE_ROLE_KEY"
echo ""

read -p "Do you want to add environment variables now? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
  echo ""
  read -p "Enter NEXT_PUBLIC_SUPABASE_URL: " SUPABASE_URL
  read -p "Enter NEXT_PUBLIC_SUPABASE_ANON_KEY: " SUPABASE_ANON_KEY
  read -p "Enter SUPABASE_SERVICE_ROLE_KEY: " SUPABASE_SERVICE_KEY

  if [ -n "$SUPABASE_URL" ]; then
    echo "$SUPABASE_URL" | vercel env add NEXT_PUBLIC_SUPABASE_URL production preview development
  fi
  if [ -n "$SUPABASE_ANON_KEY" ]; then
    echo "$SUPABASE_ANON_KEY" | vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY production preview development
  fi
  if [ -n "$SUPABASE_SERVICE_KEY" ]; then
    echo "$SUPABASE_SERVICE_KEY" | vercel env add SUPABASE_SERVICE_ROLE_KEY production preview development
  fi

  echo ""
  echo "✅ Environment variables set!"
fi

# Step 6: Redeploy with env vars
echo ""
echo "📋 Step 6: Redeploying with environment variables..."
vercel --prod

echo ""
echo "===================================================="
echo "🎉 Deployment complete!"
echo ""
echo "Your app should now be live on Vercel."
echo ""
echo "If you need to set up the Supabase database tables,"
echo "run the SQL from /api/supabase-migration?action=export-sql"
echo "in the Supabase SQL Editor."
echo "===================================================="
