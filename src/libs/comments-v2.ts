import { D1Database } from '@cloudflare/workers-types';
import { User } from './auth';

export interface Comment {
  id: number;
  site_id: number;
  page_url: string;
  parent_id?: number;
  user_id?: number;
  author_name?: string;
  author_email?: string;
  content: string;
  content_html: string;
  status: 'published' | 'pending' | 'spam' | 'deleted';
  ip_address?: string;
  user_agent?: string;
  vote_score: number;
  reply_count: number;
  created_at: string;
  updated_at: string;
  // Joined data
  user?: {
    username: string;
    display_name: string;
    avatar_url?: string;
    role: string;
  };
  replies?: Comment[];
  user_vote?: 'up' | 'down' | null;
  user_reactions?: string[];
}

export interface CommentRequest {
  content: string;
  parent_id?: number;
  author_name?: string;
  author_email?: string;
}

export interface Vote {
  comment_id: number;
  user_id?: number;
  ip_address?: string;
  vote_type: 'up' | 'down';
}

export interface Reaction {
  comment_id: number;
  user_id?: number;
  ip_address?: string;
  reaction_type: string;
}

export interface Site {
  id: number;
  domain: string;
  name: string;
  owner_id: number;
  settings?: any;
  moderation_mode: 'auto' | 'manual' | 'off';
  require_approval: boolean;
  allow_anonymous: boolean;
}

export class CommentService {
  constructor(private db: D1Database) {}

  // Simple content filtering
  private async processContent(content: string): Promise<{ html: string; needsModeration: boolean }> {
    // Basic HTML escape
    const escaped = content
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;');

    // Simple auto-linking
    const withLinks = escaped.replace(
      /(https?:\/\/[^\s]+)/g,
      '<a href="$1" target="_blank" rel="noopener">$1</a>'
    );

    // Basic spam detection
    const spamKeywords = ['viagra', 'casino', 'lottery', 'winner'];
    const needsModeration = spamKeywords.some(keyword => 
      content.toLowerCase().includes(keyword)
    );

    return {
      html: withLinks.replace(/\n/g, '<br>'),
      needsModeration
    };
  }

  // Get or create site
  async getOrCreateSite(domain: string, ownerId?: number): Promise<Site> {
    let site = await this.db.prepare(`
      SELECT * FROM sites WHERE domain = ?
    `).bind(domain).first<Site>();

    if (!site) {
      // Use provided ownerId or default to admin user (ID 1) for anonymous sites
      const defaultOwnerId = ownerId || 1;
      
      try {
        const result = await this.db.prepare(`
          INSERT INTO sites (domain, name, owner_id)
          VALUES (?, ?, ?)
          RETURNING *
        `).bind(domain, domain, defaultOwnerId).first<Site>();
        
        if (result) {
          site = result;
        }
      } catch (error) {
        // If insert fails, try to get the site again (race condition)
        site = await this.db.prepare(`
          SELECT * FROM sites WHERE domain = ?
        `).bind(domain).first<Site>();
      }
    }

    if (!site) {
      throw new Error('Failed to create or find site');
    }

    return site;
  }

  // Create comment
  async createComment(
    siteId: number,
    pageUrl: string,
    data: CommentRequest,
    user?: User,
    ipAddress?: string,
    userAgent?: string
  ): Promise<Comment | null> {
    try {
      const { html, needsModeration } = await this.processContent(data.content);
      
      // Determine status based on moderation settings
      const site = await this.db.prepare(`
        SELECT moderation_mode, require_approval, allow_anonymous FROM sites WHERE id = ?
      `).bind(siteId).first<Site>();

      if (!site) {
        throw new Error('Site not found');
      }

      // Check if anonymous comments are allowed
      if (!user && !site.allow_anonymous) {
        throw new Error('Anonymous comments not allowed');
      }

      let status: Comment['status'] = 'published';
      
      if (needsModeration || site.moderation_mode === 'manual' || site.require_approval) {
        status = 'pending';
      }

      // Insert comment
      const comment = await this.db.prepare(`
        INSERT INTO comments (
          site_id, page_url, parent_id, user_id, author_name, author_email,
          content, content_html, status, ip_address, user_agent
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        RETURNING *
      `).bind(
        siteId,
        pageUrl,
        data.parent_id || null,
        user?.id || null,
        data.author_name || user?.display_name || null,
        data.author_email || user?.email || null,
        data.content,
        html,
        status,
        ipAddress,
        userAgent
      ).first<Comment>();

      if (!comment) {
        throw new Error('Failed to create comment');
      }

      // Update parent reply count if this is a reply
      if (data.parent_id) {
        await this.db.prepare(`
          UPDATE comments SET reply_count = reply_count + 1 WHERE id = ?
        `).bind(data.parent_id).run();
      }

      return comment;
    } catch (error) {
      console.error('Create comment error:', error);
      return null;
    }
  }

  // Get comments for a page
  async getComments(
    siteId: number,
    pageUrl: string,
    user?: User,
    ipAddress?: string,
    limit: number = 50,
    offset: number = 0
  ): Promise<Comment[]> {
    try {
      // Get top-level comments
      const comments = await this.db.prepare(`
        SELECT 
          c.*,
          u.username,
          u.display_name,
          u.avatar_url,
          u.role
        FROM comments c
        LEFT JOIN users u ON c.user_id = u.id
        WHERE c.site_id = ? AND c.page_url = ? AND c.parent_id IS NULL
          AND c.status IN ('published', 'pending')
        ORDER BY c.created_at DESC
        LIMIT ? OFFSET ?
      `).bind(siteId, pageUrl, limit, offset).all<Comment & { username?: string; display_name?: string; avatar_url?: string; role?: string }>();

      // Process comments and get user votes/reactions
      const processedComments = await Promise.all(
        comments.results.map(async (comment) => {
          const processed: Comment = {
            ...comment,
            user: comment.username ? {
              username: comment.username,
              display_name: comment.display_name || comment.username,
              avatar_url: comment.avatar_url,
              role: comment.role || 'user'
            } : undefined,
            replies: [],
            user_vote: null,
            user_reactions: []
          };

          // Get user's vote if authenticated
          if (user) {
            const vote = await this.db.prepare(`
              SELECT vote_type FROM votes WHERE comment_id = ? AND user_id = ?
            `).bind(comment.id, user.id).first<{ vote_type: string }>();
            
            processed.user_vote = vote?.vote_type as 'up' | 'down' | null;

            // Get user's reactions
            const reactions = await this.db.prepare(`
              SELECT reaction_type FROM reactions WHERE comment_id = ? AND user_id = ?
            `).bind(comment.id, user.id).all<{ reaction_type: string }>();
            
            processed.user_reactions = reactions.results.map(r => r.reaction_type);
          } else if (ipAddress) {
            // Check anonymous votes/reactions
            const vote = await this.db.prepare(`
              SELECT vote_type FROM votes WHERE comment_id = ? AND ip_address = ?
            `).bind(comment.id, ipAddress).first<{ vote_type: string }>();
            
            processed.user_vote = vote?.vote_type as 'up' | 'down' | null;

            const reactions = await this.db.prepare(`
              SELECT reaction_type FROM reactions WHERE comment_id = ? AND ip_address = ?
            `).bind(comment.id, ipAddress).all<{ reaction_type: string }>();
            
            processed.user_reactions = reactions.results.map(r => r.reaction_type);
          }

          // Get replies (limit to 2 levels deep)
          const replies = await this.db.prepare(`
            SELECT 
              c.*,
              u.username,
              u.display_name,
              u.avatar_url,
              u.role
            FROM comments c
            LEFT JOIN users u ON c.user_id = u.id
            WHERE c.parent_id = ? AND c.status = 'published'
            ORDER BY c.created_at ASC
          `).bind(comment.id).all<Comment & { username?: string; display_name?: string; avatar_url?: string; role?: string }>();

          processed.replies = replies.results.map(reply => ({
            ...reply,
            user: reply.username ? {
              username: reply.username,
              display_name: reply.display_name || reply.username,
              avatar_url: reply.avatar_url,
              role: reply.role || 'user'
            } : undefined,
            replies: [],
            user_vote: null,
            user_reactions: []
          }));

          return processed;
        })
      );

      return processedComments;
    } catch (error) {
      console.error('Get comments error:', error);
      return [];
    }
  }

  // Vote on comment
  async voteComment(
    commentId: number,
    voteType: 'up' | 'down',
    user?: User,
    ipAddress?: string
  ): Promise<boolean> {
    try {
      const identifier = user ? { user_id: user.id } : { ip_address: ipAddress };
      
      if (!identifier.user_id && !identifier.ip_address) {
        return false;
      }

      // Check if user already voted
      const existingVote = await this.db.prepare(`
        SELECT vote_type FROM votes WHERE comment_id = ? AND ${user ? 'user_id' : 'ip_address'} = ?
      `).bind(commentId, user?.id || ipAddress).first<{ vote_type: string }>();

      if (existingVote) {
        if (existingVote.vote_type === voteType) {
          // Remove vote
          await this.db.prepare(`
            DELETE FROM votes WHERE comment_id = ? AND ${user ? 'user_id' : 'ip_address'} = ?
          `).bind(commentId, user?.id || ipAddress).run();
          
          // Update score
          const scoreChange = voteType === 'up' ? -1 : 1;
          await this.db.prepare(`
            UPDATE comments SET vote_score = vote_score + ? WHERE id = ?
          `).bind(scoreChange, commentId).run();
        } else {
          // Change vote
          await this.db.prepare(`
            UPDATE votes SET vote_type = ? WHERE comment_id = ? AND ${user ? 'user_id' : 'ip_address'} = ?
          `).bind(voteType, commentId, user?.id || ipAddress).run();
          
          // Update score (change is double)
          const scoreChange = voteType === 'up' ? 2 : -2;
          await this.db.prepare(`
            UPDATE comments SET vote_score = vote_score + ? WHERE id = ?
          `).bind(scoreChange, commentId).run();
        }
      } else {
        // New vote
        await this.db.prepare(`
          INSERT INTO votes (comment_id, ${user ? 'user_id' : 'ip_address'}, vote_type)
          VALUES (?, ?, ?)
        `).bind(commentId, user?.id || ipAddress, voteType).run();
        
        // Update score
        const scoreChange = voteType === 'up' ? 1 : -1;
        await this.db.prepare(`
          UPDATE comments SET vote_score = vote_score + ? WHERE id = ?
        `).bind(scoreChange, commentId).run();
      }

      return true;
    } catch (error) {
      console.error('Vote comment error:', error);
      return false;
    }
  }

  // Add reaction to comment
  async addReaction(
    commentId: number,
    reactionType: string,
    user?: User,
    ipAddress?: string
  ): Promise<boolean> {
    try {
      const identifier = user ? { user_id: user.id } : { ip_address: ipAddress };
      
      if (!identifier.user_id && !identifier.ip_address) {
        return false;
      }

      // Check if reaction already exists
      const existing = await this.db.prepare(`
        SELECT id FROM reactions 
        WHERE comment_id = ? AND ${user ? 'user_id' : 'ip_address'} = ? AND reaction_type = ?
      `).bind(commentId, user?.id || ipAddress, reactionType).first();

      if (existing) {
        // Remove reaction
        await this.db.prepare(`
          DELETE FROM reactions 
          WHERE comment_id = ? AND ${user ? 'user_id' : 'ip_address'} = ? AND reaction_type = ?
        `).bind(commentId, user?.id || ipAddress, reactionType).run();
      } else {
        // Add reaction
        await this.db.prepare(`
          INSERT INTO reactions (comment_id, ${user ? 'user_id' : 'ip_address'}, reaction_type)
          VALUES (?, ?, ?)
        `).bind(commentId, user?.id || ipAddress, reactionType).run();
      }

      return true;
    } catch (error) {
      console.error('Add reaction error:', error);
      return false;
    }
  }

  // Moderate comment (admin/moderator only)
  async moderateComment(
    commentId: number,
    action: 'approve' | 'reject' | 'spam' | 'delete',
    moderatorId: number,
    reason?: string
  ): Promise<boolean> {
    try {
      // Get current comment status
      const comment = await this.db.prepare(`
        SELECT status FROM comments WHERE id = ?
      `).bind(commentId).first<{ status: string }>();

      if (!comment) {
        return false;
      }

      let newStatus: string;
      switch (action) {
        case 'approve':
          newStatus = 'published';
          break;
        case 'reject':
        case 'spam':
          newStatus = 'spam';
          break;
        case 'delete':
          newStatus = 'deleted';
          break;
        default:
          return false;
      }

      // Update comment status
      await this.db.prepare(`
        UPDATE comments SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?
      `).bind(newStatus, commentId).run();

      // Log moderation action
      await this.db.prepare(`
        INSERT INTO moderation_actions (comment_id, moderator_id, action_type, reason, previous_status, new_status)
        VALUES (?, ?, ?, ?, ?, ?)
      `).bind(commentId, moderatorId, action, reason, comment.status, newStatus).run();

      return true;
    } catch (error) {
      console.error('Moderate comment error:', error);
      return false;
    }
  }

  // Get comments pending moderation
  async getPendingComments(siteId?: number, limit: number = 50): Promise<Comment[]> {
    try {
      const query = siteId 
        ? `SELECT c.*, u.username, u.display_name, u.avatar_url, u.role
           FROM comments c
           LEFT JOIN users u ON c.user_id = u.id
           WHERE c.site_id = ? AND c.status = 'pending'
           ORDER BY c.created_at ASC
           LIMIT ?`
        : `SELECT c.*, u.username, u.display_name, u.avatar_url, u.role
           FROM comments c
           LEFT JOIN users u ON c.user_id = u.id
           WHERE c.status = 'pending'
           ORDER BY c.created_at ASC
           LIMIT ?`;

      const params = siteId ? [siteId, limit] : [limit];
      const comments = await this.db.prepare(query).bind(...params).all<Comment & { username?: string; display_name?: string; avatar_url?: string; role?: string }>();

      return comments.results.map(comment => ({
        ...comment,
        user: comment.username ? {
          username: comment.username,
          display_name: comment.display_name || comment.username,
          avatar_url: comment.avatar_url,
          role: comment.role || 'user'
        } : undefined,
        replies: [],
        user_vote: null,
        user_reactions: []
      }));
    } catch (error) {
      console.error('Get pending comments error:', error);
      return [];
    }
  }
}