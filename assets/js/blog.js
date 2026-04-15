/**
 * Blog Post Management & Rendering
 * Handles post listing, filtering, search, and single post view
 */

// ==================== INITIALIZATION ====================

document.addEventListener('DOMContentLoaded', () => {
    void initializeBlog();
    setupThemeToggle();
    setupEventListeners();
    refreshIcons();
});

async function initializeBlog() {
    await syncPostsFromApi();
    renderPostsListing();
    updateCategoryFilters();
    updateResultsSummary(getPublishedPosts().length, 'all');
}

// ==================== SAMPLE DATA INITIALIZATION ====================

function initializeSamplePosts() {
    const samplePosts = [
        {
            id: Date.now() - 86400000 * 3, // 3 days ago
            slug: 'building-ai-powered-web-apps-in-2026',
            title: 'Building AI-Powered Web Apps in 2026',
            category: 'AI',
            author: 'Admin',
            status: 'published',
            excerpt: 'Explore the latest tools and frameworks for integrating AI capabilities into your web applications. A comprehensive guide to LLMs, embeddings, and practical implementation.',
            content: '<h2>Introduction</h2><p>Artificial Intelligence has become an integral part of modern web development. In this article, we\'ll explore how to build AI-powered web applications using the latest tools and best practices.</p><h3>Key Technologies</h3><ul><li>OpenAI API integration</li><li>Vector databases for semantic search</li><li>Prompt engineering techniques</li><li>Real-time streaming responses</li></ul><p>These technologies enable developers to create intelligent applications that can understand context and provide meaningful interactions.</p>',
            cover: 'https://images.unsplash.com/photo-1677442d019cecf8f7575b7875c888bbb?w=800&q=80',
            tags: ['ai', 'web', 'javascript', 'api'],
            date: 'April 12, 2026',
            createdAt: Date.now() - 86400000 * 3,
            updatedAt: Date.now() - 86400000 * 3
        },
        {
            id: Date.now() - 86400000 * 2, // 2 days ago
            slug: 'full-stack-dev-setup-tools-i-use-daily',
            title: 'My Full-Stack Dev Setup: Tools I Use Daily',
            category: 'Dev',
            author: 'Admin',
            status: 'published',
            excerpt: 'A detailed breakdown of my complete development environment, including editor setup, terminals, databases, and deployment tools that maximize productivity.',
            content: '<h2>My Development Stack 2026</h2><p>After years of experimentation, I\'ve settled on a productive development setup.</p><h3>Editor & IDE</h3><p>VS Code remains my primary editor with essential extensions for linting, formatting, and version control integration.</p><h3>Terminal & Shell</h3><p>PowerShell with specialized prompts and aliases for rapid development.</p><h3>Databases</h3><p>PostgreSQL for relational data, Redis for caching, and MongoDB for flexible schemas.</p><p>This combination gives me flexibility to choose the right tool for each project.</p>',
            cover: 'https://images.unsplash.com/photo-1517694712202-14dd9538aa97?w=800&q=80',
            tags: ['tools', 'development', 'productivity', 'setup'],
            date: 'April 13, 2026',
            createdAt: Date.now() - 86400000 * 2,
            updatedAt: Date.now() - 86400000 * 2
        },
        {
            id: Date.now() - 86400000, // 1 day ago
            slug: 'why-micro-saas-is-best-bet-for-solo-devs',
            title: 'Why Micro-SaaS Is the Best Bet for Solo Devs',
            category: 'Startup',
            author: 'Admin',
            status: 'draft',
            excerpt: 'A strategic analysis of why building small, focused SaaS products is the ideal path for independent developers in 2026.',
            content: '<h2>The Case for Micro-SaaS</h2><p>Solo developers have a unique advantage in the market.</p><h3>Benefits</h3><ul><li>Low overhead costs</li><li>Quick iteration cycles</li><li>Direct customer relationships</li><li>Niche market opportunities</li></ul><p>Success requires focus, persistence, and continuous learning.</p>',
            cover: '',
            tags: ['startup', 'business', 'solo-dev'],
            date: 'April 14, 2026',
            createdAt: Date.now() - 86400000,
            updatedAt: Date.now() - 86400000
        }
    ];

    localStorage.setItem('blogPosts', JSON.stringify(samplePosts));
}

async function syncPostsFromApi() {
    const apiBase = getApiBaseUrl();
    const controller = new AbortController();
    const timeoutMs = 1800;
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
        const response = await fetch(`${apiBase}/posts`, {
            headers: { 'Accept': 'application/json' },
            signal: controller.signal,
        });

        clearTimeout(timer);

        if (!response.ok) {
            throw new Error(`API request failed with ${response.status}`);
        }

        const posts = await response.json();
        if (Array.isArray(posts) && posts.length > 0) {
            localStorage.setItem('blogPosts', JSON.stringify(posts));
            return;
        }
    } catch (error) {
        if (error.name === 'AbortError') {
            console.warn(`Blog API timed out after ${timeoutMs}ms, using local cache.`);
        } else {
            console.warn('Blog API unavailable, using local cache.', error);
        }
    } finally {
        clearTimeout(timer);
    }

    if (!localStorage.getItem('blogPosts')) {
        initializeSamplePosts();
    }
}

function getApiBaseUrl() {
    if (window.location.protocol === 'file:') {
        return 'http://localhost:3000/api';
    }

    return `${window.location.origin}/api`;
}

// ==================== DATA RETRIEVAL ====================

function getAllPosts() {
    const posts = JSON.parse(localStorage.getItem('blogPosts') || '[]');
    return posts.sort((a, b) => b.createdAt - a.createdAt);
}

function getPublishedPosts() {
    return getAllPosts().filter(post => post.status === 'published');
}

function getPost(id) {
    return getAllPosts().find(post => post.id == id);
}

function getCategories() {
    const posts = getPublishedPosts();
    const categories = new Set(posts.map(p => p.category));
    return Array.from(categories).sort();
}

// ==================== RENDERING FUNCTIONS ====================

function renderPostsListing() {
    const allPosts = getPublishedPosts();
    const grid = document.getElementById('postsGrid');
    const noPostsMsg = document.getElementById('noPostsMessage');

    if (allPosts.length === 0) {
        grid.innerHTML = '';
        setNoPostsMessage('No posts found. Check back soon!');
        noPostsMsg.style.display = 'block';
        updateResultsSummary(0, 'all');
        return;
    }

    noPostsMsg.style.display = 'none';
    grid.innerHTML = allPosts.map(post => createPostCard(post)).join('');
    updateResultsSummary(allPosts.length, 'all');

    // Add click handlers to cards
    document.querySelectorAll('.post-card').forEach(card => {
        card.addEventListener('click', () => showSinglePostView(card.dataset.postId));
    });

    refreshIcons();
}

function createPostCard(post) {
    const categoryColor = getCategoryColor(post.category);
    const cover = post.cover || `linear-gradient(135deg, #4f46e5, #6366f1)`;
    const imageStyle = post.cover ? `background-image: url('${post.cover}')` : `background: ${cover}`;
    const readingTime = estimateReadingTime(post.content || post.excerpt);

    return `
        <div class="post-card" data-post-id="${post.id}">
            <div class="post-card-image" style="${imageStyle}"></div>
            <div class="post-card-body">
                <span class="post-card-category" style="background-color: ${categoryColor}20; color: ${categoryColor};">
                    ${post.category}
                </span>
                <h3 class="post-card-title">${escapeHtml(post.title)}</h3>
                <p class="post-card-excerpt">${escapeHtml(post.excerpt)}</p>
                <div class="post-card-meta">
                    <div class="post-author-avatar">${post.author.charAt(0).toUpperCase()}</div>
                    <div>
                        <div style="font-weight: 600;">${escapeHtml(post.author)}</div>
                        <div>${post.date} - ${readingTime} min read</div>
                    </div>
                </div>
            </div>
        </div>
    `;
}

function showSinglePostView(postId) {
    const post = getPost(postId);
    if (!post) return;

    document.getElementById('postsListing').style.display = 'none';
    document.getElementById('singlePostView').style.display = 'block';

    // Populate single post view
    document.getElementById('singlePostTitle').textContent = post.title;
    document.getElementById('singleAuthorName').textContent = post.author;
    document.getElementById('singlePostDate').textContent = post.date;
    document.getElementById('singlePostContent').innerHTML = post.content;
    
    // Set category badge
    const categoryBadge = document.getElementById('singleCategoryBadge');
    const categoryColor = getCategoryColor(post.category);
    categoryBadge.textContent = post.category;
    categoryBadge.style.backgroundColor = categoryColor;

    // Set author avatar initial
    document.getElementById('singleAuthorAvatar').textContent = post.author.charAt(0).toUpperCase();

    // Set cover image
    const coverImg = document.getElementById('singlePostCover');
    if (post.cover) {
        coverImg.src = post.cover;
        coverImg.style.display = 'block';
    } else {
        coverImg.style.display = 'none';
    }

    // Render tags
    const tagsContainer = document.getElementById('singlePostTags');
    if (post.tags && post.tags.length > 0) {
        tagsContainer.innerHTML = `
            <div class="post-tags">
                ${post.tags.map(tag => `<span class="post-tag">#${escapeHtml(tag)}</span>`).join('')}
            </div>
        `;
        tagsContainer.style.display = 'block';
    } else {
        tagsContainer.style.display = 'none';
    }

    // Update share buttons
    updateShareButtons(post);
    
    window.scrollTo(0, 0);
    refreshIcons();
}

function updateShareButtons(post) {
    const currentUrl = window.location.href.split('?')[0];
    const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(post.title + ' by ' + post.author)}&url=${encodeURIComponent(currentUrl)}?post=${post.id}`;

    document.getElementById('twitterShareBtn').href = twitterUrl;

    const copyBtn = document.getElementById('copyLinkBtn');
    copyBtn.onclick = function(e) {
        e.preventDefault();
        const url = `${currentUrl}?post=${post.id}`;
        navigator.clipboard.writeText(url).then(() => {
            showNotification('Link copied to clipboard!');
        });
    };
}

// ==================== CATEGORY FILTERS ====================

function updateCategoryFilters() {
    const categories = getCategories();
    const filtersContainer = document.getElementById('categoryFilters');

    let html = '<button class="filter-pill active" data-category="all">All Posts</button>';
    
    categories.forEach(category => {
        html += `<button class="filter-pill" data-category="${category}">${category}</button>`;
    });

    filtersContainer.innerHTML = html;

    // Add click handlers
    document.querySelectorAll('.filter-pill').forEach(pill => {
        pill.addEventListener('click', function() {
            document.querySelectorAll('.filter-pill').forEach(p => p.classList.remove('active'));
            this.classList.add('active');
            filterPostsByCategory(this.dataset.category);
        });
    });
}

function filterPostsByCategory(category) {
    let posts = getPublishedPosts();

    if (category !== 'all') {
        posts = posts.filter(post => post.category === category);
    }

    const grid = document.getElementById('postsGrid');
    const noPostsMsg = document.getElementById('noPostsMessage');

    if (posts.length === 0) {
        grid.innerHTML = '';
        setNoPostsMessage(`No posts in ${category}.`);
        noPostsMsg.style.display = 'block';
        updateResultsSummary(0, category);
        return;
    }

    noPostsMsg.style.display = 'none';
    grid.innerHTML = posts.map(post => createPostCard(post)).join('');
    updateResultsSummary(posts.length, category);

    document.querySelectorAll('.post-card').forEach(card => {
        card.addEventListener('click', () => showSinglePostView(card.dataset.postId));
    });

    refreshIcons();
}

// ==================== SEARCH FUNCTIONALITY ====================

function setupEventListeners() {
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.addEventListener('input', debounce(performSearch, 300));
    }

    const backButton = document.getElementById('backButton');
    if (backButton) {
        backButton.addEventListener('click', returnToListing);
    }
}

function performSearch(e) {
    const query = e.target.value.toLowerCase().trim();
    let posts = getPublishedPosts();

    if (query) {
        posts = posts.filter(post =>
            post.title.toLowerCase().includes(query) ||
            post.excerpt.toLowerCase().includes(query) ||
            post.category.toLowerCase().includes(query) ||
            (post.tags && post.tags.some(tag => tag.toLowerCase().includes(query)))
        );
    }

    const grid = document.getElementById('postsGrid');
    const noPostsMsg = document.getElementById('noPostsMessage');

    if (posts.length === 0) {
        grid.innerHTML = '';
        setNoPostsMessage(query ? 'No posts found matching your search.' : 'No posts found. Check back soon!');
        noPostsMsg.style.display = 'block';
        updateResultsSummary(0, 'search');
        return;
    }

    noPostsMsg.style.display = 'none';
    grid.innerHTML = posts.map(post => createPostCard(post)).join('');
    updateResultsSummary(posts.length, query ? 'search' : 'all');

    document.querySelectorAll('.post-card').forEach(card => {
        card.addEventListener('click', () => showSinglePostView(card.dataset.postId));
    });

    refreshIcons();
}

function returnToListing() {
    document.getElementById('singlePostView').style.display = 'none';
    document.getElementById('postsListing').style.display = 'block';
    updateResultsSummary(getPublishedPosts().length, 'all');
    window.scrollTo(0, 0);
}

// ==================== THEME MANAGEMENT ====================

function setupThemeToggle() {
    const themeToggle = document.getElementById('themeToggle');
    const htmlElement = document.documentElement;

    // Load saved theme
    const savedTheme = localStorage.getItem('theme') || 'light';
    applyTheme(savedTheme);

    if (themeToggle) {
        themeToggle.addEventListener('click', () => {
            const currentTheme = localStorage.getItem('theme') || 'light';
            const newTheme = currentTheme === 'light' ? 'dark' : 'light';
            applyTheme(newTheme);
            localStorage.setItem('theme', newTheme);
        });
    }
}

function applyTheme(theme) {
    document.documentElement.setAttribute('data-bs-theme', theme);
    localStorage.setItem('theme', theme);
}

// ==================== UTILITY FUNCTIONS ====================

function getCategoryColor(category) {
    const colors = {
        'Technology': '#4f46e5',
        'Design': '#ec4899',
        'AI': '#6366f1',
        'Dev': '#818cf8',
        'Startup': '#a78bfa',
        'Business': '#7c3aed',
        'Other': '#475569'
    };
    return colors[category] || '#6b7280';
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

function estimateReadingTime(contentHtml) {
    const plainText = String(contentHtml || '').replace(/<[^>]*>/g, ' ');
    const words = plainText.trim().split(/\s+/).filter(Boolean).length;
    if (words === 0) {
        return 1;
    }
    return Math.max(1, Math.round(words / 220));
}

function updateResultsSummary(count, mode) {
    const summary = document.getElementById('resultsSummary');
    if (!summary) {
        return;
    }

    if (mode === 'search') {
        summary.textContent = `${count} result${count === 1 ? '' : 's'} from search`;
        return;
    }

    if (mode && mode !== 'all') {
        summary.textContent = `${count} post${count === 1 ? '' : 's'} in ${mode}`;
        return;
    }

    summary.textContent = `${count} published post${count === 1 ? '' : 's'} available`;
}

function setNoPostsMessage(message) {
    const noPostsMsg = document.getElementById('noPostsMessage');
    if (!noPostsMsg) {
        return;
    }

    noPostsMsg.innerHTML = `
        <i data-lucide="inbox"></i>
        <p>${escapeHtml(message)}</p>
    `;
    refreshIcons();
}

function showNotification(message) {
    const notification = document.createElement('div');
    notification.style.cssText = `
        position: fixed;
        bottom: 2rem;
        right: 2rem;
        background: #22c55e;
        color: white;
        padding: 1rem 1.5rem;
        border-radius: 0.5rem;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        z-index: 9999;
        animation: slideUp 0.3s ease;
    `;
    notification.textContent = message;
    document.body.appendChild(notification);

    setTimeout(() => {
        notification.style.animation = 'slideDown 0.3s ease';
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

function refreshIcons() {
    if (window.lucide && typeof window.lucide.createIcons === 'function') {
        window.lucide.createIcons();
    }
}

// Check for post ID in URL query params
window.addEventListener('load', () => {
    const params = new URLSearchParams(window.location.search);
    const postId = params.get('post');
    if (postId) {
        const post = getPost(parseInt(postId));
        if (post && post.status === 'published') {
            showSinglePostView(postId);
        }
    }
});
