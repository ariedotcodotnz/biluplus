import { Hono } from 'hono';
import { cors } from 'hono/cors';

type Bindings = {
  DB?: D1Database;
  KV?: KVNamespace;
  JWT_SECRET?: string;
  ADMIN_EMAIL?: string;
  ANALYTICS?: AnalyticsEngineDataset;
};

const app = new Hono<{ Bindings: Bindings }>();

// CORS
app.use('*', cors());

// Health check
app.get('/health', (c) => {
  return c.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    version: '2.0.0'
  });
});

// Simple demo
app.get('/', (c) => {
  return c.html(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Bilu Enterprise Comments - Setup</title>
      <style>
        body { 
          font-family: system-ui, sans-serif; 
          max-width: 800px; 
          margin: 50px auto; 
          padding: 20px;
          background: #f5f5f5;
        }
        .container {
          background: white;
          padding: 40px;
          border-radius: 8px;
          box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        h1 { color: #2c3e50; }
        .status { 
          padding: 15px; 
          border-radius: 5px; 
          margin: 15px 0;
        }
        .success { background: #d4edda; color: #155724; border: 1px solid #c3e6cb; }
        .error { background: #f8d7da; color: #721c24; border: 1px solid #f5c6cb; }
        .info { background: #cce7ff; color: #004085; border: 1px solid #b3d7ff; }
        pre { background: #f8f9fa; padding: 10px; border-radius: 4px; }
        .setup-step { 
          background: #fff3cd; 
          border: 1px solid #ffeaa7; 
          padding: 15px; 
          border-radius: 5px; 
          margin: 10px 0; 
        }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>🚀 Bilu Enterprise Comments</h1>
        <div class="success">✅ Worker is running successfully!</div>
        
        <h2>Setup Status</h2>
        <div class="info">
          <strong>Current Status:</strong> Basic worker deployed<br>
          <strong>Database:</strong> ${c.env.DB ? '✅ Connected' : '❌ Not configured'}<br>
          <strong>KV Storage:</strong> ${c.env.KV ? '✅ Connected' : '❌ Not configured'}<br>
          <strong>JWT Secret:</strong> ${c.env.JWT_SECRET ? '✅ Set' : '❌ Not set'}<br>
          <strong>Analytics:</strong> ${c.env.ANALYTICS ? '✅ Connected' : '❌ Not configured'}
        </div>
        
        <h2>Next Steps</h2>
        <div class="setup-step">
          <strong>1. Database Setup</strong><br>
          Run: <code>npx wrangler d1 migrations apply bilu-enterprise --local</code>
        </div>
        
        <div class="setup-step">
          <strong>2. Test API</strong><br>
          Visit: <a href="/health">/health</a> - Should return JSON status
        </div>
        
        <div class="setup-step">
          <strong>3. Enable Full Features</strong><br>
          Update wrangler.jsonc main to: <code>src/index-v2.ts</code>
        </div>
        
        <h2>Quick Test</h2>
        <p>Try these endpoints:</p>
        <ul>
          <li><a href="/health">/health</a> - Health check</li>
          <li><a href="/test">/test</a> - Simple test</li>
        </ul>
      </div>
    </body>
    </html>
  `);
});

// Test endpoint
app.get('/test', (c) => {
  return c.json({
    message: 'Test endpoint working!',
    timestamp: new Date().toISOString(),
    env: {
      hasDB: !!c.env.DB,
      hasKV: !!c.env.KV,
      hasJWTSecret: !!c.env.JWT_SECRET,
      hasAnalytics: !!c.env.ANALYTICS
    }
  });
});

// Catch all 404
app.notFound((c) => {
  return c.json({ error: 'Not Found', path: c.req.path }, 404);
});

export default app;