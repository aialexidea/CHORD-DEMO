/**
 * Discovery Routes — "Frequency"
 *
 * The feed has two layers:
 *
 * 1. FREQUENCY (public proximity feed)
 *    Everyone nearby shows up. You always see:
 *      - username, display name, photo
 *      - what they're playing RIGHT NOW
 *      - distance
 *      - compatibility score
 *    This is the "social media" layer — like scrolling a feed of
 *    what's happening musically around you in real time.
 *
 * 2. PROFILE (gated by visibility)
 *    Tapping a person opens their profile:
 *      - open accounts: full history, top genres, taste DNA
 *      - closed accounts: just current track + bio + "connect to see more"
 *      - connected accounts: everything + chat
 *
 * The feed is NOT a grid of cards. It's a living, real-time stream
 * of music activity happening in your physical space.
 */
function registerDiscoveryRoutes(fastify) {
  const db = () => fastify.services.music.db;

  // ═══════════════════════════════════════════════════════════
  //  GET /frequency — The proximity feed
  //  Everyone nearby, real-time, always visible
  // ═══════════════════════════════════════════════════════════
  fastify.get('/frequency', {
    preHandler: [fastify.authenticate],
    schema: {
      querystring: {
        type: 'object',
        properties: {
          radius: { type: 'integer', minimum: 50, maximum: 5000, default: 500 },
        },
      },
    },
  }, async (request) => {
    const userId = request.user.sub;
    const radius = request.query.radius || 500;

    const nearby = await fastify.services.location.findNearbyListeners(userId, radius);
    if (nearby.length === 0) return { frequency: [], count: 0, radius };

    const nearbyIds = nearby.map((u) => u.userId);

    // Get profiles + active sessions + connection status in one query
    const { rows } = await db().query(
      `SELECT
         u.id, u.username, u.display_name, u.photo_url, u.bio, u.visibility,
         ls.track_name, ls.artist_name, ls.album_art_url, ls.genres,
         EXISTS(
           SELECT 1 FROM connections c
           WHERE c.status = 'accepted'
           AND ((c.requester_id = $1 AND c.target_id = u.id) OR (c.target_id = $1 AND c.requester_id = u.id))
         ) AS is_connected,
         EXISTS(
           SELECT 1 FROM connections c
           WHERE c.status = 'pending' AND c.requester_id = $1 AND c.target_id = u.id
         ) AS request_sent
       FROM users u
       LEFT JOIN listening_sessions ls ON ls.user_id = u.id AND ls.is_active = TRUE
       WHERE u.id = ANY($2) AND u.is_active = TRUE`,
      [userId, nearbyIds]
    );

    const frequency = rows.map((row) => {
      const loc = nearby.find((n) => n.userId === row.id);
      return {
        id: row.id,
        username: row.username,
        displayName: row.display_name,
        photoUrl: row.photo_url,
        distance: loc?.distance || null,
        visibility: row.visibility,
        isConnected: row.is_connected,
        requestSent: row.request_sent,
        nowPlaying: row.track_name ? {
          trackName: row.track_name,
          artistName: row.artist_name,
          albumArt: row.album_art_url,
          genres: row.genres || [],
        } : null,
      };
    });

    frequency.sort((a, b) => (a.distance || 9999) - (b.distance || 9999));
    return { frequency, count: frequency.length, radius };
  });

  // ═══════════════════════════════════════════════════════════
  //  GET /frequency/profile/:username — View a user's profile
  //  Content gated by visibility + connection status
  // ═══════════════════════════════════════════════════════════
  fastify.get('/frequency/profile/:username', {
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    const viewerId = request.user.sub;
    const { username } = request.params;

    const { rows } = await db().query(
      `SELECT id, username, display_name, bio, photo_url, visibility, created_at
       FROM users WHERE username = $1 AND is_active = TRUE`,
      [username.toLowerCase()]
    );
    if (rows.length === 0) return reply.status(404).send({ error: 'User not found' });

    const user = rows[0];
    const isSelf = user.id === viewerId;

    // Check connection status
    const connResult = await db().query(
      `SELECT id, status FROM connections
       WHERE ((requester_id = $1 AND target_id = $2) OR (target_id = $1 AND requester_id = $2))
       ORDER BY CASE WHEN status = 'accepted' THEN 0 WHEN status = 'pending' THEN 1 ELSE 2 END
       LIMIT 1`,
      [viewerId, user.id]
    );

    const connection = connResult.rows[0] || null;
    const isConnected = connection?.status === 'accepted';
    const canSeeFullProfile = isSelf || isConnected || user.visibility === 'open';

    // Base profile (always visible)
    const profile = {
      id: user.id,
      username: user.username,
      displayName: user.display_name,
      bio: user.bio,
      photoUrl: user.photo_url,
      visibility: user.visibility,
      memberSince: user.created_at,
      isConnected,
      connectionId: connection?.id || null,
      connectionStatus: connection?.status || null,
      isSelf,
    };

    // Current track (always visible)
    const nowPlaying = await db().query(
      `SELECT track_name, artist_name, album_art_url, genres
       FROM listening_sessions WHERE user_id = $1 AND is_active = TRUE
       ORDER BY started_at DESC LIMIT 1`, [user.id]
    );
    profile.nowPlaying = nowPlaying.rows[0] || null;

    // Compatibility (always visible — it's a hook)
    profile.compatibility = await fastify.services.recommendation.getCompatibilitySummary(viewerId, user.id);

    // ── Gated content ────────────────────────────────────
    if (canSeeFullProfile) {
      // Taste profile
      const taste = await db().query(
        `SELECT top_genres, top_artists, avg_energy, avg_valence, avg_tempo, avg_danceability, total_listens
         FROM taste_profiles WHERE user_id = $1`, [user.id]
      );
      profile.tasteProfile = taste.rows[0] || null;

      // Recent history
      const history = await db().query(
        `SELECT track_name, artist_name, album_art_url, genres, started_at
         FROM listening_sessions WHERE user_id = $1
         ORDER BY started_at DESC LIMIT 20`, [user.id]
      );
      profile.recentTracks = history.rows;

      // Connection count
      const connCount = await db().query(
        `SELECT COUNT(*)::int AS count FROM connections
         WHERE (requester_id = $1 OR target_id = $1) AND status = 'accepted'`, [user.id]
      );
      profile.connectionCount = connCount.rows[0]?.count || 0;
    } else {
      // Closed + not connected: tease
      profile.tasteProfile = null;
      profile.recentTracks = null;
      profile.gatedMessage = 'Connect to see full listening history';
    }

    return profile;
  });

  // ═══════════════════════════════════════════════════════════
  //  GET /frequency/recommendations — AI-ranked nearby matches
  // ═══════════════════════════════════════════════════════════
  fastify.get('/frequency/recommendations', {
    preHandler: [fastify.authenticate],
    schema: {
      querystring: {
        type: 'object',
        properties: {
          radius: { type: 'integer', minimum: 50, maximum: 5000, default: 500 },
          limit:  { type: 'integer', minimum: 1, maximum: 20, default: 10 },
        },
      },
    },
  }, async (request) => {
    const userId = request.user.sub;
    const nearby = await fastify.services.location.findNearbyListeners(userId, request.query.radius || 500);
    if (nearby.length === 0) return { recommendations: [] };

    const recommendations = await fastify.services.recommendation.getRecommendations(userId, nearby);
    const topIds = recommendations.slice(0, request.query.limit || 10).map((r) => r.userId);

    const { rows } = await db().query(
      `SELECT u.id, u.username, u.display_name, u.photo_url, u.visibility,
              ls.track_name, ls.artist_name, ls.album_art_url, ls.genres
       FROM users u
       LEFT JOIN listening_sessions ls ON ls.user_id = u.id AND ls.is_active = TRUE
       WHERE u.id = ANY($1)`,
      [topIds]
    );

    return {
      recommendations: recommendations.slice(0, request.query.limit || 10).map((rec) => {
        const row = rows.find((r) => r.id === rec.userId);
        return row ? {
          id: row.id, username: row.username, displayName: row.display_name,
          photoUrl: row.photo_url, visibility: row.visibility,
          distance: rec.distance, score: rec.score,
          nowPlaying: row.track_name ? { trackName: row.track_name, artistName: row.artist_name, albumArt: row.album_art_url, genres: row.genres } : null,
        } : null;
      }).filter(Boolean),
    };
  });
}

module.exports = { registerDiscoveryRoutes };
