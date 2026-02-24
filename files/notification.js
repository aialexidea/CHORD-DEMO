const { NOTIFICATION_THROTTLE_PREFIX } = require('../lib/redis');

/**
 * NotificationService
 *
 * Handles three notification types:
 * 1. Artist match  — "Someone 200m away is also listening to Radiohead"
 * 2. Genre match   — "3 people nearby are vibing with indie-rock"
 * 3. Engagement    — "Velvet Bass wants to connect with you"
 *
 * Anti-spam: max 1 notification per user per 5 minutes per type.
 * Delivery: Socket.IO (in-app) + FCM (push when backgrounded).
 */
class NotificationService {
  constructor(redis, db) {
    this.redis = redis;
    this.db = db;
    this.throttleMs = parseInt(process.env.MAX_NOTIFICATION_FREQUENCY_MS || '300000');
    this.fcmEnabled = false;

    // Initialize Firebase Admin if credentials are available
    this.initFirebase();
  }

  async initFirebase() {
    if (!process.env.FIREBASE_PROJECT_ID) {
      console.log('⚠ Firebase not configured — push notifications disabled');
      return;
    }

    try {
      const admin = require('firebase-admin');
      if (!admin.apps.length) {
        admin.initializeApp({
          credential: admin.credential.cert({
            projectId: process.env.FIREBASE_PROJECT_ID,
            clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
            privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
          }),
        });
      }
      this.fcm = admin.messaging();
      this.fcmEnabled = true;
      console.log('✓ Firebase Cloud Messaging initialized');
    } catch (err) {
      console.warn('⚠ Firebase init failed:', err.message);
    }
  }

  /**
   * Check if a notification is throttled for a user.
   * Returns true if we should NOT send (throttled).
   */
  async isThrottled(userId, notifType) {
    const key = `${NOTIFICATION_THROTTLE_PREFIX}${userId}:${notifType}`;
    const exists = await this.redis.exists(key);
    return exists === 1;
  }

  /**
   * Mark a notification type as sent for throttling.
   */
  async markSent(userId, notifType) {
    const key = `${NOTIFICATION_THROTTLE_PREFIX}${userId}:${notifType}`;
    await this.redis.setex(key, Math.floor(this.throttleMs / 1000), '1');
  }

  /**
   * Send an artist-match notification.
   * Triggered when proximity scan finds overlapping artists.
   */
  async notifyArtistMatch(io, targetUserId, matchData) {
    const notifType = `artist:${matchData.artistName}`;

    if (await this.isThrottled(targetUserId, notifType)) return false;

    const notification = {
      type: 'ARTIST_MATCH',
      title: 'Music Match Nearby!',
      body: `Someone ${matchData.distance}m away is also listening to ${matchData.artistName}`,
      data: {
        matchUserId: matchData.userId,
        matchAlias: matchData.alias,
        artistName: matchData.artistName,
        trackName: matchData.trackName,
        albumArt: matchData.albumArt,
        distance: matchData.distance,
      },
      timestamp: Date.now(),
    };

    // In-app via Socket.IO
    io.to(`user:${targetUserId}`).emit('notification', notification);

    // Push via FCM (for backgrounded app)
    await this.sendPush(targetUserId, notification);

    await this.markSent(targetUserId, notifType);
    return true;
  }

  /**
   * Send a genre-match notification.
   * Triggered when nearby users share genres.
   */
  async notifyGenreMatch(io, targetUserId, matchData) {
    const notifType = `genre:${matchData.sharedGenres.join(',')}`;

    if (await this.isThrottled(targetUserId, notifType)) return false;

    const count = matchData.count || 1;
    const genreStr = matchData.sharedGenres.slice(0, 2).join(' & ');

    const notification = {
      type: 'GENRE_MATCH',
      title: 'Your Vibe is in the Air',
      body: `${count} ${count === 1 ? 'person' : 'people'} nearby ${count === 1 ? 'is' : 'are'} into ${genreStr}`,
      data: {
        genres: matchData.sharedGenres,
        nearbyCount: count,
        closestDistance: matchData.closestDistance,
      },
      timestamp: Date.now(),
    };

    io.to(`user:${targetUserId}`).emit('notification', notification);
    await this.sendPush(targetUserId, notification);
    await this.markSent(targetUserId, notifType);
    return true;
  }

  /**
   * Send a connection request notification.
   */
  async notifyConnectionRequest(io, targetUserId, data) {
    const notifType = `connection_req:${data.requesterId}`;
    if (await this.isThrottled(targetUserId, notifType)) return false;

    const notification = {
      type: 'CONNECTION_REQUEST',
      title: 'Connection Request',
      body: `${data.display_name || data.username} wants to connect`,
      data: {
        connectionId: data.connectionId,
        requesterId: data.requesterId,
        username: data.username,
        displayName: data.display_name,
        photoUrl: data.photo_url,
      },
      timestamp: Date.now(),
    };

    io.to(`user:${targetUserId}`).emit('notification', notification);
    await this.sendPush(targetUserId, notification);
    await this.markSent(targetUserId, notifType);
    return true;
  }

  /**
   * Notify both users when a connection is accepted (mutual).
   */
  async notifyNewConnection(io, targetUserId, fromUser) {
    const notification = {
      type: 'NEW_CONNECTION',
      title: 'New Connection',
      body: `You and ${fromUser.display_name || fromUser.username} are now connected`,
      data: {
        username: fromUser.username,
        displayName: fromUser.display_name,
        photoUrl: fromUser.photo_url,
      },
      timestamp: Date.now(),
    };

    io.to(`user:${targetUserId}`).emit('notification', notification);
    await this.sendPush(targetUserId, notification);
    return true;
  }

  /**
   * Send an engagement request notification.
   */
  async notifyEngagement(io, targetUserId, engagement) {
    const notifType = `engagement:${engagement.senderId}`;
    if (await this.isThrottled(targetUserId, notifType)) return false;

    const notification = {
      type: 'ENGAGEMENT_REQUEST',
      title: 'Someone\'s Into Your Taste',
      body: `${engagement.senderDisplayName || engagement.senderUsername} wants to connect`,
      data: engagement,
      timestamp: Date.now(),
    };

    io.to(`user:${targetUserId}`).emit('notification', notification);
    await this.sendPush(targetUserId, notification);
    await this.markSent(targetUserId, notifType);
    return true;
  }

  /**
   * Send a mutual match notification.
   */
  async notifyMatch(io, targetUserId, matchData) {
    const notification = {
      type: 'MATCH',
      title: 'New Connection',
      body: `You and ${matchData.matchedDisplayName} are now connected`,
      data: matchData,
      timestamp: Date.now(),
    };

    io.to(`user:${targetUserId}`).emit('notification', notification);
    await this.sendPush(targetUserId, notification);
    return true;
  }

  /**
   * Send a push notification via Firebase Cloud Messaging.
   */
  async sendPush(userId, notification) {
    if (!this.fcmEnabled) return;

    try {
      const { rows } = await this.db.query(
        `SELECT fcm_token FROM users WHERE id = $1 AND fcm_token IS NOT NULL`,
        [userId]
      );

      if (!rows[0]?.fcm_token) return;

      await this.fcm.send({
        token: rows[0].fcm_token,
        notification: {
          title: notification.title,
          body: notification.body,
        },
        data: {
          type: notification.type,
          payload: JSON.stringify(notification.data),
        },
        android: {
          priority: 'high',
          notification: {
            channelId: 'chord_matches',
            sound: 'chord_ping',
          },
        },
        apns: {
          payload: {
            aps: {
              sound: 'chord_ping.caf',
              badge: 1,
            },
          },
        },
      });
    } catch (err) {
      // Silently handle invalid tokens — will be cleaned up periodically
      if (err.code === 'messaging/registration-token-not-registered') {
        await this.db.query(
          `UPDATE users SET fcm_token = NULL WHERE id = $1`, [userId]
        );
      }
    }
  }
}

module.exports = { NotificationService };
