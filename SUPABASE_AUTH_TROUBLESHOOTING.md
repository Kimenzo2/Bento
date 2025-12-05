# Supabase Authentication Troubleshooting Guide

## Quick Setup Checklist

Before troubleshooting, ensure these are configured in **Supabase Dashboard**:

### 1. URL Configuration (Authentication → URL Configuration)
- **Site URL**: `http://localhost:5174` (for dev) or your production URL
- **Redirect URLs** (add ALL of these):
  - `http://localhost:5173`
  - `http://localhost:5173/**`
  - `http://localhost:5174`
  - `http://localhost:5174/**`
  - `http://localhost:5175`
  - `http://localhost:5175/**`
  - Your production URL (e.g., `https://yourapp.vercel.app`)
  - `https://yourapp.vercel.app/**`

### 2. Email Provider (Authentication → Providers → Email)
- ✅ **Enabled**: ON
- ✅ **Confirm email**: Your preference (ON for production, OFF for testing)

### 3. Google Provider (Authentication → Providers → Google)
- ✅ **Enabled**: ON
- ✅ **Client ID**: From Google Cloud Console
- ✅ **Client Secret**: From Google Cloud Console  
- ✅ **Client IDs** (for One Tap): Your Google Web Client ID

---

## Issue #1: "Invalid API key" Error on Email Signup

This error occurs when Supabase email authentication is not properly configured. Here's how to fix it:

### Steps to Fix:

1. **Go to your Supabase Dashboard**
   - Navigate to: https://supabase.com/dashboard/project/qjjocfnqwtccuxbnoult

2. **Enable Email Provider**
   - Go to **Authentication** → **Providers**
   - Find **Email** provider
   - Make sure it's **ENABLED**
   - Click **Save**

3. **Configure Email Settings**
   - Go to **Authentication** → **Settings**
   - Under **Email Auth**, ensure:
     - ✅ **Enable email signups** is checked
     - ✅ **Confirm email** is checked (recommended) or unchecked (for testing)
   - Click **Save**

4. **Check Site URL**
   - Go to **Authentication** → **URL Configuration**
   - Set **Site URL** to: `http://localhost:5173` (for development)
   - Add **Redirect URLs**:
     - `http://localhost:5173`
     - `http://localhost:5173/**`
   - Click **Save**

5. **Verify Email Templates** (Optional)
   - Go to **Authentication** → **Email Templates**
   - Ensure templates are configured (default templates should work)

---

## Issue #2: Google Sign-In Not Redirecting to Dashboard

### Steps to Fix:

1. **Enable Google OAuth Provider**
   - Go to **Authentication** → **Providers**
   - Find **Google** provider
   - Click **Enable**
   - You'll need to provide:
     - **Client ID** (from Google Cloud Console)
     - **Client Secret** (from Google Cloud Console)

2. **Set up Google Cloud Console** (if not done)
   - Go to: https://console.cloud.google.com/
   - Create a new project or select existing
   - Enable **Google+ API**
   - Go to **Credentials** → **Create Credentials** → **OAuth 2.0 Client ID**
   - Application type: **Web application**
   - Add **Authorized redirect URIs**:
     - `https://qjjocfnqwtccuxbnoult.supabase.co/auth/v1/callback`
   - Copy **Client ID** and **Client Secret**
   - Paste them into Supabase Google provider settings

3. **Configure Redirect URLs in Supabase**
   - Go to **Authentication** → **URL Configuration**
   - Add to **Redirect URLs**:
     - `http://localhost:5173`
     - Your production URL (when deployed)

4. **Test the Flow**
   - Clear browser cache and cookies
   - Try signing in with Google again
   - After Google consent, you should be redirected back to your app

---

## Quick Test Checklist

- [ ] Email provider is enabled in Supabase
- [ ] Site URL is set to `http://localhost:5173`
- [ ] Redirect URLs include `http://localhost:5173`
- [ ] Google provider is enabled (if using Google OAuth)
- [ ] Google OAuth credentials are configured
- [ ] Browser cache is cleared

---

## Issue #3: Google One Tap "Invalid API key" Error (401)

This error occurs when using Google One Tap (`signInWithIdToken`) and the Google Client ID is not configured in Supabase.

### Error Message:
```
POST https://xxxxx.supabase.co/auth/v1/token?grant_type=id_token 401
Sign-in failed: Invalid API key
```

### Root Cause:
Google One Tap uses `signInWithIdToken()` which requires Supabase to validate the Google ID token. This is **different** from standard OAuth flow and requires a specific configuration.

### Steps to Fix:

1. **Get your Google Web Client ID**
   - Go to: https://console.cloud.google.com/apis/credentials
   - Find your **OAuth 2.0 Client ID** (Web application type)
   - Copy the **Client ID** (looks like `123456789-xxxxx.apps.googleusercontent.com`)

2. **Configure Supabase**
   - Go to: **Supabase Dashboard** → **Authentication** → **Providers** → **Google**
   - Scroll down to the **"Client IDs"** field (this is DIFFERENT from OAuth Client ID/Secret!)
   - Paste your Google Web Client ID there
   - Click **Save**

3. **Configure Environment Variable**
   - Add to your `.env` file:
     ```
     VITE_GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
     ```
   - Add to **Vercel** → **Settings** → **Environment Variables** (for production)

4. **Important Notes**:
   - The "Client IDs" field in Supabase is specifically for native/One Tap sign-in
   - You can have multiple Client IDs (comma-separated) for different platforms
   - The OAuth Client ID/Secret fields are for the traditional redirect-based OAuth flow

5. **Restart your development server** after changing `.env`

---

## Common Errors and Solutions

### "Invalid API key" on Google One Tap
- **Cause**: Google Client ID not configured in Supabase "Client IDs" field
- **Fix**: See Issue #3 above - add your Google Web Client ID to Supabase → Authentication → Providers → Google → "Client IDs" field

### "Invalid API key" on Email Sign-In
- **Cause**: Email auth not enabled in Supabase
- **Fix**: Enable Email provider in Authentication → Providers

### "Email not confirmed"
- **Cause**: Email confirmation is required
- **Fix**: Check your email for confirmation link, or disable email confirmation in Supabase settings (for testing only)

### Google OAuth redirects but doesn't log in
- **Cause**: Redirect URL mismatch or missing auth state listener
- **Fix**: Ensure redirect URLs are configured correctly and `onAuthStateChange` is working (already implemented in AuthContext)

### "User already registered"
- **Cause**: Trying to sign up with an email that already exists
- **Fix**: Use "Sign In" instead of "Sign Up"

---

## Testing Commands

```bash
# Check if Supabase client is initialized
# Open browser console and run:
console.log(window.location.origin)
# Should output: http://localhost:5173

# Check environment variables
# In your terminal:
echo $VITE_SUPABASE_URL
echo $VITE_SUPABASE_ANON_KEY
```

---

## Need More Help?

If issues persist:
1. Check Supabase logs: Dashboard → Logs → Auth Logs
2. Check browser console for detailed error messages
3. Verify your `.env` file has the correct Supabase URL and anon key
