import { D1Database } from '@cloudflare/workers-types';
import { sign, verify } from 'hono/jwt';

export interface User {
  id: number;
  email: string;
  username: string;
  display_name: string;
  avatar_url?: string;
  role: 'admin' | 'moderator' | 'user';
  status: 'active' | 'banned' | 'suspended';
  email_verified: boolean;
  created_at: string;
  updated_at: string;
}

export interface AuthRequest {
  email: string;
  password: string;
  username?: string;
  display_name?: string;
}

export interface JWTPayload {
  sub: string; // user ID
  email: string;
  username: string;
  role: string;
  exp: number;
  iat: number;
}

export class AuthService {
  constructor(
    private db: D1Database,
    private jwtSecret: string
  ) {}

  // Hash password using Web Crypto API
  private async hashPassword(password: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  // Verify password
  private async verifyPassword(password: string, hash: string): Promise<boolean> {
    const hashedInput = await this.hashPassword(password);
    return hashedInput === hash;
  }

  // Generate JWT token
  private async generateToken(user: User): Promise<string> {
    const payload: JWTPayload = {
      sub: user.id.toString(),
      email: user.email,
      username: user.username,
      role: user.role,
      exp: Math.floor(Date.now() / 1000) + (7 * 24 * 60 * 60), // 7 days
      iat: Math.floor(Date.now() / 1000)
    };

    return await sign(payload, this.jwtSecret);
  }

  // Verify JWT token
  async verifyToken(token: string): Promise<JWTPayload | null> {
    try {
      const payload = await verify(token, this.jwtSecret) as JWTPayload;
      
      // Check if token is expired
      if (payload.exp < Math.floor(Date.now() / 1000)) {
        return null;
      }

      return payload;
    } catch {
      return null;
    }
  }

  // Register new user
  async register(data: AuthRequest): Promise<{ user: User; token: string } | null> {
    try {
      // Validate required fields
      if (!data.email || !data.password || !data.username || !data.display_name) {
        throw new Error('Missing required fields');
      }

      // Check if email or username already exists
      const existing = await this.db.prepare(`
        SELECT id FROM users WHERE email = ? OR username = ?
      `).bind(data.email, data.username).first();

      if (existing) {
        throw new Error('Email or username already exists');
      }

      // Hash password
      const passwordHash = await this.hashPassword(data.password);

      // Insert user
      const result = await this.db.prepare(`
        INSERT INTO users (email, username, password_hash, display_name, role, status)
        VALUES (?, ?, ?, ?, 'user', 'active')
        RETURNING id, email, username, display_name, avatar_url, role, status, email_verified, created_at, updated_at
      `).bind(data.email, data.username, passwordHash, data.display_name).first<User>();

      if (!result) {
        throw new Error('Failed to create user');
      }

      // Generate token
      const token = await this.generateToken(result);

      return { user: result, token };
    } catch (error) {
      console.error('Registration error:', error);
      return null;
    }
  }

  // Login user
  async login(data: AuthRequest): Promise<{ user: User; token: string } | null> {
    try {
      // Find user by email
      const user = await this.db.prepare(`
        SELECT * FROM users WHERE email = ? AND status = 'active'
      `).bind(data.email).first<User & { password_hash: string }>();

      if (!user) {
        return null;
      }

      // Verify password
      const passwordValid = await this.verifyPassword(data.password, user.password_hash);
      if (!passwordValid) {
        return null;
      }

      // Remove password hash from user object
      const { password_hash, ...userWithoutPassword } = user;

      // Generate token
      const token = await this.generateToken(userWithoutPassword);

      return { user: userWithoutPassword, token };
    } catch (error) {
      console.error('Login error:', error);
      return null;
    }
  }

  // Get user by ID
  async getUserById(id: number): Promise<User | null> {
    try {
      const user = await this.db.prepare(`
        SELECT id, email, username, display_name, avatar_url, role, status, email_verified, created_at, updated_at
        FROM users WHERE id = ? AND status != 'deleted'
      `).bind(id).first<User>();

      return user || null;
    } catch (error) {
      console.error('Get user error:', error);
      return null;
    }
  }

  // Update user profile
  async updateProfile(userId: number, data: Partial<Pick<User, 'display_name' | 'avatar_url'>>): Promise<User | null> {
    try {
      const updates: string[] = [];
      const values: any[] = [];

      if (data.display_name) {
        updates.push('display_name = ?');
        values.push(data.display_name);
      }

      if (data.avatar_url !== undefined) {
        updates.push('avatar_url = ?');
        values.push(data.avatar_url);
      }

      if (updates.length === 0) {
        return await this.getUserById(userId);
      }

      updates.push('updated_at = CURRENT_TIMESTAMP');
      values.push(userId);

      await this.db.prepare(`
        UPDATE users SET ${updates.join(', ')} WHERE id = ?
      `).bind(...values).run();

      return await this.getUserById(userId);
    } catch (error) {
      console.error('Update profile error:', error);
      return null;
    }
  }

  // Change password
  async changePassword(userId: number, oldPassword: string, newPassword: string): Promise<boolean> {
    try {
      // Get current password hash
      const user = await this.db.prepare(`
        SELECT password_hash FROM users WHERE id = ?
      `).bind(userId).first<{ password_hash: string }>();

      if (!user) {
        return false;
      }

      // Verify old password
      const oldPasswordValid = await this.verifyPassword(oldPassword, user.password_hash);
      if (!oldPasswordValid) {
        return false;
      }

      // Hash new password
      const newPasswordHash = await this.hashPassword(newPassword);

      // Update password
      await this.db.prepare(`
        UPDATE users SET password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?
      `).bind(newPasswordHash, userId).run();

      return true;
    } catch (error) {
      console.error('Change password error:', error);
      return false;
    }
  }

  // Check if user has permission
  hasPermission(user: User, action: string): boolean {
    switch (action) {
      case 'moderate':
        return user.role === 'admin' || user.role === 'moderator';
      case 'admin':
        return user.role === 'admin';
      case 'comment':
        return user.status === 'active';
      case 'vote':
        return user.status === 'active';
      default:
        return false;
    }
  }
}