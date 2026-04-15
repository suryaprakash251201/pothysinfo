/**
 * Admin Dashboard - Authentication & Post Management
 * Handles login, CRUD operations, and dashboard UI
 */

// ==================== INITIALIZATION ====================

let quillEditor;

document.addEventListener('DOMContentLoaded', () => {
    void initializeAdmin();
});

async function initializeAdmin() {
    checkAuthentication();
    setupTheme();
    setupEventListeners();
    refreshIcons();

    // Keep the UI responsive on slow networks; sync posts in the background.
    void syncPostsFromApi();

    // Initialize sample posts if needed (for blog.js)
    if (!localStorage.getItem('blogPosts')) {
        initializeSamplePosts();
    }
}

// ==================== AUTHENTICATION ====================

function checkAuthentication() {
    const isAuthenticated = sessionStorage.getItem('adminAuth') === 'true';

    if (isAuthenticated) {
        showDashboard();
    } else {
        showLoginPage();
    }
}

function showLoginPage() {
    document.getElementById('loginContainer').style.display = 'flex';
    document.getElementById('dashboardContainer').style.display = 'none';
}

function showDashboard() {
    document.getElementById('loginContainer').style.display = 'none';
    document.getElementById('dashboardContainer').style.display = 'flex';
    loadDashboard();
}

async function handleLogin(e) {
    e.preventDefault();

    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    const errorDiv = document.getElementById('loginError');
    const loginBtn = document.getElementById('loginBtn');
    const loginBtnText = document.getElementById('loginBtnText');
    const loginBtnLoader = document.getElementById('loginBtnLoader');

    // Reset error
    errorDiv.classList.add('d-none');

    // Show loading state
    loginBtn.disabled = true;
    loginBtnText.style.display = 'none';
    loginBtnLoader.style.display = 'inline';

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    try {
        const response = await fetch(`${getApiBaseUrl()}/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password }),
            signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (response.ok) {
            sessionStorage.setItem('adminAuth', 'true');
            showDashboard();
            return;
        }

        // Show server-provided error when available
        let data = {};
        try { data = await response.json(); } catch (e) { /* ignore */ }

        if (response.status === 401) {
            errorDiv.textContent = data.error || 'Invalid username or password.';
            errorDiv.classList.remove('d-none');
            return;
        }

        errorDiv.textContent = data.error || `Login failed (${response.status}).`;
        errorDiv.classList.remove('d-none');
    } catch (err) {
        // Network/server unreachable: fallback to local check for offline dev
        if (err.name === 'AbortError') {
            console.warn('Login request timed out, falling back to local check.');
        } else {
            console.warn('Login request failed, falling back to local check.', err);
        }
        if (username === 'admin' && password === 'Admin@2026') {
            sessionStorage.setItem('adminAuth', 'true');
            showDashboard();
            return;
        }

        errorDiv.textContent = 'Login failed: server unreachable.';
        errorDiv.classList.remove('d-none');
    } finally {
        clearTimeout(timeoutId);
        loginBtn.disabled = false;
        loginBtnText.style.display = 'inline';
        loginBtnLoader.style.display = 'none';
    }
}

function handleLogout() {
    if (confirm('Are you sure you want to logout?')) {
        sessionStorage.removeItem('adminAuth');
        document.getElementById('username').value = '';
        document.getElementById('password').value = '';
        showLoginPage();
        refreshIcons();
    }
}

// ==================== DASHBOARD SECTIONS ====================

function loadDashboard() {
    renderDashboard();
    setupNavigation();
}

function renderDashboard() {
    const posts = getAllPosts();
    const publishedCount = posts.filter(p => p.status === 'published').length;
    const draftCount = posts.filter(p => p.status === 'draft').length;
    const categories = new Set(posts.map(p => p.category)).size;

    // Update KPIs
    document.getElementById('kpiTotalPosts').textContent = posts.length;
    document.getElementById('kpiPublished').textContent = publishedCount;
    document.getElementById('kpiDrafts').textContent = draftCount;
    document.getElementById('kpiCategories').textContent = categories;

    // Render recent posts
    const recentPosts = posts.slice(0, 5);
    const recentTable = document.getElementById('recentPostsTable');
    recentTable.innerHTML = recentPosts.map(post => createPostTableRow(post)).join('');

    // Render all posts
    renderAllPostsTable();

    refreshIcons();
}

function createPostTableRow(post) {
    const statusClass = post.status === 'published' ? 'status-published' : 'status-draft';
    const statusText = post.status.charAt(0).toUpperCase() + post.status.slice(1);

    return `
        <tr>
            <td class="fw-600">${escapeHtml(post.title)}</td>
            <td>${post.category}</td>
            <td><span class="${statusClass}">${statusText}</span></td>
            <td>${post.date}</td>
            <td>
                <button class="btn btn-action btn-sm btn-link" onclick="editPost(${post.id})">
                    <i data-lucide="edit-2"></i>
                </button>
                <button class="btn btn-action btn-sm btn-link text-danger" onclick="deletePost(${post.id})">
                    <i data-lucide="trash-2"></i>
                </button>
            </td>
        </tr>
    `;
}

// ==================== SECTION NAVIGATION ====================

function setupNavigation() {
    document.querySelectorAll('.sidebar-link').forEach(link => {
        link.addEventListener('click', (e) => {
            if (link.dataset.section) {
                e.preventDefault();
                navigateToSection(link.dataset.section);
            }
        });
    });
}

function navigateToSection(sectionName) {
    // Hide all sections
    document.querySelectorAll('.section-content').forEach(section => {
        section.style.display = 'none';
    });

    // Remove active state
    document.querySelectorAll('.sidebar-link').forEach(link => {
        link.classList.remove('active');
    });

    // Show selected section
    const sectionElement = document.getElementById(`${sectionName}-section`);
    if (sectionElement) {
        sectionElement.style.display = 'block';
    }

    // Update active sidebar link
    const activeLink = document.querySelector(`[data-section="${sectionName}"]`);
    if (activeLink) {
        activeLink.classList.add('active');
    }

    const sidebar = document.getElementById('sidebar');
    if (sidebar && window.innerWidth < 768) {
        sidebar.classList.remove('show');
    }

    // Update title
    const titles = {
        'dashboard': 'Dashboard',
        'posts': 'All Posts',
        'new-post': 'New Post'
    };
    document.getElementById('sectionTitle').textContent = titles[sectionName] || 'Dashboard';

    // Handle special logic
    if (sectionName === 'dashboard') {
        renderDashboard();
    } else if (sectionName === 'posts') {
        renderAllPostsTable();
    } else if (sectionName === 'new-post') {
        initializePostForm();
    }

    refreshIcons();
}

// ==================== POST FORM & EDITOR ====================

function initializePostForm() {
    // Initialize Quill editor if not already done
    if (!quillEditor) {
        quillEditor = new Quill('#quillEditor', {
            theme: 'snow',
            modules: {
                toolbar: [
                    [{ 'header': [1, 2, 3, false] }],
                    ['bold', 'italic', 'underline', 'strike'],
                    ['blockquote', 'code-block'],
                    [{ 'list': 'ordered'}, { 'list': 'bullet' }],
                    ['link', 'image'],
                    ['clean']
                ]
            },
            placeholder: 'Write your post content here...'
        });
    }

    // Clear form
    document.getElementById('postForm').reset();
    document.getElementById('postId').value = '';
    quillEditor.setContents([]);

    setupPostFormListeners();
}

function setupPostFormListeners() {
    document.getElementById('saveDraftBtn').onclick = () => savePost('draft');
    document.getElementById('publishBtn').onclick = () => savePost('published');
}

async function savePost(status) {
    const postId = document.getElementById('postId').value;
    const title = document.getElementById('postTitle').value.trim();
    const category = document.getElementById('postCategory').value;
    const author = document.getElementById('postAuthor').value.trim() || 'Admin';
    const excerpt = document.getElementById('postExcerpt').value.trim();
    const coverUrl = document.getElementById('postCoverUrl').value.trim();
    const tagsInput = document.getElementById('postTags').value.trim();
    const content = quillEditor.root.innerHTML;

    // Validation
    if (!title) {
        showToast('Please enter a post title', 'error');
        return;
    }

    if (!category) {
        showToast('Please select a category', 'error');
        return;
    }

    if (!excerpt) {
        showToast('Please enter an excerpt', 'error');
        return;
    }

    if (quillEditor.getText().trim().length < 10) {
        showToast('Post content is too short (minimum 10 characters)', 'error');
        return;
    }

    const tags = tagsInput ? tagsInput.split(',').map(t => t.trim()).filter(t => t) : [];
    const now = Date.now();
    const formattedDate = formatDate(now);

    let posts = getAllPosts();
    let savedPost = null;

    if (postId) {
        // Update existing post
        const index = posts.findIndex(p => p.id == postId);
        if (index !== -1) {
            const createdAt = posts[index].createdAt || now;
            posts[index].title = title;
            posts[index].category = category;
            posts[index].author = author;
            posts[index].excerpt = excerpt;
            posts[index].content = content;
            posts[index].cover = coverUrl;
            posts[index].tags = tags;
            posts[index].status = status;
            posts[index].updatedAt = now;
            posts[index].date = formatDate(createdAt);
            posts[index].slug = generateSlug(title);
            savedPost = posts[index];
            showToast('Post updated successfully', 'success');
        }
    } else {
        // Create new post
        const slug = generateSlug(title);
        const newPost = {
            id: now,
            slug: slug,
            title: title,
            category: category,
            author: author,
            status: status,
            excerpt: excerpt,
            content: content,
            cover: coverUrl,
            tags: tags,
            date: formattedDate,
            createdAt: now,
            updatedAt: now
        };
        posts.unshift(newPost);
        savedPost = newPost;
        showToast('Post created successfully', 'success');
    }

    localStorage.setItem('blogPosts', JSON.stringify(posts));

    if (savedPost) {
        try {
            await savePostToApi(savedPost);
            await syncPostsFromApi();
        } catch (error) {
            console.warn('Saving to API failed, using local cache.', error);
        }
    }

    // Reset form and navigate
    setTimeout(() => {
        document.getElementById('postForm').reset();
        document.getElementById('postId').value = '';
        quillEditor.setContents([]);
        navigateToSection('posts');
    }, 1000);
}

function editPost(postId) {
    const post = getPost(postId);
    if (!post) return;

    navigateToSection('new-post');

    // Populate form
    document.getElementById('postId').value = post.id;
    document.getElementById('postTitle').value = post.title;
    document.getElementById('postCategory').value = post.category;
    document.getElementById('postAuthor').value = post.author;
    document.getElementById('postExcerpt').value = post.excerpt;
    document.getElementById('postCoverUrl').value = post.cover || '';
    document.getElementById('postTags').value = (post.tags || []).join(', ');

    // Initialize Quill with content
    if (!quillEditor) {
        quillEditor = new Quill('#quillEditor', {
            theme: 'snow',
            modules: {
                toolbar: [
                    [{ 'header': [1, 2, 3, false] }],
                    ['bold', 'italic', 'underline', 'strike'],
                    ['blockquote', 'code-block'],
                    [{ 'list': 'ordered'}, { 'list': 'bullet' }],
                    ['link', 'image'],
                    ['clean']
                ]
            }
        });
    }

    quillEditor.root.innerHTML = post.content;
    
    setupPostFormListeners();
    window.scrollTo(0, 0);
}

// ==================== ALL POSTS TABLE ====================

function renderAllPostsTable() {
    const posts = getAllPosts();
    const table = document.getElementById('allPostsTable');
    table.innerHTML = posts.map(post => createAllPostsTableRow(post)).join('');

    // Setup search
    const searchInput = document.getElementById('postsSearchInput');
    if (searchInput && !searchInput.onSearchSetup) {
        searchInput.addEventListener('input', debounce(function() {
            filterPostsTable(this.value);
        }, 300));
        searchInput.onSearchSetup = true;
    }

    refreshIcons();
}

function createAllPostsTableRow(post) {
    const statusClass = post.status === 'published' ? 'status-published' : 'status-draft';
    const statusText = post.status.charAt(0).toUpperCase() + post.status.slice(1);

    return `
        <tr>
            <td class="fw-600">${escapeHtml(post.title)}</td>
            <td>${post.category}</td>
            <td>${post.author}</td>
            <td><span class="${statusClass}">${statusText}</span></td>
            <td>${post.date}</td>
            <td>
                <button class="btn btn-action btn-sm btn-link" onclick="editPost(${post.id})">
                    <i data-lucide="edit-2"></i>
                </button>
                <button class="btn btn-action btn-sm btn-link text-danger" onclick="deletePost(${post.id})">
                    <i data-lucide="trash-2"></i>
                </button>
            </td>
        </tr>
    `;
}

function filterPostsTable(query) {
    const posts = getAllPosts();
    const filtered = posts.filter(post =>
        post.title.toLowerCase().includes(query.toLowerCase()) ||
        post.category.toLowerCase().includes(query.toLowerCase())
    );

    const table = document.getElementById('allPostsTable');
    table.innerHTML = filtered.map(post => createAllPostsTableRow(post)).join('');
    refreshIcons();
}

// ==================== DELETE POST ====================

function deletePost(postId) {
    const deleteModal = new bootstrap.Modal(document.getElementById('deleteModal'));
    deleteModal.show();

    const confirmBtn = document.getElementById('confirmDeleteBtn');

    const deleteHandler = async () => {
        let posts = getAllPosts();
        posts = posts.filter(p => p.id != postId);
        localStorage.setItem('blogPosts', JSON.stringify(posts));

        try {
            await deletePostFromApi(postId);
            await syncPostsFromApi();
        } catch (error) {
            console.warn('Delete API call failed, using local cache.', error);
        }

        deleteModal.hide();
        confirmBtn.removeEventListener('click', deleteHandler);
        showToast('Post deleted successfully', 'success');

        setTimeout(() => {
            renderAllPostsTable();
            renderDashboard();
        }, 300);
    };

    confirmBtn.addEventListener('click', deleteHandler, { once: true });
}

// ==================== DATA MANAGEMENT ====================

function getAllPosts() {
    return JSON.parse(localStorage.getItem('blogPosts') || '[]').sort((a, b) => b.createdAt - a.createdAt);
}

function getPost(id) {
    return getAllPosts().find(post => post.id == id);
}

async function syncPostsFromApi() {
    const apiBase = getApiBaseUrl();
    const timeoutMs = 1500; // fail fast so UI isn't blocked by a slow/unreachable API

    const controller = new AbortController();
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
            return posts;
        }
    } catch (error) {
        if (error.name === 'AbortError') {
            console.warn(`Admin API timed out after ${timeoutMs}ms, using local cache.`);
        } else {
            console.warn('Admin API unavailable, using local cache.', error);
        }
    } finally {
        clearTimeout(timer);
    }

    if (!localStorage.getItem('blogPosts')) {
        initializeSamplePosts();
    }

    return getAllPosts();
}

async function savePostToApi(post) {
    const response = await fetch(`${getApiBaseUrl()}/posts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(post),
    });

    if (!response.ok) {
        throw new Error(`Failed to save post (${response.status})`);
    }

    return response.json();
}

async function deletePostFromApi(postId) {
    const response = await fetch(`${getApiBaseUrl()}/posts/${postId}`, {
        method: 'DELETE',
    });

    if (!response.ok) {
        throw new Error(`Failed to delete post (${response.status})`);
    }

    return response.json();
}

function getApiBaseUrl() {
    if (window.location.protocol === 'file:') {
        return 'http://localhost:3000/api';
    }

    return `${window.location.origin}/api`;
}

function initializeSamplePosts() {
    const samplePosts = [
        {
            id: Date.now() - 86400000 * 3,
            slug: 'building-ai-powered-web-apps-in-2026',
            title: 'Building AI-Powered Web Apps in 2026',
            category: 'AI',
            author: 'Admin',
            status: 'published',
            excerpt: 'Explore the latest tools and frameworks for integrating AI capabilities into your web applications.',
            content: '<h2>Introduction</h2><p>Artificial Intelligence has become an integral part of modern web development. In this article, we\'ll explore how to build AI-powered web applications using the latest tools and best practices.</p>',
            cover: 'https://images.unsplash.com/photo-1677442d019cecf8f7575b7875c888bbb?w=800&q=80',
            tags: ['ai', 'web', 'javascript'],
            date: formatDate(Date.now() - 86400000 * 3),
            createdAt: Date.now() - 86400000 * 3,
            updatedAt: Date.now() - 86400000 * 3
        },
        {
            id: Date.now() - 86400000 * 2,
            slug: 'full-stack-dev-setup-tools-i-use-daily',
            title: 'My Full-Stack Dev Setup: Tools I Use Daily',
            category: 'Dev',
            author: 'Admin',
            status: 'published',
            excerpt: 'A detailed breakdown of my complete development environment.',
            content: '<h2>My Development Stack 2026</h2><p>After years of experimentation, I\'ve settled on a productive development setup.</p>',
            cover: 'https://images.unsplash.com/photo-1517694712202-14dd9538aa97?w=800&q=80',
            tags: ['tools', 'development'],
            date: formatDate(Date.now() - 86400000 * 2),
            createdAt: Date.now() - 86400000 * 2,
            updatedAt: Date.now() - 86400000 * 2
        },
        {
            id: Date.now() - 86400000,
            slug: 'why-micro-saas-is-best-bet-for-solo-devs',
            title: 'Why Micro-SaaS Is the Best Bet for Solo Devs',
            category: 'Startup',
            author: 'Admin',
            status: 'draft',
            excerpt: 'A strategic analysis of why building small, focused SaaS products is ideal.',
            content: '<h2>The Case for Micro-SaaS</h2><p>Solo developers have a unique advantage in the market.</p>',
            cover: '',
            tags: ['startup', 'business'],
            date: formatDate(Date.now() - 86400000),
            createdAt: Date.now() - 86400000,
            updatedAt: Date.now() - 86400000
        }
    ];

    localStorage.setItem('blogPosts', JSON.stringify(samplePosts));
}

// ==================== EVENT LISTENERS ====================

function setupEventListeners() {
    // Login form
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        loginForm.addEventListener('submit', handleLogin);
    }

    // Logout button
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', handleLogout);
    }

    const sidebarToggle = document.getElementById('sidebarToggle');
    const sidebar = document.getElementById('sidebar');
    if (sidebarToggle && sidebar) {
        sidebarToggle.addEventListener('click', () => {
            sidebar.classList.toggle('show');
        });
    }

    // New Post CTA button
    const newPostCTA = document.getElementById('newPostCTA');
    if (newPostCTA) {
        newPostCTA.addEventListener('click', () => navigateToSection('new-post'));
    }
}

// ==================== THEME MANAGEMENT ====================

function setupTheme() {
    const savedTheme = localStorage.getItem('theme') || 'light';
    applyTheme(savedTheme);

    const themeToggle = document.getElementById('themeToggle');
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
}

// ==================== TOAST NOTIFICATIONS ====================

function showToast(message, type = 'success') {
    const toast = document.getElementById('toast');
    const toastIcon = document.getElementById('toastIcon');
    const toastMessage = document.getElementById('toastMessage');

    toastMessage.textContent = message;
    toast.className = `toast ${type}`;

    // Set icon
    if (type === 'success') {
        toastIcon.setAttribute('data-lucide', 'check-circle');
    } else {
        toastIcon.setAttribute('data-lucide', 'alert-circle');
    }

    refreshIcons();
    toast.classList.add('show');

    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}

// ==================== UTILITY FUNCTIONS ====================

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function generateSlug(text) {
    return text
        .toLowerCase()
        .replace(/[^\w\s-]/g, '')
        .replace(/[\s_]+/g, '-')
        .replace(/^-+|-+$/g, '');
}

function formatDate(timestamp) {
    const date = new Date(timestamp);
    const options = { year: 'numeric', month: 'long', day: 'numeric' };
    return date.toLocaleDateString('en-US', options);
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

// ==================== SESSION MANAGEMENT ====================

window.addEventListener('beforeunload', () => {
    // Optional: Auto-logout on page close
    // sessionStorage.removeItem('adminAuth');
});

function refreshIcons() {
    if (window.lucide && typeof window.lucide.createIcons === 'function') {
        window.lucide.createIcons();
    }
}
