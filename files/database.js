const { Pool } = require('pg');

function createPool() {
  return new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 20,
    idleTimeoutMillis: 30000,
  });
}

async function initializeDatabase(pool) {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE EXTENSION IF NOT EXISTS pgcrypto;
      CREATE EXTENSION IF NOT EXISTS postgis;

      -- ═══════════════════════════════════════════════════════
      --  USERS
      --
      --  Privacy model:
      --    "open"    → anyone nearby sees your full activity
      --    "closed"  → nearby people see you exist + current track only
      --                 full history/profile requires a connection
      --
      --  Think of it like Instagram:
      --    open   = public account (anyone can see your posts)
      --    closed = private account (must follow/connect to see full content)
      --
      --  But EVERYONE shows up on the proximity feed. Being "closed"
      --  doesn't hide you — it just limits what strangers see.
      --  That's the hook: you can always see someone is nearby and
      --  what they're listening to RIGHT NOW, but their deeper taste
      --  is gated behind a connection.
      -- ═══════════════════════════════════════════════════════
      CREATE TABLE IF NOT EXISTS users (
        id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        email           TEXT UNIQUE NOT NULL,
        password_hash   TEXT NOT NULL,
        username        TEXT UNIQUE NOT NULL,
        display_name    TEXT NOT NULL,
        bio             TEXT DEFAULT '',
        photo_url       TEXT,
        visibility      TEXT DEFAULT 'open' CHECK (visibility IN ('open', 'closed')),
        spotify_linked  BOOLEAN DEFAULT FALSE,
        spotify_token   TEXT,
        spotify_refresh TEXT,
        fcm_token       TEXT,
        is_active       BOOLEAN DEFAULT TRUE,
        last_seen       TIMESTAMPTZ DEFAULT NOW(),
        created_at      TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
      CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);

      -- ═══════════════════════════════════════════════════════
      --  CONNECTIONS — the relationship layer
      --
      --  Two-way: either side can request. Once accepted, both
      --  users unlock each other's full profile, history, and chat.
      --
      --  status flow:
      --    pending → accepted (connection made)
      --    pending → declined (can re-request later)
      --
      --  For "open" users: you can still send a connection request.
      --  Why? Because connections unlock chat + notifications when
      --  your connection is nearby. It's not about gatekeeping
      --  content — it's about saying "I want to stay linked to
      --  this person's music world."
      -- ═══════════════════════════════════════════════════════
      CREATE TABLE IF NOT EXISTS connections (
        id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        requester_id    UUID REFERENCES users(id) ON DELETE CASCADE,
        target_id       UUID REFERENCES users(id) ON DELETE CASCADE,
        status          TEXT DEFAULT 'pending'
                        CHECK (status IN ('pending', 'accepted', 'declined')),
        created_at      TIMESTAMPTZ DEFAULT NOW(),
        accepted_at     TIMESTAMPTZ,
        UNIQUE(requester_id, target_id)
      );

      CREATE INDEX IF NOT EXISTS idx_connections_target
        ON connections(target_id, status);
      CREATE INDEX IF NOT EXISTS idx_connections_accepted
        ON connections(status) WHERE status = 'accepted';

      -- ═══════════════════════════════════════════════════════
      --  LISTENING SESSIONS — real-time + historical
      -- ═══════════════════════════════════════════════════════
      CREATE TABLE IF NOT EXISTS listening_sessions (
        id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id         UUID REFERENCES users(id) ON DELETE CASCADE,
        track_id        TEXT NOT NULL,
        track_name      TEXT NOT NULL,
        artist_name     TEXT NOT NULL,
        album_art_url   TEXT,
        genres          TEXT[] DEFAULT '{}',
        audio_features  JSONB DEFAULT '{}',
        started_at      TIMESTAMPTZ DEFAULT NOW(),
        ended_at        TIMESTAMPTZ,
        is_active       BOOLEAN DEFAULT TRUE,
        latitude        DOUBLE PRECISION,
        longitude       DOUBLE PRECISION
      );

      CREATE INDEX IF NOT EXISTS idx_sessions_user_active
        ON listening_sessions(user_id, is_active) WHERE is_active = TRUE;
      CREATE INDEX IF NOT EXISTS idx_sessions_user_history
        ON listening_sessions(user_id, started_at DESC);
      CREATE INDEX IF NOT EXISTS idx_sessions_artist
        ON listening_sessions(artist_name) WHERE is_active = TRUE;
      CREATE INDEX IF NOT EXISTS idx_sessions_genres
        ON listening_sessions USING GIN(genres) WHERE is_active = TRUE;

      -- ═══════════════════════════════════════════════════════
      --  TASTE PROFILES — aggregated music DNA
      -- ═══════════════════════════════════════════════════════
      CREATE TABLE IF NOT EXISTS taste_profiles (
        user_id           UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
        top_genres        JSONB NOT NULL DEFAULT '{}',
        top_artists       JSONB NOT NULL DEFAULT '[]',
        avg_energy        DOUBLE PRECISION DEFAULT 0.5,
        avg_valence       DOUBLE PRECISION DEFAULT 0.5,
        avg_tempo         DOUBLE PRECISION DEFAULT 120,
        avg_danceability  DOUBLE PRECISION DEFAULT 0.5,
        total_listens     INTEGER DEFAULT 0,
        updated_at        TIMESTAMPTZ DEFAULT NOW()
      );

      -- ═══════════════════════════════════════════════════════
      --  MESSAGES — unlocked by accepted connections
      -- ═══════════════════════════════════════════════════════
      CREATE TABLE IF NOT EXISTS messages (
        id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        connection_id   UUID REFERENCES connections(id) ON DELETE CASCADE,
        sender_id       UUID REFERENCES users(id) ON DELETE CASCADE,
        content         TEXT NOT NULL,
        read_at         TIMESTAMPTZ,
        created_at      TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_messages_connection
        ON messages(connection_id, created_at DESC);
    `);
    console.log('✓ Database schema ready');
  } finally {
    client.release();
  }
}

module.exports = { createPool, initializeDatabase };
