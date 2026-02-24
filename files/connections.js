function registerConnectionRoutes(fastify) {
  const db = () => fastify.services.music.db;

  // ═══════════════════════════════════════════════════════════
  //  POST /connections — Send a connection request
  //  Works whether they're open or closed. Connections unlock:
  //    - Chat
  //    - Proximity alerts when your connection is nearby
  //    - Full history (for closed accounts)
  // ═══════════════════════════════════════════════════════════
  fastify.post('/connections', {
    preHandler: [fastify.authenticate],
    schema: {
      body: {
        type: 'object',
        required: ['targetUserId'],
        properties: {
          targetUserId: { type: 'string', format: 'uuid' },
        },
      },
    },
  }, async (request, reply) => {
    const userId = request.user.sub;
    const { targetUserId } = request.body;

    if (userId === targetUserId) {
      return reply.status(400).send({ error: 'Cannot connect with yourself' });
    }

    // Check if they already sent us one → auto-accept (mutual)
    const incoming = await db().query(
      `SELECT id FROM connections
       WHERE requester_id = $1 AND target_id = $2 AND status = 'pending'`,
      [targetUserId, userId]
    );

    if (incoming.rows.length > 0) {
      // Mutual interest — accept their request
      await db().query(
        `UPDATE connections SET status = 'accepted', accepted_at = NOW()
         WHERE id = $1`,
        [incoming.rows[0].id]
      );

      const theirInfo = await db().query(
        `SELECT username, display_name, photo_url FROM users WHERE id = $1`, [targetUserId]
      );
      const myInfo = await db().query(
        `SELECT username, display_name, photo_url FROM users WHERE id = $1`, [userId]
      );

      // Notify both
      await fastify.services.notification.notifyNewConnection(
        { to: (r) => ({ emit: () => {} }) }, targetUserId, myInfo.rows[0]
      );

      return { connectionId: incoming.rows[0].id, status: 'accepted', mutual: true };
    }

    // One-sided — create request
    const result = await db().query(
      `INSERT INTO connections (requester_id, target_id)
       VALUES ($1, $2)
       ON CONFLICT (requester_id, target_id)
       DO UPDATE SET status = 'pending', created_at = NOW()
       RETURNING id, status`,
      [userId, targetUserId]
    );

    // Notify target
    const myInfo = await db().query(
      `SELECT username, display_name, photo_url FROM users WHERE id = $1`, [userId]
    );
    await fastify.services.notification.notifyConnectionRequest(
      { to: (r) => ({ emit: () => {} }) }, targetUserId, {
        connectionId: result.rows[0].id,
        ...myInfo.rows[0],
        requesterId: userId,
      }
    );

    return { connectionId: result.rows[0].id, status: 'pending', mutual: false };
  });

  // ═══════════════════════════════════════════════════════════
  //  PATCH /connections/:id — Accept or decline
  // ═══════════════════════════════════════════════════════════
  fastify.patch('/connections/:id', {
    preHandler: [fastify.authenticate],
    schema: {
      body: {
        type: 'object',
        required: ['action'],
        properties: { action: { type: 'string', enum: ['accept', 'decline'] } },
      },
    },
  }, async (request, reply) => {
    const userId = request.user.sub;
    const { id } = request.params;
    const { action } = request.body;

    const result = await db().query(
      `UPDATE connections SET status = $1, accepted_at = CASE WHEN $1 = 'accepted' THEN NOW() ELSE NULL END
       WHERE id = $2 AND target_id = $3 AND status = 'pending'
       RETURNING requester_id`,
      [action === 'accept' ? 'accepted' : 'declined', id, userId]
    );

    if (result.rows.length === 0) {
      return reply.status(404).send({ error: 'Request not found' });
    }

    if (action === 'accept') {
      const myInfo = await db().query(
        `SELECT username, display_name, photo_url FROM users WHERE id = $1`, [userId]
      );
      await fastify.services.notification.notifyNewConnection(
        { to: (r) => ({ emit: () => {} }) }, result.rows[0].requester_id, myInfo.rows[0]
      );
    }

    return { connectionId: id, status: action === 'accept' ? 'accepted' : 'declined' };
  });

  // ═══════════════════════════════════════════════════════════
  //  GET /connections — All accepted connections
  // ═══════════════════════════════════════════════════════════
  fastify.get('/connections', {
    preHandler: [fastify.authenticate],
  }, async (request) => {
    const userId = request.user.sub;

    const { rows } = await db().query(
      `SELECT c.id AS connection_id, c.accepted_at,
              u.id AS user_id, u.username, u.display_name, u.photo_url, u.bio,
              (SELECT content FROM messages WHERE connection_id = c.id ORDER BY created_at DESC LIMIT 1) AS last_message,
              (SELECT created_at FROM messages WHERE connection_id = c.id ORDER BY created_at DESC LIMIT 1) AS last_message_at,
              (SELECT COUNT(*) FROM messages WHERE connection_id = c.id AND sender_id != $1 AND read_at IS NULL)::int AS unread
       FROM connections c
       JOIN users u ON u.id = CASE WHEN c.requester_id = $1 THEN c.target_id ELSE c.requester_id END
       WHERE (c.requester_id = $1 OR c.target_id = $1) AND c.status = 'accepted'
       ORDER BY COALESCE(
         (SELECT created_at FROM messages WHERE connection_id = c.id ORDER BY created_at DESC LIMIT 1),
         c.accepted_at
       ) DESC`,
      [userId]
    );

    return { connections: rows };
  });

  // ═══════════════════════════════════════════════════════════
  //  GET /connections/requests — Pending incoming requests
  // ═══════════════════════════════════════════════════════════
  fastify.get('/connections/requests', {
    preHandler: [fastify.authenticate],
  }, async (request) => {
    const { rows } = await db().query(
      `SELECT c.id AS connection_id, c.created_at,
              u.id AS user_id, u.username, u.display_name, u.photo_url, u.bio
       FROM connections c
       JOIN users u ON u.id = c.requester_id
       WHERE c.target_id = $1 AND c.status = 'pending'
       ORDER BY c.created_at DESC`,
      [request.user.sub]
    );
    return { requests: rows };
  });

  // ═══════════════════════════════════════════════════════════
  //  Messaging (only between accepted connections)
  // ═══════════════════════════════════════════════════════════
  fastify.get('/connections/:id/messages', {
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    const userId = request.user.sub;
    const connId = request.params.id;

    const conn = await db().query(
      `SELECT id FROM connections WHERE id = $1 AND status = 'accepted'
       AND (requester_id = $2 OR target_id = $2)`,
      [connId, userId]
    );
    if (conn.rows.length === 0) return reply.status(403).send({ error: 'Not connected' });

    const { rows } = await db().query(
      `SELECT id, sender_id, content, read_at, created_at
       FROM messages WHERE connection_id = $1 ORDER BY created_at DESC LIMIT 50`,
      [connId]
    );

    await db().query(
      `UPDATE messages SET read_at = NOW()
       WHERE connection_id = $1 AND sender_id != $2 AND read_at IS NULL`,
      [connId, userId]
    );

    return { messages: rows.reverse() };
  });

  fastify.post('/connections/:id/messages', {
    preHandler: [fastify.authenticate],
    schema: { body: { type: 'object', required: ['content'], properties: { content: { type: 'string', minLength: 1, maxLength: 2000 } } } },
  }, async (request, reply) => {
    const userId = request.user.sub;
    const connId = request.params.id;

    const conn = await db().query(
      `SELECT id FROM connections WHERE id = $1 AND status = 'accepted'
       AND (requester_id = $2 OR target_id = $2)`,
      [connId, userId]
    );
    if (conn.rows.length === 0) return reply.status(403).send({ error: 'Not connected' });

    const result = await db().query(
      `INSERT INTO messages (connection_id, sender_id, content) VALUES ($1, $2, $3) RETURNING id, created_at`,
      [connId, userId, request.body.content]
    );

    return { messageId: result.rows[0].id, createdAt: result.rows[0].created_at };
  });
}

module.exports = { registerConnectionRoutes };
