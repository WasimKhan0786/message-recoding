# 🎵 AudioFlow — Audio Sharing Platform & Admin Dashboard

AudioFlow is a modern, responsive audio listening, sharing, and learning web application. This repository contains the complete production-grade system:
- **Phase 1:** Responsive Foundation & Modern Web Aesthetics
- **Phase 2:** Secure Admin Authentication (bcrypt + express-session)
- **Phase 3:** Complete Admin Dashboard (Dark blue layout, real KPIs, link management)
- **Phase 4:** Filebase S3 Private Cloud Storage & FFmpeg 128 kbps Transcoding
- **Phase 5:** MongoDB Atlas Cloud Database with Mongoose Models & Write-Through Sync
- **Phase 6:** Granular Shared Links (Custom expiration, password protection, status toggling)
- **Phase 7:** Recipient Listening Page (`/listen/:slug`) with Waveform Visualizer & Telemetry
- **Phase 8:** Audio Understanding & Reflection System (Comprehension prompts & human review)
- **Phase 9:** Public Audio Streaming & Audio Download Protection (Short-lived tokens & Range 206)

---

## 🚀 Technology Stack

- **Frontend:**
  - **HTML5:** Semantic, accessible layout, audio elements with `controlsList="nodownload"`
  - **CSS3:** Custom properties (CSS variables), Flexbox, CSS Grid, dark glassmorphism, responsive tables, animations, and mobile-first responsive breakpoints
  - **Vanilla JavaScript (ES6+):** Lightweight DOM interactions, mobile drawer management, password visibility toggle, client-side form validation, asynchronous session management, dynamic dashboard rendering, modals, clipboard copy, sticky master player dock, and public audio catalog filtering
- **Backend:**
  - **Node.js & Express.js:** Web server serving static assets, sessions, and JSON REST API endpoints
  - **MongoDB Atlas & Mongoose:** Resilient cloud persistence for audios, recipients, shared links, activity logs, platform settings, and listener responses
  - **@aws-sdk/client-s3:** AWS SDK v3 client communicating with private Filebase S3 buckets via Signature Version 4
  - **fluent-ffmpeg & ffmpeg-static:** Automated audio conversion and 128 kbps MP3 compression
  - **bcryptjs:** Industry-standard password hashing (passwords are never stored in plain text)
  - **express-session:** Secure server-side sessions with HTTP-only cookies
  - **express-rate-limit:** IP-based sliding window rate limiting on sensitive login routes
  - **dotenv:** Environment variable configuration

---

## 📁 Project Folder Structure

```text
voice-recoding/
├── public/                     # Static client-side assets
│   ├── css/
│   │   ├── style.css           # Custom responsive styles & public audio card theme
│   │   ├── login.css           # Dedicated styles for Admin Login
│   │   └── admin.css           # Professional Dark-Blue Sidebar, Dashboard & Player Dock
│   ├── js/
│   │   ├── main.js             # Client JS: public catalog, sticky audio player & health check
│   │   ├── login.js            # Client JS: show/hide password, validation, login fetch
│   │   ├── listen.js           # Client JS: recipient player, comprehension form, lesson unlock
│   │   └── admin.js            # Client JS: dashboard controller, drag-drop upload, response review
│   ├── index.html              # Modern, responsive homepage with Public Audio Catalog
│   ├── login.html              # Branded Admin Login page
│   ├── listen.html             # Recipient audio listening & comprehension reflection page
│   └── admin.html              # Protected complete Admin Dashboard
├── src/                        # Modular backend architecture
│   ├── middleware/
│   │   ├── auth.js             # requireAuth & redirectIfAuthenticated middleware
│   │   ├── rateLimiter.js      # Express rate limiter for authentication routes
│   │   └── uploadMiddleware.js # Multer file upload filter (MP3, WAV, M4A up to 500MB)
│   ├── models/                 # Mongoose Data Models
│   │   ├── Audio.js            # Audio recording schema (S3 key, duration, understanding question)
│   │   ├── Recipient.js        # Contact/recipient records
│   │   ├── SharedLink.js       # Dynamic link tokens, expiration & password hash
│   │   ├── ListenerResponse.js # Listener comprehension reflections & admin review notes
│   │   ├── Activity.js         # Audit log records
│   │   └── Settings.js         # Platform configuration
│   ├── routes/
│   │   ├── authRoutes.js       # /api/auth (login, logout, session check)
│   │   ├── adminRoutes.js      # /api/admin (audios, S3 stream, recipients, links, reviews)
│   │   └── publicRoutes.js     # /api/public (catalog, stream token, HTTP Range streaming)
│   └── services/
│       ├── adminService.js     # Bcrypt credential hashing & verification
│       ├── dashboardService.js # High-performance data store & MongoDB sync
│       ├── ffmpegService.js    # FFmpeg 128 kbps MP3 conversion & duration detection
│       └── s3Service.js        # Filebase S3 client (PutObject, GetObject stream, DeleteObject)
├── scripts/                    # CLI Diagnostic & Verification Scripts
│   ├── test-platform.js        # End-to-end platform test (CRUD, S3, Links, Responses, Protection)
│   ├── test-filebase.js        # Safe Filebase S3 connection verification (HeadBucket)
│   ├── test-audio-upload.js    # Audio synthesis, FFmpeg transcoding & S3 upload test
│   └── test-db.js              # MongoDB Atlas connectivity & collection health check
├── tests/                      # Automated Integration Test Suites
│   ├── auth.test.js            # 10 authentication & protection test cases
│   └── dashboard.test.js       # 10 dashboard data, CRUD & zero-state test cases
├── uploads/temp/               # Temporary scratch directory for incoming audio processing
├── .env                        # Local environment variables (git-ignored)
├── .env.example                # Template for environment configuration
├── .gitignore                  # Git ignore rules for node_modules, .env, and temp files
├── package.json                # Project configuration, dependencies & scripts
├── package-lock.json           # Locked dependency versions
├── README.md                   # Setup guide and documentation
└── server.js                   # Express.js application, session setup & server bootstrap
```

---

## 🎧 Public Audio Catalog & Download Protection (Phase 9)

1. **Free Listening Without Login:** All uploaded recordings appear dynamically on the public homepage (`#explore`). Anyone can listen immediately without creating an account or logging in.
2. **Private Filebase S3 Storage:** The Filebase S3 bucket remains strictly private. S3 access keys, secret keys, and bucket names are never exposed to browsers or network logs.
3. **No Permanent S3 URLs:** The public API strips S3 keys and bucket identifiers. Only short-lived proxy stream URLs are provided.
4. **Short-Lived HMAC Stream Tokens:** Streaming URLs use time-limited HMAC-SHA256 signed access tokens (`/api/public/stream/:token`) valid for 15 minutes. Tampered or expired tokens return `403 Forbidden`.
5. **Direct Downloads Blocked:** Public download endpoints (`/api/public/audios/:id/download`) return `403 Forbidden`. Stream headers enforce `Content-Disposition: inline` and `X-Content-Type-Options: nosniff`.
6. **Hidden Download Options:** Audio elements include `controlsList="nodownload"`. Right-click context menus on player cards are disabled.
7. **HTTP Range 206 Streaming:** Full support for `Range: bytes=START-END` headers allows smooth scrubbing, pause, resume, and instant replay.

> [!NOTE]
> Standard browser media playback cannot be made 100% mathematically impossible to record or capture by client-side recording tools. AudioFlow enforces server-side token authorization, hides download buttons, disables native download menus, and blocks direct download endpoints without making claims of complete capture prevention.

---

## 💡 Audio Understanding & Response System (Phase 8)

1. **Post-Lesson Comprehension Check:** Upon audio completion (or reaching 98%), the listener comprehension section unlocks automatically.
2. **Listener Reflection Input:** Listeners summarize their takeaways in their own words via a multi-line textarea with live word count tracking.
3. **Editable Submissions:** Listeners can revise and edit their response both before and after initial submission.
4. **Sequential Lesson Unlocking:** The next audio lesson is unlocked **only** after playback completion and response submission.
5. **Admin Dashboard Review (No Automated AI Judgment):** Admins review reflections in the Admin Dashboard, inspect the question asked, add internal review notes, and toggle the review status between *Pending* and *Reviewed*. All responses are evaluated by humans, never rejected by AI.
6. **Session-Scoped Privacy:** Public response endpoints (`GET /api/listen/:slug/response`) are strictly scoped to the visitor's session, ensuring listeners never see other users' responses.

---

## 🎵 Audio Upload & FFmpeg Engine (Phase 4)

- **Supported Formats:** Upload `.mp3`, `.wav`, and `.m4a` files.
- **Automatic FFmpeg Transcoding:** Automatically converts and compresses incoming audio to standard **MP3 at 128 kbps** (44.1 kHz, stereo) using `@ffmpeg-static/ffmpeg`.
- **Extended Recording Support:** Supports 12, 15, and 30+ minute recordings with file limits up to 500 MB.
- **Direct S3 Decentralized Upload:** Uploads directly to private Filebase S3 bucket (`audioflow-storage`) via `PutObjectCommand`.
- **HTTP 206 Range Streaming:** Audio streams through backend proxy endpoints with byte-range seeking support.

---

## 📊 Complete Admin Dashboard Sections (Phase 3)

The dashboard is accessible at `/admin` (protected by admin authentication):

1. **Dashboard Overview:** 6 real KPI cards (Total Audios, Storage, Links, Today's Clicks, Total Clicks, Completed Listens), quick actions, and mini activity feed.
2. **Audio Library:** Audio management with search, genre filtering, playback, metadata editing, and deletion.
3. **Listener Responses:** Dedicated review hub for listener comprehension reflections with review notes and status management.
4. **Recipients Management:** Contact registry for trackable distribution.
5. **Shared Links:** Generate trackable sharing links with custom expiration (24h, 7d, 30d, permanent) and bcrypt password protection.
6. **Recent Activity:** Audit trail of operations, logins, and link events.
7. **Link Click Tracking:** IP address, device / User Agent, referrer, and timestamps for link visits.
8. **Listening Progress:** Telemetry tracking listening duration and completion percentages.
9. **Settings:** Platform preferences, admin contact email, and password change.
10. **Logout:** Destroys server-side session, clears session cookie, and returns to `/login.html`.

---

## ⚙️ Environment Configuration

Create a `.env` file in the project root:

```env
PORT=3000
NODE_ENV=development
SESSION_SECRET=your_super_secret_session_key_here_at_least_32_characters

# Default Admin Credentials
ADMIN_EMAIL=admin@audioflow.local
ADMIN_PASSWORD=AudioFlowAdmin2026!

# MongoDB Atlas
MONGODB_URI=mongodb+srv://<username>:<password>@cluster0.mongodb.net/audioflow?retryWrites=true&w=majority

# Filebase S3 Decentralized Storage
S3_ENDPOINT=https://s3.filebase.io
S3_REGION=auto
S3_BUCKET=audioflow-storage
S3_ACCESS_KEY_ID=your_filebase_access_key
S3_SECRET_ACCESS_KEY=your_filebase_secret_key
```

---

## 🚀 Running the Project

```bash
# 1. Install dependencies
npm install

# 2. Start the server
npm start

# 3. Development mode with auto-reload
npm run dev
```

Visit:
- **Homepage (Public Streaming):** `http://localhost:3000`
- **Admin Login:** `http://localhost:3000/login`
- **Admin Dashboard:** `http://localhost:3000/admin`
- **Health-Check API:** `http://localhost:3000/api/health`

---

## 🧪 Automated Test Verification

```bash
# 1. Full Platform End-to-End Test (CRUD, S3, MongoDB, Links, Responses, Protection)
npm run test:platform

# 2. Integration Test Suites (Authentication & Dashboard Security)
npm test

# 3. Audio Transcoding & Filebase S3 Streaming Verification
npm run test:audio

# 4. Standalone Filebase S3 Connectivity Verification
npm run test:filebase

# 5. Standalone MongoDB Connection & Collection Ping
npm run test:db
```

---

## 🎵 Audio Upload & Processing Engine (Phase 4)

- **Supported Formats:** Upload `.mp3`, `.wav`, and `.m4a` files.
- **Automatic FFmpeg Transcoding:** Automatically converts and compresses any incoming audio file to standard **MP3 at 128 kbps** (44.1 kHz, stereo) using `@ffmpeg-static/ffmpeg`.
- **Extended Recording Support:** Supports 12, 15, and 30+ minute recordings with file limits up to 500 MB and 15-minute connection timeouts.
- **Direct S3 Decentralized Upload:** Processed MP3s are uploaded directly to the Filebase S3 bucket (`audioflow-storage`) via `PutObjectCommand`.
- **Secure Audio Streaming:** Audio files are streamed back through backend proxy endpoints (`/api/admin/audios/:id/stream`) with HTTP 206 Partial Content (Range request) support for instant scrubbing without exposing S3 credentials.
- **Audio Preview Player:** Floating audio player dock integrated into the Admin Dashboard for instant inline playback.

---

## 📊 Dashboard Sections (Phase 3)

The dashboard is accessible at `/admin` (protected by admin authentication) and features a professional dark-blue sidebar navigation:

1. **Dashboard Overview:**
   - 6 Responsive KPI Cards displaying strictly real backend data (0s when empty):
     - **Total Audios**
     - **Total Recipients**
     - **Active Links**
     - **Today's Clicks**
     - **Total Clicks**
     - **Completed Listens**
   - Quick activity feed and quick action cards.
2. **Audio Library:** Catalog audio records with title, genre, format, and duration. Clean empty state when empty.
3. **Recipients Management:** Register recipient contacts, email addresses, and groups for trackable sharing.
4. **Shared Links:** Generate trackable audio links with unique token slugs, expiration dates, and one-click copy URL.
5. **Recent Activity:** Real-time audit trail of administrative operations and link interactions.
6. **Link Click Tracking:** Detailed log showing IP address, device / User Agent, referrer, and timestamps for link visits.
7. **Listening Progress:** Telemetry tracking recipient listening duration and completion percentages.
8. **Settings:** Platform name, admin notification email, session duration, and click logging preferences.
9. **Logout:** Securely invalidates server-side session, clears session cookie, and returns to `/login.html`.

---

## 🔐 Security Features (Phase 2)

1. **Bcrypt Password Hashing:**
   - The initial admin credentials are provided via environment variables (`ADMIN_EMAIL` and `ADMIN_PASSWORD`).
   - On server startup, `ADMIN_PASSWORD` is hashed using `bcrypt` (10 salt rounds) into memory. Plain-text passwords are never retained.
2. **No Public Registration:**
   - No public admin registration endpoint or page exists.
3. **Secure Server-Side Sessions:**
   - Uses `express-session` with the following cookie configuration:
     - `httpOnly: true` (prevents client-side XSS cookie theft)
     - `sameSite: 'lax'` (provides CSRF protection)
     - `secure: true` (in production environments with HTTPS)
     - Session ID regeneration upon login to eliminate session fixation vulnerabilities.
4. **Protected Routes:**
   - Both web routes (`/admin`, `/admin.html`) and API endpoints (`/api/admin/*`) require an active session. Unauthenticated users are redirected to `/login.html` with a return URL (`?redirect=/admin`).
5. **Rate Limiting:**
   - The `/api/auth/login` endpoint is protected by an IP rate limiter allowing at most 10 login attempts per 15-minute window, responding with HTTP `429 Too Many Requests`.
6. **Show / Hide Password:**
   - Accessible toggle button inside the password field with visual eye icons.
7. **Session Invalidation on Logout:**
   - The Logout button calls `POST /api/auth/logout`, completely destroying the server-side session and clearing the `audioflow.sid` cookie.

---

## 🛠️ Setup & Running Locally

### 1. Prerequisites

Ensure **Node.js** (v18+ or v20+) and **npm** are installed:
```bash
node -v
npm -v
```

### 2. Environment Variables Setup

Copy `.env.example` to `.env`:
```bash
# On Windows PowerShell
Copy-Item .env.example .env

# On Linux/macOS
cp .env.example .env
```

Your `.env` file should contain:
```env
PORT=3000
NODE_ENV=development
SESSION_SECRET=audioflow_super_secret_session_key_minimum_32_characters

# Default Admin Credentials
ADMIN_EMAIL=admin@audioflow.local
ADMIN_PASSWORD=AudioFlowAdmin2026!

# Filebase S3 Storage Configuration
S3_BUCKET=your_filebase_bucket_name
S3_ACCESS_KEY_ID=your_filebase_access_key
S3_SECRET_ACCESS_KEY=your_filebase_secret_key
S3_ENDPOINT=https://s3.filebase.io
S3_REGION=auto
```

### 3. Verify Filebase S3 Connection (Read-Only)

Run the safe connection diagnostic script to verify bucket access via `HeadBucketCommand`:
```bash
npm run test:filebase
```
*(Or directly: `node scripts/test-filebase.js`)*

---

### 4. Verify Audio Upload & Conversion Pipeline

Run the automated audio pipeline verification script (synthesizes audio, transcodes to 128 kbps MP3, uploads to Filebase, tests streaming, and cleans up):
```bash
npm run test:audio
```
*(Or directly: `node scripts/test-audio-upload.js`)*

---

### 5. Start the Application

- **Production Mode:**
  ```bash
  npm start
  ```

- **Development Mode (Auto-reload on file changes):**
  ```bash
  npm run dev
  ```

When started, the terminal displays:
```text
====================================================
🎵 AudioFlow Web Application (Phase 2 - Admin Auth)
🚀 Server running at: http://localhost:3000
🔐 Admin Login:       http://localhost:3000/login
🛡️  Admin Protected:   http://localhost:3000/admin
🩺 Health-Check API:  http://localhost:3000/api/health
====================================================
```

---

## 🧪 Testing the Admin Authentication

### Test Case 1: Unauthenticated Protected Route Access
1. Open an incognito browser window.
2. Navigate directly to `http://localhost:3000/admin`.
3. **Expected result:** You are immediately redirected to `http://localhost:3000/login.html?redirect=%2Fadmin`.
4. Try requesting the protected API:
   ```bash
   curl -i http://localhost:3000/api/admin/me
   ```
   **Expected result:** `HTTP 401 Unauthorized` with JSON error.

### Test Case 2: Incorrect Password
1. Navigate to `http://localhost:3000/login`.
2. Enter email: `admin@audioflow.local` and an incorrect password: `WrongPassword123!`.
3. Click **Sign In to Admin**.
4. **Expected result:** An animated red alert box appears with `"Invalid email or password."` and the password field highlights in red.

### Test Case 3: Show / Hide Password
1. In the password field, type any characters.
2. Click the eye icon toggle button on the right side of the input.
3. **Expected result:** The password text switches between obscured (`••••••`) and plain text, and the icon toggles.

### Test Case 4: Successful Login
1. Enter your configured credentials:
   - **Email:** `admin@audioflow.local`
   - **Password:** `AudioFlowAdmin2026!` *(or whatever you set in your `.env`)*
2. Click **Sign In to Admin**.
3. **Expected result:** A green success notification appears (`"Authentication successful! Redirecting..."`) and redirects you to the protected `/admin` view.

### Test Case 5: Verified Session & Logout
1. On the `/admin` view, observe your authenticated email (`admin@audioflow.local`) and session status.
2. Click the **Sign Out / Destroy Session** button.
3. **Expected result:** The server destroys the session, clears the session cookie, and redirects you back to `/login.html`. Attempting to visit `/admin` again will redirect to `/login.html`.

### Test Case 6: Rate Limiting
1. Submit incorrect credentials 10 consecutive times to `http://localhost:3000/api/auth/login`.
2. **Expected result:** The server blocks further attempts with `HTTP 429 Too Many Requests` (`"Too many login attempts from this IP. Please try again after 15 minutes."`).

---

## 🧪 Automated Test Verification

AudioFlow includes automated integration and end-to-end verification suites:

```bash
# 1. Full Platform End-to-End Test (Audio CRUD, S3, MongoDB, Links, Password & Streaming)
npm run test:platform

# 2. Integration Test Suites (Authentication & Dashboard Security)
npm test

# 3. Audio Transcoding & Filebase S3 Streaming Verification
npm run test:audio

# 4. Standalone Filebase S3 Connectivity Verification
npm run test:filebase

# 5. Standalone MongoDB Connection & Collection Ping
npm run test:db
```

---

## 🔒 Security Architecture

1. **Private Filebase S3 Bucket**: Audio files are stored in a private bucket. Raw S3 URLs, AWS access credentials, and secret keys are never exposed to client browsers or network logs.
2. **HTTP 206 Partial Content Range Streaming**: Audio streams on demand through authenticated and validated backend endpoints (`/api/listen/:slug/stream`), supporting instant seeking, scrubbing, and pause/resume without downloading raw audio files.
3. **Bcrypt Password Protection**: Both admin logins and optional shared link passwords are encrypted using `bcrypt` (10 salt rounds) with constant-time dummy comparisons to prevent timing attacks.
4. **Distraction-Free Public Player**: The recipient listening page (`/listen/:slug`) suppresses browser download prompts (`controlsList="nodownload"` and right-click protection), and tracks listening progress telemetry.
5. **Session Security**: Admin sessions use HTTP-only, secure, `SameSite=Lax` cookies with IP sliding window rate limiters.

# message-recoding
