export const embedScript = `
(function() {
  'use strict';
  
  // Bilu Enterprise Comment System v2.0
  
  const BiluComments = {
    config: null,
    user: null,
    apiBase: '',
    
    init: function(options) {
      this.config = {
        container: options.container || 'bilu-comments',
        apiUrl: options.apiUrl || 'https://your-worker.workers.dev',
        theme: options.theme || 'corporate',
        allowAnonymous: options.allowAnonymous !== false,
        enableVoting: options.enableVoting !== false,
        enableReactions: options.enableReactions !== false,
        enableReplies: options.enableReplies !== false,
        maxDepth: options.maxDepth || 3,
        ...options
      };
      
      this.apiBase = this.config.apiUrl;
      this.loadComments();
      this.checkAuthStatus();
    },
    
    // Check if user is authenticated
    checkAuthStatus: async function() {
      const token = localStorage.getItem('bilu_token');
      if (!token) return;
      
      try {
        const response = await fetch(\`\${this.apiBase}/auth/me\`, {
          headers: {
            'Authorization': \`Bearer \${token}\`
          }
        });
        
        if (response.ok) {
          const data = await response.json();
          this.user = data.user;
          this.updateUI();
        } else {
          localStorage.removeItem('bilu_token');
        }
      } catch (error) {
        console.error('Auth check failed:', error);
      }
    },
    
    // Load comments from API
    loadComments: async function() {
      try {
        const url = encodeURIComponent(window.location.pathname);
        const token = localStorage.getItem('bilu_token');
        
        const headers = {
          'Content-Type': 'application/json'
        };
        
        if (token) {
          headers['Authorization'] = \`Bearer \${token}\`;
        }
        
        const response = await fetch(\`\${this.apiBase}/comments?url=\${url}\`, {
          headers: headers
        });
        
        if (response.ok) {
          const data = await response.json();
          this.renderComments(data.comments);
        } else {
          this.showError('Failed to load comments');
        }
      } catch (error) {
        console.error('Load comments failed:', error);
        this.showError('Failed to load comments');
      }
    },
    
    // Render comments UI
    renderComments: function(comments) {
      const container = document.getElementById(this.config.container);
      if (!container) {
        console.error(\`Container element with ID '\${this.config.container}' not found\`);
        return;
      }
      
      container.innerHTML = this.getCommentsHTML(comments);
      this.attachEventListeners();
    },
    
    // Generate HTML for comments
    getCommentsHTML: function(comments) {
      return \`
        <div class="bilu-comments-container" data-theme="\${this.config.theme}">
          <style>\${this.getCSS()}</style>
          
          <div class="bilu-header">
            <h3 class="bilu-title">Comments (\${comments.length})</h3>
            \${this.user ? this.getUserMenuHTML() : this.getAuthLinksHTML()}
          </div>
          
          \${this.getCommentFormHTML()}
          
          <div class="bilu-comments-list">
            \${comments.map(comment => this.getCommentHTML(comment)).join('')}
          </div>
          
          \${this.getAuthModalHTML()}
        </div>
      \`;
    },
    
    // Comment form HTML
    getCommentFormHTML: function() {
      if (!this.config.allowAnonymous && !this.user) {
        return \`
          <div class="bilu-auth-required">
            <p>Please <a href="#" onclick="BiluComments.showAuthModal('login')">sign in</a> to comment.</p>
          </div>
        \`;
      }
      
      return \`
        <form class="bilu-comment-form" onsubmit="BiluComments.submitComment(event)">
          \${!this.user ? \`
            <div class="bilu-form-row">
              <input type="text" name="author_name" placeholder="Your name" required class="bilu-input">
              <input type="email" name="author_email" placeholder="Email (optional)" class="bilu-input">
            </div>
          \` : ''}
          
          <div class="bilu-form-row">
            <textarea 
              name="content" 
              placeholder="Share your thoughts..." 
              required 
              class="bilu-textarea"
              rows="3"
            ></textarea>
          </div>
          
          <div class="bilu-form-footer">
            <button type="submit" class="bilu-btn bilu-btn-primary">
              Post Comment
            </button>
            \${this.user ? \`<span class="bilu-user-info">Posting as \${this.user.display_name}</span>\` : ''}
          </div>
        </form>
      \`;
    },
    
    // Individual comment HTML
    getCommentHTML: function(comment, depth = 0) {
      const isOwn = this.user && comment.user_id === this.user.id;
      const canReply = this.config.enableReplies && depth < this.config.maxDepth;
      
      return \`
        <div class="bilu-comment" data-comment-id="\${comment.id}" data-depth="\${depth}">
          <div class="bilu-comment-content">
            <div class="bilu-comment-avatar">
              \${comment.user?.avatar_url ? 
                \`<img src="\${comment.user.avatar_url}" alt="Avatar">\` : 
                \`<div class="bilu-avatar-placeholder">\${this.getInitials(comment.user?.display_name || comment.author_name)}</div>\`
              }
            </div>
            
            <div class="bilu-comment-body">
              <div class="bilu-comment-header">
                <span class="bilu-author-name">
                  \${comment.user?.display_name || comment.author_name}
                  \${comment.user?.role === 'admin' ? '<span class="bilu-badge bilu-badge-admin">Admin</span>' : ''}
                  \${comment.user?.role === 'moderator' ? '<span class="bilu-badge bilu-badge-moderator">Mod</span>' : ''}
                </span>
                <span class="bilu-comment-time">\${this.formatTime(comment.created_at)}</span>
              </div>
              
              <div class="bilu-comment-text">
                \${comment.content_html}
              </div>
              
              <div class="bilu-comment-actions">
                \${this.config.enableVoting ? \`
                  <button class="bilu-action-btn \${comment.user_vote === 'up' ? 'active' : ''}" 
                          onclick="BiluComments.vote(\${comment.id}, 'up')">
                    ↑ \${comment.vote_score > 0 ? comment.vote_score : ''}
                  </button>
                  <button class="bilu-action-btn \${comment.user_vote === 'down' ? 'active' : ''}" 
                          onclick="BiluComments.vote(\${comment.id}, 'down')">
                    ↓
                  </button>
                \` : ''}
                
                \${canReply ? \`
                  <button class="bilu-action-btn" onclick="BiluComments.toggleReplyForm(\${comment.id})">
                    Reply
                  </button>
                \` : ''}
                
                \${this.config.enableReactions ? \`
                  <div class="bilu-reactions">
                    \${['👍', '❤️', '😂', '😮', '😢', '😡'].map(emoji => \`
                      <button class="bilu-reaction-btn \${comment.user_reactions?.includes(this.getReactionType(emoji)) ? 'active' : ''}" 
                              onclick="BiluComments.react(\${comment.id}, '\${this.getReactionType(emoji)}')">
                        \${emoji}
                      </button>
                    \`).join('')}
                  </div>
                \` : ''}
              </div>
              
              <div class="bilu-reply-form" id="reply-form-\${comment.id}" style="display: none;">
                \${this.getReplyFormHTML(comment.id)}
              </div>
            </div>
          </div>
          
          \${comment.replies && comment.replies.length > 0 ? \`
            <div class="bilu-replies">
              \${comment.replies.map(reply => this.getCommentHTML(reply, depth + 1)).join('')}
            </div>
          \` : ''}
        </div>
      \`;
    },
    
    // Reply form HTML
    getReplyFormHTML: function(parentId) {
      return \`
        <form class="bilu-reply-form-inner" onsubmit="BiluComments.submitReply(event, \${parentId})">
          <textarea 
            name="content" 
            placeholder="Write a reply..." 
            required 
            class="bilu-textarea bilu-textarea-small"
            rows="2"
          ></textarea>
          <div class="bilu-reply-actions">
            <button type="submit" class="bilu-btn bilu-btn-small bilu-btn-primary">Reply</button>
            <button type="button" class="bilu-btn bilu-btn-small" onclick="BiluComments.toggleReplyForm(\${parentId})">Cancel</button>
          </div>
        </form>
      \`;
    },
    
    // Auth modal HTML
    getAuthModalHTML: function() {
      return \`
        <div class="bilu-modal" id="bilu-auth-modal" style="display: none;">
          <div class="bilu-modal-content">
            <div class="bilu-modal-header">
              <h3 id="bilu-modal-title">Sign In</h3>
              <button class="bilu-modal-close" onclick="BiluComments.hideAuthModal()">×</button>
            </div>
            
            <div class="bilu-modal-body">
              <form id="bilu-auth-form" onsubmit="BiluComments.handleAuth(event)">
                <div class="bilu-form-group">
                  <input type="email" name="email" placeholder="Email" required class="bilu-input">
                </div>
                
                <div class="bilu-form-group" id="username-group" style="display: none;">
                  <input type="text" name="username" placeholder="Username" class="bilu-input">
                </div>
                
                <div class="bilu-form-group" id="display-name-group" style="display: none;">
                  <input type="text" name="display_name" placeholder="Display Name" class="bilu-input">
                </div>
                
                <div class="bilu-form-group">
                  <input type="password" name="password" placeholder="Password" required class="bilu-input">
                </div>
                
                <button type="submit" class="bilu-btn bilu-btn-primary bilu-btn-full">
                  <span id="auth-button-text">Sign In</span>
                </button>
              </form>
              
              <div class="bilu-auth-toggle">
                <p>
                  <span id="auth-toggle-text">Don't have an account?</span>
                  <a href="#" id="auth-toggle-link" onclick="BiluComments.toggleAuthMode()">Sign Up</a>
                </p>
              </div>
            </div>
          </div>
        </div>
      \`;
    },
    
    // User menu HTML
    getUserMenuHTML: function() {
      return \`
        <div class="bilu-user-menu">
          <div class="bilu-user-info">
            \${this.user.avatar_url ? 
              \`<img src="\${this.user.avatar_url}" alt="Avatar" class="bilu-user-avatar">\` : 
              \`<div class="bilu-user-avatar bilu-avatar-placeholder">\${this.getInitials(this.user.display_name)}</div>\`
            }
            <span>\${this.user.display_name}</span>
          </div>
          <button class="bilu-btn bilu-btn-small" onclick="BiluComments.logout()">Sign Out</button>
        </div>
      \`;
    },
    
    // Auth links HTML
    getAuthLinksHTML: function() {
      return \`
        <div class="bilu-auth-links">
          <a href="#" onclick="BiluComments.showAuthModal('login')" class="bilu-auth-link">Sign In</a>
          <a href="#" onclick="BiluComments.showAuthModal('register')" class="bilu-auth-link">Sign Up</a>
        </div>
      \`;
    },
    
    // CSS styles
    getCSS: function() {
      return \`
        .bilu-comments-container {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
          max-width: 800px;
          margin: 0 auto;
          padding: 24px;
          background: #ffffff;
          border-radius: 8px;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
          color: #1a1a1a;
          line-height: 1.6;
        }
        
        .bilu-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 24px;
          padding-bottom: 16px;
          border-bottom: 1px solid #e5e5e5;
        }
        
        .bilu-title {
          margin: 0;
          font-size: 20px;
          font-weight: 600;
          color: #2c3e50;
        }
        
        .bilu-user-menu {
          display: flex;
          align-items: center;
          gap: 12px;
        }
        
        .bilu-user-info {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 14px;
          color: #666;
        }
        
        .bilu-user-avatar {
          width: 32px;
          height: 32px;
          border-radius: 50%;
          object-fit: cover;
        }
        
        .bilu-avatar-placeholder {
          width: 32px;
          height: 32px;
          border-radius: 50%;
          background: #6c7b7f;
          color: white;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 12px;
          font-weight: 600;
        }
        
        .bilu-auth-links {
          display: flex;
          gap: 16px;
        }
        
        .bilu-auth-link {
          color: #3498db;
          text-decoration: none;
          font-weight: 500;
          font-size: 14px;
        }
        
        .bilu-auth-link:hover {
          text-decoration: underline;
        }
        
        .bilu-comment-form, .bilu-reply-form-inner {
          background: #f8f9fa;
          padding: 20px;
          border-radius: 8px;
          margin-bottom: 24px;
          border: 1px solid #e9ecef;
        }
        
        .bilu-form-row {
          margin-bottom: 16px;
          display: flex;
          gap: 12px;
        }
        
        .bilu-form-row .bilu-input {
          flex: 1;
        }
        
        .bilu-input, .bilu-textarea {
          width: 100%;
          padding: 12px 16px;
          border: 1px solid #d1d5db;
          border-radius: 6px;
          font-size: 14px;
          background: white;
          box-sizing: border-box;
          transition: border-color 0.2s ease;
        }
        
        .bilu-input:focus, .bilu-textarea:focus {
          outline: none;
          border-color: #3498db;
          box-shadow: 0 0 0 3px rgba(52, 152, 219, 0.1);
        }
        
        .bilu-textarea-small {
          font-size: 13px;
          padding: 10px 12px;
        }
        
        .bilu-form-footer {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        
        .bilu-btn {
          padding: 10px 16px;
          border: none;
          border-radius: 6px;
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s ease;
          text-decoration: none;
          display: inline-block;
          background: #e9ecef;
          color: #495057;
        }
        
        .bilu-btn:hover {
          background: #dee2e6;
        }
        
        .bilu-btn-primary {
          background: #3498db;
          color: white;
        }
        
        .bilu-btn-primary:hover {
          background: #2980b9;
        }
        
        .bilu-btn-small {
          padding: 6px 12px;
          font-size: 12px;
        }
        
        .bilu-btn-full {
          width: 100%;
          text-align: center;
        }
        
        .bilu-comment {
          margin-bottom: 24px;
          padding: 16px 0;
        }
        
        .bilu-comment[data-depth="1"] {
          margin-left: 40px;
        }
        
        .bilu-comment[data-depth="2"] {
          margin-left: 60px;
        }
        
        .bilu-comment-content {
          display: flex;
          gap: 12px;
        }
        
        .bilu-comment-avatar {
          flex-shrink: 0;
        }
        
        .bilu-comment-avatar img {
          width: 40px;
          height: 40px;
          border-radius: 50%;
          object-fit: cover;
        }
        
        .bilu-comment-avatar .bilu-avatar-placeholder {
          width: 40px;
          height: 40px;
          font-size: 14px;
        }
        
        .bilu-comment-body {
          flex: 1;
          min-width: 0;
        }
        
        .bilu-comment-header {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 8px;
        }
        
        .bilu-author-name {
          font-weight: 600;
          color: #2c3e50;
          font-size: 14px;
        }
        
        .bilu-comment-time {
          color: #6c757d;
          font-size: 12px;
        }
        
        .bilu-badge {
          padding: 2px 6px;
          border-radius: 3px;
          font-size: 10px;
          font-weight: 600;
          text-transform: uppercase;
        }
        
        .bilu-badge-admin {
          background: #dc3545;
          color: white;
        }
        
        .bilu-badge-moderator {
          background: #28a745;
          color: white;
        }
        
        .bilu-comment-text {
          margin-bottom: 12px;
          font-size: 14px;
          line-height: 1.6;
        }
        
        .bilu-comment-actions {
          display: flex;
          align-items: center;
          gap: 8px;
          flex-wrap: wrap;
        }
        
        .bilu-action-btn {
          background: none;
          border: 1px solid #dee2e6;
          padding: 4px 8px;
          border-radius: 4px;
          font-size: 12px;
          cursor: pointer;
          color: #6c757d;
          transition: all 0.2s ease;
        }
        
        .bilu-action-btn:hover {
          background: #f8f9fa;
          border-color: #adb5bd;
        }
        
        .bilu-action-btn.active {
          background: #3498db;
          border-color: #3498db;
          color: white;
        }
        
        .bilu-reactions {
          display: flex;
          gap: 4px;
        }
        
        .bilu-reaction-btn {
          background: none;
          border: 1px solid #dee2e6;
          padding: 4px 6px;
          border-radius: 4px;
          font-size: 12px;
          cursor: pointer;
          transition: all 0.2s ease;
        }
        
        .bilu-reaction-btn:hover {
          background: #f8f9fa;
        }
        
        .bilu-reaction-btn.active {
          background: #fff3cd;
          border-color: #ffeaa7;
        }
        
        .bilu-reply-form {
          margin-top: 12px;
          padding-top: 12px;
          border-top: 1px solid #e9ecef;
        }
        
        .bilu-reply-actions {
          display: flex;
          gap: 8px;
          margin-top: 8px;
        }
        
        .bilu-replies {
          margin-top: 16px;
          padding-top: 16px;
          border-top: 1px solid #f1f3f4;
        }
        
        .bilu-modal {
          position: fixed;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          background: rgba(0, 0, 0, 0.5);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
        }
        
        .bilu-modal-content {
          background: white;
          padding: 0;
          border-radius: 8px;
          width: 90%;
          max-width: 400px;
          max-height: 90vh;
          overflow-y: auto;
        }
        
        .bilu-modal-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 20px;
          border-bottom: 1px solid #e9ecef;
        }
        
        .bilu-modal-header h3 {
          margin: 0;
          font-size: 18px;
          color: #2c3e50;
        }
        
        .bilu-modal-close {
          background: none;
          border: none;
          font-size: 24px;
          cursor: pointer;
          color: #6c757d;
          padding: 0;
          width: 30px;
          height: 30px;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        
        .bilu-modal-body {
          padding: 20px;
        }
        
        .bilu-form-group {
          margin-bottom: 16px;
        }
        
        .bilu-auth-toggle {
          text-align: center;
          margin-top: 16px;
          padding-top: 16px;
          border-top: 1px solid #e9ecef;
        }
        
        .bilu-auth-toggle p {
          margin: 0;
          font-size: 14px;
          color: #6c757d;
        }
        
        .bilu-auth-toggle a {
          color: #3498db;
          text-decoration: none;
          font-weight: 500;
        }
        
        .bilu-auth-toggle a:hover {
          text-decoration: underline;
        }
        
        .bilu-auth-required {
          text-align: center;
          padding: 24px;
          background: #f8f9fa;
          border-radius: 8px;
          margin-bottom: 24px;
        }
        
        .bilu-auth-required p {
          margin: 0;
          color: #6c757d;
        }
        
        .bilu-auth-required a {
          color: #3498db;
          text-decoration: none;
          font-weight: 500;
        }
        
        @media (max-width: 768px) {
          .bilu-comments-container {
            padding: 16px;
          }
          
          .bilu-header {
            flex-direction: column;
            align-items: flex-start;
            gap: 12px;
          }
          
          .bilu-form-row {
            flex-direction: column;
          }
          
          .bilu-comment[data-depth="1"] {
            margin-left: 20px;
          }
          
          .bilu-comment[data-depth="2"] {
            margin-left: 30px;
          }
          
          .bilu-comment-actions {
            flex-wrap: wrap;
          }
        }
      \`;
    },
    
    // Event handlers
    attachEventListeners: function() {
      // Modal click outside to close
      document.getElementById('bilu-auth-modal')?.addEventListener('click', function(e) {
        if (e.target === this) {
          BiluComments.hideAuthModal();
        }
      });
    },
    
    // Submit comment
    submitComment: async function(event) {
      event.preventDefault();
      const form = event.target;
      const formData = new FormData(form);
      
      const data = {
        content: formData.get('content'),
        author_name: formData.get('author_name'),
        author_email: formData.get('author_email'),
      };
      
      await this.postComment(data);
      form.reset();
    },
    
    // Submit reply
    submitReply: async function(event, parentId) {
      event.preventDefault();
      const form = event.target;
      const formData = new FormData(form);
      
      const data = {
        content: formData.get('content'),
        parent_id: parentId,
      };
      
      await this.postComment(data);
      form.reset();
      this.toggleReplyForm(parentId);
    },
    
    // Post comment to API
    postComment: async function(data) {
      try {
        const url = encodeURIComponent(window.location.pathname);
        const token = localStorage.getItem('bilu_token');
        
        const headers = {
          'Content-Type': 'application/json'
        };
        
        if (token) {
          headers['Authorization'] = \`Bearer \${token}\`;
        }
        
        const response = await fetch(\`\${this.apiBase}/comments?url=\${url}\`, {
          method: 'POST',
          headers: headers,
          body: JSON.stringify(data)
        });
        
        if (response.ok) {
          const result = await response.json();
          this.showMessage(result.message || 'Comment posted successfully');
          this.loadComments(); // Reload comments
        } else {
          const error = await response.json();
          this.showError(error.error || 'Failed to post comment');
        }
      } catch (error) {
        console.error('Post comment failed:', error);
        this.showError('Failed to post comment');
      }
    },
    
    // Vote on comment
    vote: async function(commentId, type) {
      const token = localStorage.getItem('bilu_token');
      
      const headers = {
        'Content-Type': 'application/json'
      };
      
      if (token) {
        headers['Authorization'] = \`Bearer \${token}\`;
      }
      
      try {
        const response = await fetch(\`\${this.apiBase}/comments/\${commentId}/vote\`, {
          method: 'POST',
          headers: headers,
          body: JSON.stringify({ type })
        });
        
        if (response.ok) {
          this.loadComments(); // Reload to update vote counts
        } else {
          const error = await response.json();
          this.showError(error.error || 'Failed to vote');
        }
      } catch (error) {
        console.error('Vote failed:', error);
        this.showError('Failed to vote');
      }
    },
    
    // React to comment
    react: async function(commentId, reaction) {
      const token = localStorage.getItem('bilu_token');
      
      const headers = {
        'Content-Type': 'application/json'
      };
      
      if (token) {
        headers['Authorization'] = \`Bearer \${token}\`;
      }
      
      try {
        const response = await fetch(\`\${this.apiBase}/comments/\${commentId}/react\`, {
          method: 'POST',
          headers: headers,
          body: JSON.stringify({ reaction })
        });
        
        if (response.ok) {
          this.loadComments(); // Reload to update reactions
        } else {
          const error = await response.json();
          this.showError(error.error || 'Failed to react');
        }
      } catch (error) {
        console.error('React failed:', error);
        this.showError('Failed to react');
      }
    },
    
    // Toggle reply form
    toggleReplyForm: function(commentId) {
      const form = document.getElementById(\`reply-form-\${commentId}\`);
      if (form) {
        form.style.display = form.style.display === 'none' ? 'block' : 'none';
        if (form.style.display === 'block') {
          form.querySelector('textarea')?.focus();
        }
      }
    },
    
    // Auth modal functions
    showAuthModal: function(mode) {
      const modal = document.getElementById('bilu-auth-modal');
      const title = document.getElementById('bilu-modal-title');
      const authButton = document.getElementById('auth-button-text');
      const toggleText = document.getElementById('auth-toggle-text');
      const toggleLink = document.getElementById('auth-toggle-link');
      const usernameGroup = document.getElementById('username-group');
      const displayNameGroup = document.getElementById('display-name-group');
      
      if (mode === 'register') {
        title.textContent = 'Sign Up';
        authButton.textContent = 'Sign Up';
        toggleText.textContent = 'Already have an account?';
        toggleLink.textContent = 'Sign In';
        usernameGroup.style.display = 'block';
        displayNameGroup.style.display = 'block';
        usernameGroup.querySelector('input').required = true;
        displayNameGroup.querySelector('input').required = true;
      } else {
        title.textContent = 'Sign In';
        authButton.textContent = 'Sign In';
        toggleText.textContent = "Don't have an account?";
        toggleLink.textContent = 'Sign Up';
        usernameGroup.style.display = 'none';
        displayNameGroup.style.display = 'none';
        usernameGroup.querySelector('input').required = false;
        displayNameGroup.querySelector('input').required = false;
      }
      
      modal.dataset.mode = mode;
      modal.style.display = 'flex';
    },
    
    hideAuthModal: function() {
      const modal = document.getElementById('bilu-auth-modal');
      modal.style.display = 'none';
      document.getElementById('bilu-auth-form').reset();
    },
    
    toggleAuthMode: function() {
      const modal = document.getElementById('bilu-auth-modal');
      const currentMode = modal.dataset.mode;
      this.showAuthModal(currentMode === 'login' ? 'register' : 'login');
    },
    
    // Handle authentication
    handleAuth: async function(event) {
      event.preventDefault();
      const form = event.target;
      const formData = new FormData(form);
      const modal = document.getElementById('bilu-auth-modal');
      const mode = modal.dataset.mode;
      
      const data = {
        email: formData.get('email'),
        password: formData.get('password'),
      };
      
      if (mode === 'register') {
        data.username = formData.get('username');
        data.display_name = formData.get('display_name');
      }
      
      try {
        const response = await fetch(\`\${this.apiBase}/auth/\${mode === 'register' ? 'register' : 'login'}\`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(data)
        });
        
        if (response.ok) {
          const result = await response.json();
          localStorage.setItem('bilu_token', result.token);
          this.user = result.user;
          this.hideAuthModal();
          this.loadComments(); // Reload to show user-specific data
          this.showMessage(\`Successfully \${mode === 'register' ? 'registered' : 'signed in'}\`);
        } else {
          const error = await response.json();
          this.showError(error.error || \`\${mode === 'register' ? 'Registration' : 'Login'} failed\`);
        }
      } catch (error) {
        console.error('Auth failed:', error);
        this.showError(\`\${mode === 'register' ? 'Registration' : 'Login'} failed\`);
      }
    },
    
    // Logout
    logout: function() {
      localStorage.removeItem('bilu_token');
      this.user = null;
      this.loadComments();
      this.showMessage('Successfully signed out');
    },
    
    // Utility functions
    getInitials: function(name) {
      if (!name) return '?';
      return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
    },
    
    formatTime: function(timestamp) {
      const date = new Date(timestamp);
      const now = new Date();
      const diff = now - date;
      
      if (diff < 60000) return 'just now';
      if (diff < 3600000) return \`\${Math.floor(diff / 60000)}m ago\`;
      if (diff < 86400000) return \`\${Math.floor(diff / 3600000)}h ago\`;
      if (diff < 604800000) return \`\${Math.floor(diff / 86400000)}d ago\`;
      
      return date.toLocaleDateString();
    },
    
    getReactionType: function(emoji) {
      const map = {
        '👍': 'like',
        '❤️': 'love',
        '😂': 'laugh',
        '😮': 'wow',
        '😢': 'sad',
        '😡': 'angry'
      };
      return map[emoji] || 'like';
    },
    
    showMessage: function(message) {
      // Simple message display - could be enhanced with a toast system
      console.log('Bilu:', message);
    },
    
    showError: function(error) {
      console.error('Bilu Error:', error);
    },
    
    updateUI: function() {
      // Update UI elements when user state changes
      this.loadComments();
    }
  };
  
  // Export to global scope
  window.BiluComments = BiluComments;
  
  // Auto-initialize if config is provided
  if (window.biluConfig) {
    BiluComments.init(window.biluConfig);
  }
})();
`;

export const demoHTML = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Bilu Enterprise Comments - Demo</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            line-height: 1.6;
            margin: 0;
            padding: 40px 20px;
            background: #f8f9fa;
            color: #333;
        }
        
        .container {
            max-width: 1000px;
            margin: 0 auto;
        }
        
        .header {
            text-align: center;
            margin-bottom: 48px;
            padding: 40px;
            background: white;
            border-radius: 12px;
            box-shadow: 0 2px 12px rgba(0,0,0,0.08);
        }
        
        .header h1 {
            margin: 0 0 16px 0;
            font-size: 36px;
            font-weight: 700;
            color: #2c3e50;
        }
        
        .header p {
            margin: 0;
            font-size: 18px;
            color: #666;
        }
        
        .article {
            background: white;
            padding: 40px;
            border-radius: 12px;
            box-shadow: 0 2px 12px rgba(0,0,0,0.08);
            margin-bottom: 32px;
        }
        
        .article h2 {
            color: #2c3e50;
            margin-top: 0;
        }
        
        .badge {
            display: inline-block;
            padding: 4px 12px;
            background: #3498db;
            color: white;
            border-radius: 20px;
            font-size: 12px;
            font-weight: 600;
            margin-bottom: 16px;
        }
        
        code {
            background: #f8f9fa;
            padding: 2px 6px;
            border-radius: 4px;
            font-size: 14px;
        }
        
        .code-block {
            background: #2d3748;
            color: #e2e8f0;
            padding: 24px;
            border-radius: 8px;
            margin: 24px 0;
            overflow-x: auto;
        }
        
        .features {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
            gap: 24px;
            margin: 32px 0;
        }
        
        .feature {
            background: white;
            padding: 24px;
            border-radius: 8px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.05);
        }
        
        .feature h3 {
            margin-top: 0;
            color: #2c3e50;
        }
        
        .feature ul {
            padding-left: 20px;
        }
        
        .feature li {
            margin-bottom: 8px;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>Bilu Enterprise Comments</h1>
            <p>Professional-grade comment system for modern websites</p>
        </div>
        
        <div class="article">
            <div class="badge">Enterprise Features</div>
            <h2>Welcome to Bilu Enterprise Comments</h2>
            <p>This is a demonstration of our enterprise-grade comment system. Built on Cloudflare Workers with advanced features like user authentication, moderation tools, voting, reactions, and threaded discussions.</p>
            
            <div class="features">
                <div class="feature">
                    <h3>🔐 Authentication</h3>
                    <ul>
                        <li>JWT-based authentication</li>
                        <li>User registration and login</li>
                        <li>Profile management</li>
                        <li>Role-based permissions</li>
                    </ul>
                </div>
                
                <div class="feature">
                    <h3>💬 Advanced Comments</h3>
                    <ul>
                        <li>Threaded replies</li>
                        <li>Voting system</li>
                        <li>Emoji reactions</li>
                        <li>Anonymous comments</li>
                    </ul>
                </div>
                
                <div class="feature">
                    <h3>🛡️ Moderation</h3>
                    <ul>
                        <li>Admin dashboard</li>
                        <li>Automatic spam detection</li>
                        <li>Manual approval</li>
                        <li>User management</li>
                    </ul>
                </div>
                
                <div class="feature">
                    <h3>⚡ Performance</h3>
                    <ul>
                        <li>Cloudflare Workers</li>
                        <li>Global CDN</li>
                        <li>Rate limiting</li>
                        <li>Analytics tracking</li>
                    </ul>
                </div>
            </div>
            
            <h3>Easy Integration</h3>
            <p>Add comments to any website with just a few lines of code:</p>
            
            <div class="code-block">
&lt;div id="bilu-comments"&gt;&lt;/div&gt;
&lt;script src="https://your-worker.workers.dev/embed.js"&gt;&lt;/script&gt;
&lt;script&gt;
  BiluComments.init({
    container: 'bilu-comments',
    apiUrl: 'https://your-worker.workers.dev',
    theme: 'corporate',
    enableVoting: true,
    enableReactions: true,
    enableReplies: true,
    allowAnonymous: true
  });
&lt;/script&gt;
            </div>
            
            <p>Try the comment system below. You can sign up for an account or comment anonymously. Test features like voting, reactions, and threaded replies.</p>
        </div>
        
        <!-- Comments will be loaded here -->
        <div id="bilu-comments"></div>
    </div>
    
    <script>${embedScript}</script>
    <script>
        // Initialize the comment system
        BiluComments.init({
            container: 'bilu-comments',
            apiUrl: window.location.origin,
            theme: 'corporate',
            enableVoting: true,
            enableReactions: true,
            enableReplies: true,
            allowAnonymous: true,
            maxDepth: 3
        });
    </script>
</body>
</html>
`;