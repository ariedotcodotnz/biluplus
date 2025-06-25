import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { jwt } from 'hono/jwt';
import { bearerAuth } from 'hono/bearer-auth';

import { AuthService, User } from './libs/auth';
import { CommentService } from './libs/comments-v2';
import { RateLimitService } from './libs/rate-limit';

type Bindings = {
  DB: D1Database;
  KV: KVNamespace;
  JWT_SECRET: string;
  ADMIN_EMAIL?: string;
  ANALYTICS: AnalyticsEngineDataset;
};

type Variables = {
  user?: User;
  rateLimitStatus?: any;
};

const app = new Hono<{ Bindings: Bindings; Variables: Variables }>();

// CORS configuration
app.use('*', cors({
  origin: ['*'], // In production, specify your domains
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
  maxAge: 86400,
}));

// Initialize services
const getServices = (env: Bindings) => ({
  auth: new AuthService(env.DB, env.JWT_SECRET),
  comments: new CommentService(env.DB),
  rateLimit: new RateLimitService(env.DB),
});

// Get client IP address
const getClientIP = (c: any): string => {
  return c.req.header('CF-Connecting-IP') || 
         c.req.header('X-Forwarded-For') || 
         c.req.header('X-Real-IP') || 
         'unknown';
};

// Analytics middleware
app.use('*', async (c, next) => {
  const start = Date.now();
  await next();
  
  // Track API usage
  c.env.ANALYTICS?.writeDataPoint({
    blobs: [c.req.method, c.req.path, c.res.status.toString()],
    doubles: [Date.now() - start],
    indexes: [getClientIP(c)],
  });
});

// Rate limiting middleware
const rateLimitMiddleware = (endpoint: string) => {
  return async (c: any, next: any) => {
    const { rateLimit } = getServices(c.env);
    const identifier = c.get('user')?.id?.toString() || getClientIP(c);
    
    const result = await rateLimit.checkRateLimit(identifier, endpoint);
    
    if (!result.allowed) {
      return c.json({
        error: 'Rate limit exceeded',
        resetTime: result.resetTime
      }, 429);
    }
    
    c.set('rateLimitStatus', result);
    await next();
  };
};

// Authentication middleware
const authMiddleware = async (c: any, next: any) => {
  const { auth } = getServices(c.env);
  const token = c.req.header('Authorization')?.replace('Bearer ', '');
  
  if (token) {
    const payload = await auth.verifyToken(token);
    if (payload) {
      const user = await auth.getUserById(parseInt(payload.sub));
      if (user) {
        c.set('user', user);
      }
    }
  }
  
  await next();
};

// Optional auth middleware (doesn't require auth)
app.use('*', authMiddleware);

// Admin middleware
const requireAdmin = async (c: any, next: any) => {
  const user = c.get('user');
  if (!user || user.role !== 'admin') {
    return c.json({ error: 'Admin access required' }, 403);
  }
  await next();
};

// Moderator middleware
const requireModerator = async (c: any, next: any) => {
  const user = c.get('user');
  if (!user || (user.role !== 'admin' && user.role !== 'moderator')) {
    return c.json({ error: 'Moderator access required' }, 403);
  }
  await next();
};

// === AUTH ROUTES ===

app.post('/auth/register', rateLimitMiddleware('auth'), async (c) => {
  const { auth } = getServices(c.env);
  const data = await c.req.json();
  
  // Validate input
  if (!data.email || !data.password || !data.username || !data.display_name) {
    return c.json({ error: 'Missing required fields' }, 400);
  }
  
  // Check password strength
  if (data.password.length < 8) {
    return c.json({ error: 'Password must be at least 8 characters' }, 400);
  }
  
  const result = await auth.register(data);
  
  if (!result) {
    return c.json({ error: 'Registration failed' }, 400);
  }
  
  return c.json({
    user: result.user,
    token: result.token
  });
});

app.post('/auth/login', rateLimitMiddleware('auth'), async (c) => {
  const { auth } = getServices(c.env);
  const data = await c.req.json();
  
  if (!data.email || !data.password) {
    return c.json({ error: 'Email and password required' }, 400);
  }
  
  const result = await auth.login(data);
  
  if (!result) {
    return c.json({ error: 'Invalid credentials' }, 401);
  }
  
  return c.json({
    user: result.user,
    token: result.token
  });
});

app.get('/auth/me', async (c) => {
  const user = c.get('user');
  if (!user) {
    return c.json({ error: 'Not authenticated' }, 401);
  }
  
  return c.json({ user });
});

app.put('/auth/profile', rateLimitMiddleware('auth'), async (c) => {
  const user = c.get('user');
  if (!user) {
    return c.json({ error: 'Not authenticated' }, 401);
  }
  
  const { auth } = getServices(c.env);
  const data = await c.req.json();
  
  const updatedUser = await auth.updateProfile(user.id, data);
  
  if (!updatedUser) {
    return c.json({ error: 'Update failed' }, 400);
  }
  
  return c.json({ user: updatedUser });
});

app.post('/auth/change-password', rateLimitMiddleware('auth'), async (c) => {
  const user = c.get('user');
  if (!user) {
    return c.json({ error: 'Not authenticated' }, 401);
  }
  
  const { auth } = getServices(c.env);
  const { oldPassword, newPassword } = await c.req.json();
  
  if (!oldPassword || !newPassword) {
    return c.json({ error: 'Old and new passwords required' }, 400);
  }
  
  if (newPassword.length < 8) {
    return c.json({ error: 'Password must be at least 8 characters' }, 400);
  }
  
  const success = await auth.changePassword(user.id, oldPassword, newPassword);
  
  if (!success) {
    return c.json({ error: 'Password change failed' }, 400);
  }
  
  return c.json({ message: 'Password changed successfully' });
});

// === COMMENT ROUTES ===

app.get('/comments', async (c) => {
  const { comments } = getServices(c.env);
  const user = c.get('user');
  const ipAddress = getClientIP(c);
  
  const domain = c.req.header('Referer') ? new URL(c.req.header('Referer')!).hostname : 'default';
  const url = c.req.query('url') || '/';
  const limit = parseInt(c.req.query('limit') || '50');
  const offset = parseInt(c.req.query('offset') || '0');
  
  try {
    // Get or create site
    const site = await comments.getOrCreateSite(domain, user?.id);
    
    const commentList = await comments.getComments(
      site.id, 
      url, 
      user, 
      ipAddress, 
      limit, 
      offset
    );
    
    return c.json({
      comments: commentList,
      pagination: {
        limit,
        offset,
        hasMore: commentList.length === limit
      }
    });
  } catch (error) {
    console.error('Get comments error:', error);
    return c.json({ error: 'Failed to fetch comments' }, 500);
  }
});

app.post('/comments', rateLimitMiddleware('comment'), async (c) => {
  const { comments } = getServices(c.env);
  const user = c.get('user');
  const ipAddress = getClientIP(c);
  const userAgent = c.req.header('User-Agent');
  
  const domain = c.req.header('Referer') ? new URL(c.req.header('Referer')!).hostname : 'default';
  const url = c.req.query('url') || '/';
  
  const data = await c.req.json();
  
  if (!data.content || data.content.trim().length === 0) {
    return c.json({ error: 'Comment content required' }, 400);
  }
  
  if (data.content.length > 5000) {
    return c.json({ error: 'Comment too long (max 5000 characters)' }, 400);
  }
  
  try {
    // Get or create site
    const site = await comments.getOrCreateSite(domain, user?.id);
    
    const comment = await comments.createComment(
      site.id,
      url,
      data,
      user,
      ipAddress,
      userAgent
    );
    
    if (!comment) {
      return c.json({ error: 'Failed to create comment' }, 400);
    }
    
    return c.json({ 
      comment,
      message: comment.status === 'pending' ? 'Comment submitted for moderation' : 'Comment posted'
    });
  } catch (error) {
    console.error('Create comment error:', error);
    return c.json({ error: 'Failed to create comment' }, 500);
  }
});

app.post('/comments/:id/vote', rateLimitMiddleware('vote'), async (c) => {
  const { comments } = getServices(c.env);
  const user = c.get('user');
  const ipAddress = getClientIP(c);
  
  const commentId = parseInt(c.req.param('id'));
  const { type } = await c.req.json();
  
  if (!['up', 'down'].includes(type)) {
    return c.json({ error: 'Invalid vote type' }, 400);
  }
  
  const success = await comments.voteComment(commentId, type, user, ipAddress);
  
  if (!success) {
    return c.json({ error: 'Failed to vote' }, 400);
  }
  
  return c.json({ message: 'Vote recorded' });
});

app.post('/comments/:id/react', rateLimitMiddleware('reaction'), async (c) => {
  const { comments } = getServices(c.env);
  const user = c.get('user');
  const ipAddress = getClientIP(c);
  
  const commentId = parseInt(c.req.param('id'));
  const { reaction } = await c.req.json();
  
  if (!reaction || !['like', 'love', 'laugh', 'angry', 'sad'].includes(reaction)) {
    return c.json({ error: 'Invalid reaction type' }, 400);
  }
  
  const success = await comments.addReaction(commentId, reaction, user, ipAddress);
  
  if (!success) {
    return c.json({ error: 'Failed to add reaction' }, 400);
  }
  
  return c.json({ message: 'Reaction recorded' });
});

// === MODERATION ROUTES ===

app.get('/admin/comments/pending', requireModerator, async (c) => {
  const { comments } = getServices(c.env);
  const siteId = c.req.query('site_id') ? parseInt(c.req.query('site_id')) : undefined;
  const limit = parseInt(c.req.query('limit') || '50');
  
  const pendingComments = await comments.getPendingComments(siteId, limit);
  
  return c.json({ comments: pendingComments });
});

app.post('/admin/comments/:id/moderate', requireModerator, async (c) => {
  const { comments } = getServices(c.env);
  const user = c.get('user');
  
  const commentId = parseInt(c.req.param('id'));
  const { action, reason } = await c.req.json();
  
  if (!['approve', 'reject', 'spam', 'delete'].includes(action)) {
    return c.json({ error: 'Invalid moderation action' }, 400);
  }
  
  const success = await comments.moderateComment(commentId, action, user!.id, reason);
  
  if (!success) {
    return c.json({ error: 'Moderation failed' }, 400);
  }
  
  return c.json({ message: 'Comment moderated successfully' });
});

// === ADMIN ROUTES ===

app.get('/admin/stats', requireAdmin, async (c) => {
  const { DB } = c.env;
  
  try {
    const [userCount, commentCount, siteCount, pendingCount] = await Promise.all([
      DB.prepare('SELECT COUNT(*) as count FROM users WHERE status = "active"').first<{ count: number }>(),
      DB.prepare('SELECT COUNT(*) as count FROM comments WHERE status = "published"').first<{ count: number }>(),
      DB.prepare('SELECT COUNT(*) as count FROM sites').first<{ count: number }>(),
      DB.prepare('SELECT COUNT(*) as count FROM comments WHERE status = "pending"').first<{ count: number }>(),
    ]);
    
    return c.json({
      users: userCount?.count || 0,
      comments: commentCount?.count || 0,
      sites: siteCount?.count || 0,
      pending: pendingCount?.count || 0,
    });
  } catch (error) {
    console.error('Stats error:', error);
    return c.json({ error: 'Failed to fetch stats' }, 500);
  }
});

app.get('/admin/users', requireAdmin, async (c) => {
  const { DB } = c.env;
  const limit = parseInt(c.req.query('limit') || '50');
  const offset = parseInt(c.req.query('offset') || '0');
  
  try {
    const users = await DB.prepare(`
      SELECT id, email, username, display_name, role, status, email_verified, created_at
      FROM users
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `).bind(limit, offset).all<User>();
    
    return c.json({ users: users.results });
  } catch (error) {
    console.error('Get users error:', error);
    return c.json({ error: 'Failed to fetch users' }, 500);
  }
});

app.put('/admin/users/:id', requireAdmin, async (c) => {
  const { DB } = c.env;
  const userId = parseInt(c.req.param('id'));
  const { role, status } = await c.req.json();
  
  if (role && !['admin', 'moderator', 'user'].includes(role)) {
    return c.json({ error: 'Invalid role' }, 400);
  }
  
  if (status && !['active', 'banned', 'suspended'].includes(status)) {
    return c.json({ error: 'Invalid status' }, 400);
  }
  
  try {
    const updates: string[] = [];
    const values: any[] = [];
    
    if (role) {
      updates.push('role = ?');
      values.push(role);
    }
    
    if (status) {
      updates.push('status = ?');
      values.push(status);
    }
    
    if (updates.length === 0) {
      return c.json({ error: 'No updates provided' }, 400);
    }
    
    updates.push('updated_at = CURRENT_TIMESTAMP');
    values.push(userId);
    
    await DB.prepare(`
      UPDATE users SET ${updates.join(', ')} WHERE id = ?
    `).bind(...values).run();
    
    return c.json({ message: 'User updated successfully' });
  } catch (error) {
    console.error('Update user error:', error);
    return c.json({ error: 'Failed to update user' }, 500);
  }
});

// === SITE MANAGEMENT ===

app.get('/admin/sites', requireAdmin, async (c) => {
  const { DB } = c.env;
  
  try {
    const sites = await DB.prepare(`
      SELECT s.*, u.username as owner_username
      FROM sites s
      LEFT JOIN users u ON s.owner_id = u.id
      ORDER BY s.created_at DESC
    `).all<any>();
    
    return c.json({ sites: sites.results });
  } catch (error) {
    console.error('Get sites error:', error);
    return c.json({ error: 'Failed to fetch sites' }, 500);
  }
});

// === EMBED ROUTE ===
app.get('/embed.js', async (c) => {
  const { embedScript } = await import('./libs/embed-v2');
  
  c.header('Content-Type', 'application/javascript');
  c.header('Cache-Control', 'public, max-age=3600');
  
  return c.text(embedScript);
});

// === HEALTH CHECK ===
app.get('/health', async (c) => {
  return c.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    version: '2.0.0'
  });
});

// === ADMIN SETUP (TEMPORARY) ===
app.get('/setup-admin', async (c) => {
  const { auth } = getServices(c.env);
  
  try {
    // Try to create admin user
    const result = await auth.register({
      email: 'admin@yourdomain.com',
      password: 'SecureAdminPassword123',
      username: 'admin',
      display_name: 'Admin User'
    });
    
    if (!result) {
      return c.json({ error: 'Failed to create admin user - might already exist' }, 400);
    }
    
    // Update role to admin
    await c.env.DB.prepare(`
      UPDATE users SET role = 'admin' WHERE email = 'admin@yourdomain.com'
    `).run();
    
    return c.json({ 
      message: 'Admin user created successfully',
      email: 'admin@yourdomain.com',
      password: 'SecureAdminPassword123',
      note: 'You can now login at /admin'
    });
  } catch (error) {
    return c.json({ error: 'Setup failed: ' + error.message }, 500);
  }
});

// === ADMIN DASHBOARD ===
app.get('/admin', async (c) => {
  // For browser requests, we'll handle authentication in the HTML/JavaScript
  // since browsers don't automatically send Authorization headers
  const { adminDashboardHTML } = await import('./libs/admin-dashboard');
  return c.html(adminDashboardHTML);
});

// === DEMO ROUTE ===
app.get('/demo', async (c) => {
  const { demoHTML } = await import('./libs/embed-v2');
  return c.html(demoHTML);
});

// === ROOT ===
app.get('/', async (c) => {
  const { demoHTML } = await import('./libs/embed-v2');
  return c.html(demoHTML);
});

export default app;