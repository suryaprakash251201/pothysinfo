const path = require('path');
const fs = require('fs');
const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const AWS = require('aws-sdk');

loadEnvironment();

const app = express();
const PORT = process.env.PORT || 3000;
const ROOT_DIR = __dirname;
const BUCKET = process.env.CLOUDPE_BUCKET;
const POSTS_PREFIX = 'posts/';

const s3 = new AWS.S3({
    accessKeyId: process.env.CLOUDPE_ACCESS_KEY,
    secretAccessKey: process.env.CLOUDPE_SECRET_KEY,
    endpoint: normalizeEndpoint(process.env.CLOUDPE_ENDPOINT),
    s3ForcePathStyle: true,
    signatureVersion: 'v4',
});

app.use(cors());
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(express.static(ROOT_DIR));

app.get('/', (req, res) => {
    res.set('Cache-Control', 'no-store');
    res.sendFile(path.join(ROOT_DIR, 'index.html'));
});

app.get('/blog', (req, res) => {
    res.set('Cache-Control', 'no-store');
    res.sendFile(path.join(ROOT_DIR, 'blog.html'));
});

app.get('/admin', (req, res) => {
    res.set('Cache-Control', 'no-store');
    res.sendFile(path.join(ROOT_DIR, 'admin.html'));
});

app.get('/api/health', (req, res) => {
    res.json({ ok: true, service: 'pothysinfo-blog-api' });
});

// Simple authentication endpoint - validates against ADMIN_USERNAME/ADMIN_PASSWORD in .env
app.post('/api/login', (req, res) => {
    const { username, password } = req.body || {};

    if (!username || !password) {
        return res.status(400).json({ error: 'Missing username or password' });
    }

    const envUser = process.env.ADMIN_USERNAME || 'admin';
    const envPass = process.env.ADMIN_PASSWORD || 'Admin@2026';

    if (username === envUser && password === envPass) {
        return res.json({ success: true, message: 'Authenticated' });
    }

    return res.status(401).json({ success: false, error: 'Invalid username or password' });
});

app.get('/api/posts', async (req, res) => {
    try {
        const posts = await listPosts();
        res.json(posts);
    } catch (error) {
        console.error('Failed to list posts:', error);
        res.status(500).json({ error: 'Failed to load posts' });
    }
});

app.get('/api/posts/:id', async (req, res) => {
    try {
        const post = await getPostById(req.params.id);
        if (!post) {
            return res.status(404).json({ error: 'Post not found' });
        }
        res.json(post);
    } catch (error) {
        console.error('Failed to load post:', error);
        res.status(500).json({ error: 'Failed to load post' });
    }
});

app.post('/api/posts', async (req, res) => {
    try {
        const post = normalizePost(req.body);
        if (!post.title || !post.content) {
            return res.status(400).json({ error: 'Title and content are required' });
        }

        await putPost(post);
        res.json({ success: true, post });
    } catch (error) {
        console.error('Failed to save post:', error);
        res.status(500).json({ error: 'Failed to save post' });
    }
});

app.delete('/api/posts/:id', async (req, res) => {
    try {
        await s3.deleteObject({
            Bucket: BUCKET,
            Key: `${POSTS_PREFIX}post-${req.params.id}.json`,
        }).promise();

        res.json({ success: true });
    } catch (error) {
        console.error('Failed to delete post:', error);
        res.status(500).json({ error: 'Failed to delete post' });
    }
});

async function listPosts() {
    if (!BUCKET) {
        throw new Error('CLOUDPE_BUCKET is not configured');
    }

    const response = await s3.listObjectsV2({
        Bucket: BUCKET,
        Prefix: POSTS_PREFIX,
    }).promise();

    const keys = (response.Contents || [])
        .map(item => item.Key)
        .filter(key => key && key.endsWith('.json'));

    if (keys.length === 0) {
        const seedPosts = getSeedPosts();
        await Promise.all(seedPosts.map(putPost));
        return seedPosts.sort((a, b) => b.createdAt - a.createdAt);
    }

    const posts = await Promise.all(keys.map(async (key) => {
        const result = await s3.getObject({ Bucket: BUCKET, Key: key }).promise();
        return JSON.parse(result.Body.toString('utf8'));
    }));

    return posts.sort((a, b) => b.createdAt - a.createdAt);
}

async function getPostById(id) {
    if (!BUCKET) {
        throw new Error('CLOUDPE_BUCKET is not configured');
    }

    try {
        const result = await s3.getObject({
            Bucket: BUCKET,
            Key: `${POSTS_PREFIX}post-${id}.json`,
        }).promise();

        return JSON.parse(result.Body.toString('utf8'));
    } catch (error) {
        if (error.code === 'NoSuchKey' || error.statusCode === 404) {
            return null;
        }
        throw error;
    }
}

async function putPost(post) {
    if (!BUCKET) {
        throw new Error('CLOUDPE_BUCKET is not configured');
    }

    const normalized = normalizePost(post);
    const key = `${POSTS_PREFIX}post-${normalized.id}.json`;

    await s3.putObject({
        Bucket: BUCKET,
        Key: key,
        Body: JSON.stringify(normalized),
        ContentType: 'application/json; charset=utf-8',
    }).promise();

    return normalized;
}

function normalizePost(post) {
    const now = Date.now();
    const id = Number(post.id) || now;
    const createdAt = Number(post.createdAt) || id;
    const updatedAt = Number(post.updatedAt) || now;
    const title = String(post.title || '').trim();
    const category = String(post.category || 'Other').trim();
    const author = String(post.author || 'Admin').trim() || 'Admin';
    const excerpt = String(post.excerpt || '').trim();
    const content = String(post.content || '').trim();
    const status = post.status === 'published' ? 'published' : 'draft';
    const slug = String(post.slug || slugify(title) || `post-${id}`);
    const date = post.date || formatDate(updatedAt);
    const cover = String(post.cover || '').trim();
    const tags = Array.isArray(post.tags)
        ? post.tags.map(tag => String(tag).trim()).filter(Boolean)
        : String(post.tags || '')
            .split(',')
            .map(tag => tag.trim())
            .filter(Boolean);

    return {
        id,
        slug,
        title,
        category,
        author,
        status,
        excerpt,
        content,
        cover,
        tags,
        date,
        createdAt,
        updatedAt,
    };
}

function slugify(value) {
    return String(value || '')
        .toLowerCase()
        .replace(/[^\w\s-]/g, '')
        .replace(/[\s_]+/g, '-')
        .replace(/^-+|-+$/g, '');
}

function formatDate(timestamp) {
    const date = new Date(timestamp);
    return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
    });
}

function getSeedPosts() {
    const now = Date.now();
    const day = 86400000;

    return [
        {
            id: now - day * 3,
            slug: 'building-ai-powered-web-apps-in-2026',
            title: 'Building AI-Powered Web Apps in 2026',
            category: 'AI',
            author: 'Admin',
            status: 'published',
            excerpt: 'Explore the latest tools and frameworks for integrating AI capabilities into your web applications.',
            content: '<h2>Introduction</h2><p>Artificial intelligence is now a practical layer in modern web development. This post gives you a production-focused way to use it.</p><h3>What to focus on</h3><ul><li>Prompt design</li><li>Streaming responses</li><li>Context handling</li><li>Cost control</li></ul>',
            cover: 'https://images.unsplash.com/photo-1677442136019-21780ecad995?w=1200&q=80',
            tags: ['ai', 'web', 'javascript'],
            date: formatDate(now - day * 3),
            createdAt: now - day * 3,
            updatedAt: now - day * 3,
        },
        {
            id: now - day * 2,
            slug: 'my-full-stack-dev-setup-tools-i-use-daily',
            title: 'My Full-Stack Dev Setup: Tools I Use Daily',
            category: 'Dev',
            author: 'Admin',
            status: 'published',
            excerpt: 'A detailed breakdown of my complete development environment and the tools that keep me fast.',
            content: '<h2>Development Stack</h2><p>Productivity comes from keeping the stack simple, repeatable, and stable.</p><h3>Core tools</h3><ul><li>VS Code</li><li>PowerShell</li><li>Git</li><li>Postman</li></ul>',
            cover: 'https://images.unsplash.com/photo-1517694712202-14dd9538aa97?w=1200&q=80',
            tags: ['tools', 'development', 'productivity'],
            date: formatDate(now - day * 2),
            createdAt: now - day * 2,
            updatedAt: now - day * 2,
        },
        {
            id: now - day,
            slug: 'why-micro-saas-is-the-best-bet-for-solo-devs',
            title: 'Why Micro-SaaS Is the Best Bet for Solo Devs',
            category: 'Startup',
            author: 'Admin',
            status: 'draft',
            excerpt: 'A strategic analysis of why building small focused SaaS products is a strong path for independent developers.',
            content: '<h2>Micro-SaaS Thesis</h2><p>Small products are easier to validate, easier to maintain, and easier to evolve.</p>',
            cover: '',
            tags: ['startup', 'business'],
            date: formatDate(now - day),
            createdAt: now - day,
            updatedAt: now - day,
        },
    ].map(normalizePost);
}

function normalizeEndpoint(endpoint) {
    return String(endpoint || '').trim().replace(/\/+$/, '');
}

function loadEnvironment() {
    const envPath = path.join(__dirname, '.env');
    const result = dotenv.config({ path: envPath });

    // Some editors save .env as UTF-16LE; dotenv parses that as an empty object.
    if ((!result.parsed || Object.keys(result.parsed).length === 0) && fs.existsSync(envPath)) {
        const rawBuffer = fs.readFileSync(envPath);

        // Null bytes in UTF-8 output are a strong signal of UTF-16LE encoding.
        const utf8Text = rawBuffer.toString('utf8');
        const envText = utf8Text.includes('\u0000')
            ? rawBuffer.toString('utf16le')
            : utf8Text;

        const reparsed = dotenv.parse(envText);
        Object.entries(reparsed).forEach(([key, value]) => {
            if (!process.env[key]) {
                process.env[key] = value;
            }
        });
    }
}

async function bootstrap() {
    if (!BUCKET) {
        console.warn('CLOUDPE_BUCKET is not set. API routes will return errors until configured.');
    }

    if (!process.env.ADMIN_USERNAME || !process.env.ADMIN_PASSWORD) {
        console.warn('ADMIN_USERNAME or ADMIN_PASSWORD not set; default credentials will be used for local development.');
    }

    app.listen(PORT, () => {
        console.log(`Pothys blog server running on http://localhost:${PORT}`);
    });
}

bootstrap().catch(error => {
    console.error('Failed to start server:', error);
    process.exit(1);
});
