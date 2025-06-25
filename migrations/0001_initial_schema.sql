-- Users table for authentication and profiles
CREATE TABLE users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    display_name TEXT NOT NULL,
    avatar_url TEXT,
    role TEXT NOT NULL DEFAULT 'user', -- 'admin', 'moderator', 'user'
    status TEXT NOT NULL DEFAULT 'active', -- 'active', 'banned', 'suspended'
    email_verified BOOLEAN DEFAULT FALSE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Sites table for multi-site management
CREATE TABLE sites (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    domain TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    owner_id INTEGER NOT NULL,
    settings TEXT, -- JSON settings for customization
    moderation_mode TEXT DEFAULT 'auto', -- 'auto', 'manual', 'off'
    require_approval BOOLEAN DEFAULT FALSE,
    allow_anonymous BOOLEAN DEFAULT TRUE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (owner_id) REFERENCES users(id)
);

-- Comments table with threading support
CREATE TABLE comments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    site_id INTEGER NOT NULL,
    page_url TEXT NOT NULL,
    parent_id INTEGER, -- For threaded replies
    user_id INTEGER, -- NULL for anonymous comments
    author_name TEXT, -- For anonymous comments or display override
    author_email TEXT, -- For anonymous comments (not displayed)
    content TEXT NOT NULL,
    content_html TEXT, -- Processed HTML version
    status TEXT NOT NULL DEFAULT 'published', -- 'published', 'pending', 'spam', 'deleted'
    ip_address TEXT,
    user_agent TEXT,
    vote_score INTEGER DEFAULT 0,
    reply_count INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (site_id) REFERENCES sites(id),
    FOREIGN KEY (parent_id) REFERENCES comments(id),
    FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Votes table for comment voting
CREATE TABLE votes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    comment_id INTEGER NOT NULL,
    user_id INTEGER,
    ip_address TEXT, -- For anonymous voting
    vote_type TEXT NOT NULL, -- 'up', 'down'
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (comment_id) REFERENCES comments(id),
    FOREIGN KEY (user_id) REFERENCES users(id),
    UNIQUE(comment_id, user_id),
    UNIQUE(comment_id, ip_address)
);

-- Reactions table for emoji reactions
CREATE TABLE reactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    comment_id INTEGER NOT NULL,
    user_id INTEGER,
    ip_address TEXT,
    reaction_type TEXT NOT NULL, -- 'like', 'love', 'laugh', 'angry', etc.
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (comment_id) REFERENCES comments(id),
    FOREIGN KEY (user_id) REFERENCES users(id),
    UNIQUE(comment_id, user_id, reaction_type),
    UNIQUE(comment_id, ip_address, reaction_type)
);

-- Moderation actions table
CREATE TABLE moderation_actions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    comment_id INTEGER NOT NULL,
    moderator_id INTEGER NOT NULL,
    action_type TEXT NOT NULL, -- 'approve', 'reject', 'spam', 'delete', 'edit'
    reason TEXT,
    previous_status TEXT,
    new_status TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (comment_id) REFERENCES comments(id),
    FOREIGN KEY (moderator_id) REFERENCES users(id)
);

-- Sessions table for authentication
CREATE TABLE sessions (
    id TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL,
    expires_at DATETIME NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Password reset tokens
CREATE TABLE password_reset_tokens (
    id TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL,
    expires_at DATETIME NOT NULL,
    used BOOLEAN DEFAULT FALSE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Rate limiting table
CREATE TABLE rate_limits (
    id TEXT PRIMARY KEY, -- IP address or user ID
    endpoint TEXT NOT NULL,
    count INTEGER DEFAULT 1,
    reset_at DATETIME NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX idx_comments_site_url ON comments(site_id, page_url);
CREATE INDEX idx_comments_parent ON comments(parent_id);
CREATE INDEX idx_comments_user ON comments(user_id);
CREATE INDEX idx_comments_status ON comments(status);
CREATE INDEX idx_comments_created ON comments(created_at);
CREATE INDEX idx_votes_comment ON votes(comment_id);
CREATE INDEX idx_reactions_comment ON reactions(comment_id);
CREATE INDEX idx_sessions_user ON sessions(user_id);
CREATE INDEX idx_sessions_expires ON sessions(expires_at);
CREATE INDEX idx_rate_limits_reset ON rate_limits(reset_at);