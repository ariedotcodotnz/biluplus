export const adminDashboardHTML = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Bilu Enterprise - Admin Dashboard</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: #f8f9fa;
            color: #333;
        }
        
        .dashboard {
            display: flex;
            min-height: 100vh;
        }
        
        .sidebar {
            width: 250px;
            background: #2c3e50;
            color: white;
            padding: 24px 0;
        }
        
        .sidebar h2 {
            padding: 0 24px 24px;
            border-bottom: 1px solid #34495e;
            margin-bottom: 24px;
        }
        
        .nav-item {
            display: block;
            padding: 12px 24px;
            color: #bdc3c7;
            text-decoration: none;
            transition: all 0.2s;
        }
        
        .nav-item:hover,
        .nav-item.active {
            background: #34495e;
            color: white;
        }
        
        .main-content {
            flex: 1;
            padding: 24px;
        }
        
        .header {
            background: white;
            padding: 16px 24px;
            border-radius: 8px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            margin-bottom: 24px;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        
        .stats-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
            gap: 24px;
            margin-bottom: 24px;
        }
        
        .stat-card {
            background: white;
            padding: 24px;
            border-radius: 8px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        
        .stat-number {
            font-size: 32px;
            font-weight: 700;
            color: #2c3e50;
            margin-bottom: 8px;
        }
        
        .stat-label {
            color: #666;
            font-size: 14px;
        }
        
        .content-section {
            background: white;
            border-radius: 8px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            overflow: hidden;
            margin-bottom: 24px;
        }
        
        .section-header {
            padding: 16px 24px;
            border-bottom: 1px solid #e9ecef;
            background: #f8f9fa;
        }
        
        .section-title {
            font-size: 18px;
            font-weight: 600;
            color: #2c3e50;
        }
        
        .table {
            width: 100%;
            border-collapse: collapse;
        }
        
        .table th,
        .table td {
            padding: 12px 24px;
            text-align: left;
            border-bottom: 1px solid #e9ecef;
        }
        
        .table th {
            background: #f8f9fa;
            font-weight: 600;
            color: #495057;
        }
        
        .btn {
            padding: 6px 12px;
            border: none;
            border-radius: 4px;
            font-size: 12px;
            cursor: pointer;
            text-decoration: none;
            display: inline-block;
            margin-right: 8px;
            transition: all 0.2s;
        }
        
        .btn-primary {
            background: #3498db;
            color: white;
        }
        
        .btn-success {
            background: #27ae60;
            color: white;
        }
        
        .btn-danger {
            background: #e74c3c;
            color: white;
        }
        
        .btn-warning {
            background: #f39c12;
            color: white;
        }
        
        .btn:hover {
            transform: translateY(-1px);
        }
        
        .badge {
            padding: 4px 8px;
            border-radius: 4px;
            font-size: 11px;
            font-weight: 600;
            text-transform: uppercase;
        }
        
        .badge-admin {
            background: #e74c3c;
            color: white;
        }
        
        .badge-moderator {
            background: #27ae60;
            color: white;
        }
        
        .badge-user {
            background: #6c757d;
            color: white;
        }
        
        .badge-active {
            background: #27ae60;
            color: white;
        }
        
        .badge-pending {
            background: #f39c12;
            color: white;
        }
        
        .badge-spam {
            background: #e74c3c;
            color: white;
        }
        
        .form-group {
            margin-bottom: 16px;
        }
        
        .form-label {
            display: block;
            margin-bottom: 4px;
            font-weight: 500;
            color: #495057;
        }
        
        .form-control {
            width: 100%;
            padding: 8px 12px;
            border: 1px solid #ced4da;
            border-radius: 4px;
            font-size: 14px;
        }
        
        .modal {
            display: none;
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0,0,0,0.5);
            z-index: 1000;
        }
        
        .modal-content {
            background: white;
            width: 90%;
            max-width: 500px;
            margin: 50px auto;
            border-radius: 8px;
            overflow: hidden;
        }
        
        .modal-header {
            padding: 16px 24px;
            background: #f8f9fa;
            border-bottom: 1px solid #e9ecef;
        }
        
        .modal-body {
            padding: 24px;
        }
        
        .modal-footer {
            padding: 16px 24px;
            background: #f8f9fa;
            border-top: 1px solid #e9ecef;
            text-align: right;
        }
        
        .comment-content {
            max-width: 300px;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        }
        
        .user-avatar {
            width: 32px;
            height: 32px;
            border-radius: 50%;
            margin-right: 8px;
        }
        
        .loading {
            text-align: center;
            padding: 40px;
            color: #666;
        }
        
        .error {
            background: #f8d7da;
            color: #721c24;
            padding: 12px 16px;
            border-radius: 4px;
            margin-bottom: 16px;
        }
        
        .success {
            background: #d4edda;
            color: #155724;
            padding: 12px 16px;
            border-radius: 4px;
            margin-bottom: 16px;
        }
        
        @media (max-width: 768px) {
            .dashboard {
                flex-direction: column;
            }
            
            .sidebar {
                width: 100%;
                order: 2;
            }
            
            .main-content {
                order: 1;
            }
            
            .stats-grid {
                grid-template-columns: 1fr;
            }
            
            .table {
                font-size: 12px;
            }
            
            .table th,
            .table td {
                padding: 8px 12px;
            }
        }
    </style>
</head>
<body>
    <div class="dashboard">
        <nav class="sidebar">
            <h2>Bilu Admin</h2>
            <a href="#" class="nav-item active" onclick="showSection('dashboard')">Dashboard</a>
            <a href="#" class="nav-item" onclick="showSection('comments')">Comments</a>
            <a href="#" class="nav-item" onclick="showSection('users')">Users</a>
            <a href="#" class="nav-item" onclick="showSection('sites')">Sites</a>
            <a href="#" class="nav-item" onclick="showSection('moderation')">Moderation</a>
            <a href="#" class="nav-item" onclick="showSection('settings')">Settings</a>
        </nav>
        
        <main class="main-content">
            <div class="header">
                <h1 id="page-title">Dashboard</h1>
                <div>
                    <span id="user-name">Admin User</span>
                    <button class="btn btn-danger" onclick="logout()">Logout</button>
                </div>
            </div>
            
            <div id="dashboard-section">
                <div class="stats-grid">
                    <div class="stat-card">
                        <div class="stat-number" id="stat-users">-</div>
                        <div class="stat-label">Active Users</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-number" id="stat-comments">-</div>
                        <div class="stat-label">Total Comments</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-number" id="stat-sites">-</div>
                        <div class="stat-label">Sites</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-number" id="stat-pending">-</div>
                        <div class="stat-label">Pending Moderation</div>
                    </div>
                </div>
                
                <div class="content-section">
                    <div class="section-header">
                        <h3 class="section-title">Recent Activity</h3>
                    </div>
                    <div id="recent-activity" class="loading">
                        Loading...
                    </div>
                </div>
            </div>
            
            <div id="comments-section" style="display: none;">
                <div class="content-section">
                    <div class="section-header">
                        <h3 class="section-title">All Comments</h3>
                    </div>
                    <div id="comments-list" class="loading">
                        Loading comments...
                    </div>
                </div>
            </div>
            
            <div id="users-section" style="display: none;">
                <div class="content-section">
                    <div class="section-header">
                        <h3 class="section-title">User Management</h3>
                    </div>
                    <div id="users-list" class="loading">
                        Loading users...
                    </div>
                </div>
            </div>
            
            <div id="sites-section" style="display: none;">
                <div class="content-section">
                    <div class="section-header">
                        <h3 class="section-title">Sites</h3>
                    </div>
                    <div id="sites-list" class="loading">
                        Loading sites...
                    </div>
                </div>
            </div>
            
            <div id="moderation-section" style="display: none;">
                <div class="content-section">
                    <div class="section-header">
                        <h3 class="section-title">Pending Moderation</h3>
                    </div>
                    <div id="moderation-list" class="loading">
                        Loading pending comments...
                    </div>
                </div>
            </div>
            
            <div id="settings-section" style="display: none;">
                <div class="content-section">
                    <div class="section-header">
                        <h3 class="section-title">System Settings</h3>
                    </div>
                    <div style="padding: 24px;">
                        <p>Settings panel - Configure global options, API keys, and system preferences.</p>
                    </div>
                </div>
            </div>
        </main>
    </div>
    
    <!-- Moderation Modal -->
    <div id="moderate-modal" class="modal">
        <div class="modal-content">
            <div class="modal-header">
                <h4>Moderate Comment</h4>
            </div>
            <div class="modal-body">
                <div id="comment-preview"></div>
                <div class="form-group">
                    <label class="form-label">Reason (optional)</label>
                    <textarea id="moderation-reason" class="form-control" rows="3" placeholder="Reason for this action..."></textarea>
                </div>
            </div>
            <div class="modal-footer">
                <button class="btn btn-success" onclick="moderateComment('approve')">Approve</button>
                <button class="btn btn-warning" onclick="moderateComment('reject')">Reject</button>
                <button class="btn btn-danger" onclick="moderateComment('spam')">Mark as Spam</button>
                <button class="btn" onclick="closeModal()">Cancel</button>
            </div>
        </div>
    </div>
    
    <script>
        let currentUser = null;
        let currentCommentId = null;
        const apiBase = window.location.origin;
        
        // Authentication
        function getToken() {
            return localStorage.getItem('bilu_admin_token');
        }
        
        function setToken(token) {
            localStorage.setItem('bilu_admin_token', token);
        }
        
        function clearToken() {
            localStorage.removeItem('bilu_admin_token');
        }
        
        async function checkAuth() {
            const token = getToken();
            if (!token) {
                showLogin();
                return false;
            }
            
            try {
                const response = await fetch(apiBase + '/auth/me', {
                    headers: { 'Authorization': 'Bearer ' + token }
                });
                
                if (response.ok) {
                    const data = await response.json();
                    currentUser = data.user;
                    
                    if (currentUser.role !== 'admin') {
                        alert('Admin access required');
                        logout();
                        return false;
                    }
                    
                    document.getElementById('user-name').textContent = currentUser.display_name;
                    return true;
                } else {
                    clearToken();
                    showLogin();
                    return false;
                }
            } catch (error) {
                console.error('Auth check failed:', error);
                showLogin();
                return false;
            }
        }
        
        function showLogin() {
            const email = prompt('Admin Email:');
            const password = prompt('Password:');
            
            if (email && password) {
                login(email, password);
            }
        }
        
        async function login(email, password) {
            try {
                const response = await fetch(apiBase + '/auth/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email, password })
                });
                
                if (response.ok) {
                    const data = await response.json();
                    setToken(data.token);
                    location.reload();
                } else {
                    alert('Login failed');
                }
            } catch (error) {
                console.error('Login failed:', error);
                alert('Login failed');
            }
        }
        
        function logout() {
            clearToken();
            location.reload();
        }
        
        // Navigation
        function showSection(section) {
            // Hide all sections
            const sections = ['dashboard', 'comments', 'users', 'sites', 'moderation', 'settings'];
            sections.forEach(s => {
                document.getElementById(s + '-section').style.display = 'none';
            });
            
            // Show selected section
            document.getElementById(section + '-section').style.display = 'block';
            
            // Update nav
            document.querySelectorAll('.nav-item').forEach(item => {
                item.classList.remove('active');
            });
            event.target.classList.add('active');
            
            // Update title
            document.getElementById('page-title').textContent = 
                section.charAt(0).toUpperCase() + section.slice(1);
            
            // Load section data
            loadSectionData(section);
        }
        
        async function loadSectionData(section) {
            const token = getToken();
            const headers = { 'Authorization': 'Bearer ' + token };
            
            try {
                switch (section) {
                    case 'dashboard':
                        await loadDashboard();
                        break;
                    case 'comments':
                        await loadComments();
                        break;
                    case 'users':
                        await loadUsers();
                        break;
                    case 'sites':
                        await loadSites();
                        break;
                    case 'moderation':
                        await loadModeration();
                        break;
                }
            } catch (error) {
                console.error('Failed to load section data:', error);
            }
        }
        
        async function loadDashboard() {
            const token = getToken();
            const headers = { 'Authorization': 'Bearer ' + token };
            
            try {
                const response = await fetch(apiBase + '/admin/stats', { headers });
                if (response.ok) {
                    const stats = await response.json();
                    document.getElementById('stat-users').textContent = stats.users;
                    document.getElementById('stat-comments').textContent = stats.comments;
                    document.getElementById('stat-sites').textContent = stats.sites;
                    document.getElementById('stat-pending').textContent = stats.pending;
                }
                
                document.getElementById('recent-activity').innerHTML = 
                    '<p style="padding: 20px; color: #666;">No recent activity</p>';
            } catch (error) {
                console.error('Failed to load dashboard:', error);
            }
        }
        
        async function loadUsers() {
            const token = getToken();
            const headers = { 'Authorization': 'Bearer ' + token };
            
            try {
                const response = await fetch(apiBase + '/admin/users', { headers });
                if (response.ok) {
                    const data = await response.json();
                    renderUsers(data.users);
                }
            } catch (error) {
                console.error('Failed to load users:', error);
            }
        }
        
        function renderUsers(users) {
            const html = \`
                <table class="table">
                    <thead>
                        <tr>
                            <th>User</th>
                            <th>Email</th>
                            <th>Role</th>
                            <th>Status</th>
                            <th>Joined</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        \${users.map(user => \`
                            <tr>
                                <td>\${user.display_name}</td>
                                <td>\${user.email}</td>
                                <td><span class="badge badge-\${user.role}">\${user.role}</span></td>
                                <td><span class="badge badge-\${user.status}">\${user.status}</span></td>
                                <td>\${new Date(user.created_at).toLocaleDateString()}</td>
                                <td>
                                    <button class="btn btn-primary" onclick="editUser(\${user.id})">Edit</button>
                                    \${user.status === 'active' ? 
                                        \`<button class="btn btn-warning" onclick="suspendUser(\${user.id})">Suspend</button>\` :
                                        \`<button class="btn btn-success" onclick="activateUser(\${user.id})">Activate</button>\`
                                    }
                                </td>
                            </tr>
                        \`).join('')}
                    </tbody>
                </table>
            \`;
            document.getElementById('users-list').innerHTML = html;
        }
        
        async function loadSites() {
            const token = getToken();
            const headers = { 'Authorization': 'Bearer ' + token };
            
            try {
                const response = await fetch(apiBase + '/admin/sites', { headers });
                if (response.ok) {
                    const data = await response.json();
                    renderSites(data.sites);
                }
            } catch (error) {
                console.error('Failed to load sites:', error);
            }
        }
        
        function renderSites(sites) {
            const html = \`
                <table class="table">
                    <thead>
                        <tr>
                            <th>Domain</th>
                            <th>Name</th>
                            <th>Owner</th>
                            <th>Created</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        \${sites.map(site => \`
                            <tr>
                                <td>\${site.domain}</td>
                                <td>\${site.name}</td>
                                <td>\${site.owner_username}</td>
                                <td>\${new Date(site.created_at).toLocaleDateString()}</td>
                                <td>
                                    <button class="btn btn-primary">Configure</button>
                                </td>
                            </tr>
                        \`).join('')}
                    </tbody>
                </table>
            \`;
            document.getElementById('sites-list').innerHTML = html;
        }
        
        async function loadModeration() {
            const token = getToken();
            const headers = { 'Authorization': 'Bearer ' + token };
            
            try {
                const response = await fetch(apiBase + '/admin/comments/pending', { headers });
                if (response.ok) {
                    const data = await response.json();
                    renderPendingComments(data.comments);
                }
            } catch (error) {
                console.error('Failed to load pending comments:', error);
            }
        }
        
        function renderPendingComments(comments) {
            if (comments.length === 0) {
                document.getElementById('moderation-list').innerHTML = 
                    '<p style="padding: 20px; color: #666;">No comments pending moderation</p>';
                return;
            }
            
            const html = \`
                <table class="table">
                    <thead>
                        <tr>
                            <th>Author</th>
                            <th>Comment</th>
                            <th>Page</th>
                            <th>Date</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        \${comments.map(comment => \`
                            <tr>
                                <td>\${comment.user?.display_name || comment.author_name}</td>
                                <td class="comment-content">\${comment.content}</td>
                                <td>\${comment.page_url}</td>
                                <td>\${new Date(comment.created_at).toLocaleDateString()}</td>
                                <td>
                                    <button class="btn btn-primary" onclick="openModerationModal(\${comment.id}, '\${comment.content}')">Review</button>
                                </td>
                            </tr>
                        \`).join('')}
                    </tbody>
                </table>
            \`;
            document.getElementById('moderation-list').innerHTML = html;
        }
        
        function openModerationModal(commentId, content) {
            currentCommentId = commentId;
            document.getElementById('comment-preview').innerHTML = \`
                <div style="background: #f8f9fa; padding: 16px; border-radius: 4px; margin-bottom: 16px;">
                    <strong>Comment Content:</strong><br>
                    \${content}
                </div>
            \`;
            document.getElementById('moderate-modal').style.display = 'block';
        }
        
        function closeModal() {
            document.getElementById('moderate-modal').style.display = 'none';
            currentCommentId = null;
            document.getElementById('moderation-reason').value = '';
        }
        
        async function moderateComment(action) {
            if (!currentCommentId) return;
            
            const token = getToken();
            const reason = document.getElementById('moderation-reason').value;
            
            try {
                const response = await fetch(apiBase + \`/admin/comments/\${currentCommentId}/moderate\`, {
                    method: 'POST',
                    headers: {
                        'Authorization': 'Bearer ' + token,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ action, reason })
                });
                
                if (response.ok) {
                    closeModal();
                    loadModeration(); // Reload pending comments
                    loadDashboard(); // Update stats
                    alert('Comment moderated successfully');
                } else {
                    alert('Moderation failed');
                }
            } catch (error) {
                console.error('Moderation failed:', error);
                alert('Moderation failed');
            }
        }
        
        // Initialize
        document.addEventListener('DOMContentLoaded', async function() {
            if (await checkAuth()) {
                loadDashboard();
            }
        });
        
        // Modal click outside to close
        window.onclick = function(event) {
            const modal = document.getElementById('moderate-modal');
            if (event.target === modal) {
                closeModal();
            }
        }
    </script>
</body>
</html>
`;`;