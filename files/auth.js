const crypto = require('crypto');

async function hashPassword(password) {
  const salt = crypto.randomBytes(32).toString('hex');
  return new Promise((resolve, reject) => {
    crypto.pbkdf2(password, salt, 100000, 64, 'sha512', (err, key) => {
      if (err) reject(err);
      resolve(`${salt}:${key.toString('hex')}`);
    });
  });
}

async function verifyPassword(password, hash) {
  const [salt, key] = hash.split(':');
  return new Promise((resolve, reject) => {
    crypto.pbkdf2(password, salt, 100000, 64, 'sha512', (err, derivedKey) => {
      if (err) reject(err);
      resolve(derivedKey.toString('hex') === key);
    });
  });
}

function registerAuthRoutes(fastify) {
  const db = () => fastify.services.music.db;

  fastify.post('/auth/register', {
    schema: {
      body: {
        type: 'object',
        required: ['email', 'password', 'username', 'displayName'],
        properties: {
          email:       { type: 'string', format: 'email' },
          password:    { type: 'string', minLength: 8 },
          username:    { type: 'string', minLength: 3, maxLength: 24, pattern: '^[a-zA-Z0-9._]+$' },
          displayName: { type: 'string', minLength: 1, maxLength: 50 },
          bio:         { type: 'string', maxLength: 160 },
          visibility:  { type: 'string', enum: ['open', 'closed'] },
        },
      },
    },
  }, async (request, reply) => {
    const { email, password, username, displayName, bio, visibility } = request.body;

    const existing = await db().query(
      `SELECT id FROM users WHERE email = $1 OR username = $2 LIMIT 1`,
      [email.toLowerCase(), username.toLowerCase()]
    );
    if (existing.rows.length > 0) {
      return reply.status(409).send({ error: 'Email or username already taken' });
    }

    const result = await db().query(
      `INSERT INTO users (email, password_hash, username, display_name, bio, visibility)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, username, display_name, visibility`,
      [email.toLowerCase(), await hashPassword(password), username.toLowerCase(),
       displayName, bio || '', visibility || 'open']
    );

    const user = result.rows[0];
    const token = fastify.jwt.sign({ sub: user.id, username: user.username }, { expiresIn: '30d' });

    return { token, user: { id: user.id, username: user.username, displayName: user.display_name, visibility: user.visibility } };
  });

  fastify.post('/auth/login', {
    schema: { body: { type: 'object', required: ['email', 'password'], properties: { email: { type: 'string' }, password: { type: 'string' } } } },
  }, async (request, reply) => {
    const { rows } = await db().query(
      `SELECT id, username, display_name, photo_url, visibility, password_hash
       FROM users WHERE email = $1 AND is_active = TRUE`,
      [request.body.email.toLowerCase()]
    );
    if (rows.length === 0 || !(await verifyPassword(request.body.password, rows[0].password_hash))) {
      return reply.status(401).send({ error: 'Invalid credentials' });
    }
    const u = rows[0];
    await db().query(`UPDATE users SET last_seen = NOW() WHERE id = $1`, [u.id]);
    const token = fastify.jwt.sign({ sub: u.id, username: u.username }, { expiresIn: '30d' });
    return { token, user: { id: u.id, username: u.username, displayName: u.display_name, photoUrl: u.photo_url, visibility: u.visibility } };
  });

  fastify.get('/auth/me', { preHandler: [fastify.authenticate] }, async (request) => {
    const { rows } = await db().query(
      `SELECT id, email, username, display_name, bio, photo_url, visibility, spotify_linked, created_at
       FROM users WHERE id = $1`, [request.user.sub]);
    if (!rows[0]) return { error: 'Not found' };
    const u = rows[0];
    return { id: u.id, email: u.email, username: u.username, displayName: u.display_name, bio: u.bio, photoUrl: u.photo_url, visibility: u.visibility, spotifyLinked: u.spotify_linked, createdAt: u.created_at };
  });

  fastify.patch('/auth/me', { preHandler: [fastify.authenticate] }, async (request) => {
    const { displayName, bio, photoUrl, visibility } = request.body;
    const sets = []; const vals = []; let i = 1;
    if (displayName !== undefined) { sets.push(`display_name = $${i++}`); vals.push(displayName); }
    if (bio !== undefined)         { sets.push(`bio = $${i++}`); vals.push(bio); }
    if (photoUrl !== undefined)    { sets.push(`photo_url = $${i++}`); vals.push(photoUrl); }
    if (visibility !== undefined)  { sets.push(`visibility = $${i++}`); vals.push(visibility); }
    if (sets.length === 0) return { error: 'Nothing to update' };
    vals.push(request.user.sub);
    await db().query(`UPDATE users SET ${sets.join(', ')} WHERE id = $${i}`, vals);
    return { success: true };
  });

  fastify.post('/auth/check-username', async (request) => {
    const { rows } = await db().query(`SELECT id FROM users WHERE username = $1`, [request.body.username?.toLowerCase()]);
    return { available: rows.length === 0 };
  });

  fastify.post('/auth/spotify', { preHandler: [fastify.authenticate] }, async (request) => {
    const result = await fastify.services.music.handleSpotifyCallback(request.user.sub, request.body.code);
    await db().query(`UPDATE users SET spotify_linked = TRUE WHERE id = $1`, [request.user.sub]);
    return { success: true, expiresIn: result.expiresIn };
  });

  fastify.post('/auth/fcm-token', { preHandler: [fastify.authenticate] }, async (request) => {
    await db().query(`UPDATE users SET fcm_token = $1 WHERE id = $2`, [request.body.fcmToken, request.user.sub]);
    return { success: true };
  });
}

module.exports = { registerAuthRoutes };
