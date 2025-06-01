const API_URL = 'http://localhost:3000/api';

let currentUser = null;

document.addEventListener('DOMContentLoaded', async function () {
    if (document.getElementById('mobileMenuButton')) {
        document.getElementById('mobileMenuButton').addEventListener('click', function () {
            document.getElementById('mobileMenu').classList.add('open');
        });
    }

    if (document.getElementById('closeMobileMenu')) {
        document.getElementById('closeMobileMenu').addEventListener('click', function () {
            document.getElementById('mobileMenu').classList.remove('open');
        });
    }

    if (document.getElementById('loginForm')) {
        document.getElementById('loginForm').addEventListener('submit', function (e) {
            e.preventDefault();
            login();
        });
    }

    if (document.getElementById('registerForm')) {
        document.getElementById('registerForm').addEventListener('submit', function (e) {
            e.preventDefault();
            register();
        });
    }

    if (document.getElementById('create-news-form')) {
        document.getElementById('create-news-form').addEventListener('submit', function (e) {
            e.preventDefault();
            saveNews();
        });
    }

    if (document.getElementById('profile-form')) {
        document.getElementById('profile-form').addEventListener('submit', function (e) {
            e.preventDefault();
            updateProfile();
        });
    }

    if (document.getElementById('sort-news')) {
        document.getElementById('sort-news').addEventListener('change', function (e) {
            currentSort = e.target.value;
            loadNews();
        });
    }

    if (document.getElementById('category-filter')) {
        document.getElementById('category-filter').addEventListener('change', function (e) {
            currentCategory = e.target.value;
            loadNews();
        });
    }

    if (document.getElementById('search-news')) {
        document.getElementById('search-news').addEventListener('input', debounce(function (e) {
            currentSearch = e.target.value.trim();
            loadNews();
        }, 500));
    }

    window.addEventListener('beforeunload', function () {
        clearFilters();
    });

    if (document.querySelectorAll('[onclick="handleCreateNewsClick()"]').length > 0) {
        document.querySelectorAll('[onclick="handleCreateNewsClick()"]').forEach(button => {
            button.onclick = handleCreateNewsClick;
        });
    }

    if (window.location.pathname === '/' || window.location.pathname === '/index.html') {
        const token = localStorage.getItem('token');
        if (token) {
            try {
                const userData = await fetchData('/auth/me');
                if (userData && userData.user) {
                    currentUser = userData.user;
                    currentUser.token = token;
                    updateMenuVisibility();
                    
                    // Відновлюємо останню активну секцію
                    const lastSection = localStorage.getItem('lastActiveSection') || 'home';
                    showSection(lastSection);
                    
                    // Якщо це головна сторінка, відновлюємо фільтри
                    if (lastSection === 'home') {
                        const savedFilters = JSON.parse(localStorage.getItem('newsFilters') || '{}');
                        currentSort = savedFilters.sort || 'newest';
                        currentCategory = savedFilters.category || 'all';
                        currentSearch = savedFilters.search || '';
                        
                        document.getElementById('sort-news').value = currentSort;
                        document.getElementById('category-filter').value = currentCategory;
                        document.getElementById('search-news').value = currentSearch;
                    }
                    
                    return;
                }
            } catch (error) {
                console.log('Авторизація не вдалася:', error);
                localStorage.removeItem('token');
            }
        }
        
        updateMenuVisibility();
        showAuthForm('login');
    }
});

async function fetchData(endpoint, method = 'GET', body = null, auth = true) {
    const headers = {
        'Content-Type': 'application/json'
    };

    const token = localStorage.getItem('token');
    if (auth && token) {
        headers['Authorization'] = `Bearer ${token}`;
    }

    const config = {
        method,
        headers
    };

    if (body && method !== 'GET') {
        config.body = JSON.stringify(body);
    }

    try {
        const response = await fetch(`${API_URL}${endpoint}`, config);

        if (!response.ok) {
            if (response.status === 404) {
                throw new Error(`Ресурс не знайдено: ${endpoint}`);
            }

            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.message || `HTTP помилка! статус: ${response.status}`);
        }

        return await response.json();
    } catch (error) {
        console.error(`Помилка ${method} ${endpoint}:`, error);
        throw error;
    }
}

function updateMenuVisibility() {
    const isLoggedIn = !!currentUser;

    const desktopMenuItems = document.querySelectorAll('.desktop-menu-item');
    desktopMenuItems.forEach(item => {
        const action = item.getAttribute('data-action');

        if (action === 'login' || action === 'register') {
            item.classList.toggle('hidden', isLoggedIn);
        } else if (action === 'my-news' || action === 'profile') {
            item.classList.toggle('hidden', !isLoggedIn);
        }
    });

    const mobileMenuItems = document.querySelectorAll('.mobile-menu-item');
    mobileMenuItems.forEach(item => {
        const action = item.getAttribute('data-action');

        if (action === 'login' || action === 'register') {
            item.classList.toggle('hidden', isLoggedIn);
        } else if (action === 'my-news' || action === 'profile') {
            item.classList.toggle('hidden', !isLoggedIn);
        }
    });
}

async function login() {
    const email = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value;

    if (!email || !password) {
        showToast('Будь ласка, введіть email та пароль', 'warning');
        return;
    }

    try {
        const response = await fetch(`${API_URL}/auth/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ email, password })
        });

        const data = await response.json();

        if (!response.ok) {
            if (data.message.includes('не знайдено')) {
                showToast('Користувача з таким email не існує', 'error');
            } else if (data.message.includes('пароль')) {
                showToast('Невірний пароль. Спробуйте ще раз.', 'error');
            } else {
                throw new Error(data.message || 'Помилка входу');
            }
            return;
        }

        currentUser = data.user;
        currentUser.token = data.token;
        localStorage.setItem('token', data.token);
        updateMenuVisibility();

        const redirectAfterLogin = localStorage.getItem('redirectAfterLogin');
        if (redirectAfterLogin) {
            localStorage.removeItem('redirectAfterLogin');
            window.location.href = redirectAfterLogin;
        } else {
            showSection('home');
        }

        showToast(`Вітаємо, ${data.user.name}!`, 'success');
    } catch (error) {
        console.error('Login error:', error);
        showToast('Помилка сервера. Спробуйте пізніше.', 'error');
    }
}

function logout() {
    document.getElementById('login-email').value = '';
    document.getElementById('login-password').value = '';

    document.getElementById('register-name').value = '';
    document.getElementById('register-email').value = '';
    document.getElementById('register-password').value = '';
    document.getElementById('register-confirm-password').value = '';

    document.getElementById('profile-current-password').value = '';
    document.getElementById('profile-new-password').value = '';
    document.getElementById('profile-confirm-password').value = '';

    currentUser = null;
    localStorage.removeItem('token');
    updateMenuVisibility();
    showAuthForm('login');
    showToast('Ви вийшли з системи', 'info');
}

function handleCreateNewsClick() {
    if (!currentUser) {
        showAuthForm('login');
        showToast('Будь ласка, увійдіть для створення новин', 'warning');
    } else {
        resetCreateNewsForm();
        showSection('create-news');
    }
}

function resetCreateNewsForm() {
    document.getElementById('news-title').value = '';
    document.getElementById('news-content').value = '';
    document.getElementById('news-category').value = '';
    document.getElementById('news-media').value = '';
}

async function register() {
    const name = document.getElementById('register-name').value;
    const email = document.getElementById('register-email').value;
    const password = document.getElementById('register-password').value;
    const confirmPassword = document.getElementById('register-confirm-password').value;

    if (password !== confirmPassword) {
        showToast('Паролі не співпадають', 'error');
        return;
    }

    if (!name || !email || !password) {
        showToast('Будь ласка, заповніть всі поля', 'warning');
        return;
    }

    try {
        const response = await fetch(`${API_URL}/auth/register`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ name, email, password })
        });

        const data = await response.json();

        if (!response.ok) {
            if (data.message.includes('вже існує')) {
                showToast('Цей email вже зареєстрований. Увійдіть або використайте інший email.', 'error');
                showAuthForm('login');
                return;
            }
            throw new Error(data.message || 'Помилка реєстрації');
        }

        currentUser = data.user;
        currentUser.token = data.token;
        localStorage.setItem('token', data.token);
        updateMenuVisibility();
        showSection('home');
        showToast('Реєстрація успішна! Ласкаво просимо, ' + data.user.name + '!', 'success');

    } catch (error) {
        console.error('Registration failed:', error);
        showToast('Помилка при реєстрації. Спробуйте ще раз.', 'error');
    }
}

async function showNewsDetails(newsId) {
    try {
        const newsItem = await fetchData(`/news/${newsId}`);
        const modal = document.getElementById('news-details-modal');

        document.getElementById('news-details-title').textContent = newsItem.title;
        document.getElementById('news-details-content').textContent = newsItem.content;
        document.getElementById('news-details-author').textContent = newsItem.author.name;
        document.getElementById('news-details-date').textContent = formatDate(newsItem.createdAt);

        const commentsContainer = document.getElementById('news-details-comments');
        commentsContainer.innerHTML = '';

        if (newsItem.comments && newsItem.comments.length > 0) {
            newsItem.comments.forEach(comment => {
                const commentElement = document.createElement('div');
                commentElement.className = 'mb-4 p-4 bg-gray-50 rounded-lg';
                commentElement.innerHTML = `
                    <p class="font-medium">${comment.author.name}</p>
                    <p class="text-gray-600">${comment.content}</p>
                    <p class="text-sm text-gray-400">${formatDate(comment.createdAt)}</p>
                `;
                commentsContainer.appendChild(commentElement);
            });
        } else {
            commentsContainer.innerHTML = '<p class="text-gray-500">Коментарів поки немає</p>';
        }

        modal.classList.remove('hidden');
    } catch (error) {
        showToast('Не вдалося завантажити деталі новини', 'error');
    }
}

async function loadMyNews() {
    if (!currentUser) {
        showToast('Будь ласка, увійдіть в систему', 'warning');
        showAuthForm('login');
        return;
    }

    const myNewsList = document.getElementById('my-news-list');
    myNewsList.innerHTML = '<tr><td colspan="5" class="px-6 py-4 text-center text-gray-500">Завантаження...</td></tr>';

    try {
        const userNews = await fetchData(`/news/author/${currentUser._id}`);

        if (userNews.length === 0) {
            myNewsList.innerHTML = '<tr><td colspan="5" class="px-6 py-4 text-center text-gray-500">У вас поки немає новин</td></tr>';
            return;
        }

        myNewsList.innerHTML = '';
        userNews.forEach(item => {
            const row = document.createElement('tr');
            row.className = 'hover:bg-gray-50';
            row.innerHTML = `
                <td class="px-6 py-4 whitespace-nowrap">
                    <div class="font-medium">${item.title}</div>
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                    <span class="px-2 py-1 text-xs rounded-full bg-blue-100 text-blue-800">${getCategoryName(item.category)}</span>
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                    <span class="px-2 py-1 text-xs rounded-full status-${item.status}">${getStatusName(item.status)}</span>
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${formatDate(item.createdAt)}</td>
                <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <button onclick="event.stopPropagation(); openViewModal('${item._id}')" class="text-blue-600 hover:text-blue-900 mr-2">
                        <i class="fas fa-eye mr-1"></i>Перегляд
                    </button>
                    <button onclick="event.stopPropagation(); editNews('${item._id}')" class="text-blue-600 hover:text-blue-900 mr-2">
                        <i class="fas fa-edit mr-1"></i>Редагувати
                    </button>
                    <button onclick="event.stopPropagation(); deleteNews('${item._id}')" class="text-red-600 hover:text-red-900">
                        <i class="fas fa-trash mr-1"></i>Видалити
                    </button>
                </td>
            `;

            row.addEventListener('click', (e) => {
                if (!e.target.closest('button')) {
                    openViewModal(item._id);
                }
            });

            myNewsList.appendChild(row);
        });
    } catch (error) {
        console.error('Error loading user news:', error);
        myNewsList.innerHTML = '<tr><td colspan="5" class="px-6 py-4 text-center text-gray-500">Помилка завантаження</td></tr>';
    }
}

function validateFileSize(file) {
    const maxSize = 10 * 1024 * 1024;
    if (file.size > maxSize) {
        showToast('10MB', 'error');
        return false;
    }
    return true;
}

async function saveNews() {
    const submitBtn = document.querySelector('#create-news-form button[type="submit"]');
    const originalBtnText = submitBtn.textContent;
    
    try {
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>Збереження...';
        
        const title = document.getElementById('news-title').value;
        const content = document.getElementById('news-content').value;
        const category = document.getElementById('news-category').value;
        const fileInput = document.getElementById('news-media');
        
        if (!title || !content || !category) {
            showToast('Будь ласка, заповніть всі обов\'язкові поля', 'warning');
            return;
        }
        
        if (fileInput.files[0] && !validateFileSize(fileInput.files[0])) {
            return;
        }
        
        const formData = new FormData();
        formData.append('title', title);
        formData.append('content', content);
        formData.append('category', category);
        
        if (fileInput.files[0]) {
            formData.append('media', fileInput.files[0]);
        }
        
        const response = await fetch(`${API_URL}/news`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${currentUser.token}`
            },
            body: formData
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || 'Помилка при збереженні новини');
        }
        
        showToast('Новину успішно збережено!', 'success');
        showSection('my-news');
    } catch (error) {
        console.error('Error saving news:', error);
        showToast(error.message || 'Помилка при збереженні новини', 'error');
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = originalBtnText;
    }
}

function getCategoryName(category) {
    const categories = {
        'politics': 'Політика',
        'sports': 'Спорт',
        'technology': 'Технології',
        'entertainment': 'Розваги'
    };
    return categories[category] || category;
}

function getStatusName(status) {
    const statuses = {
        'published': 'Опубліковано',
        'pending': 'На перевірці',
        'rejected': 'Відхилено',
        'draft': 'Чернетка'
    };
    return statuses[status] || status;
}

function formatDate(dateString) {
    const date = new Date(dateString);
    const options = { year: 'numeric', month: 'long', day: 'numeric' };
    return date.toLocaleDateString('uk-UA', options);
}

function showSection(sectionId) {
    localStorage.setItem('lastActiveSection', sectionId);
    
    document.getElementById('auth-forms').classList.add('hidden');
    document.getElementById('app-sections').classList.remove('hidden');
    
    document.querySelectorAll('#app-sections > div').forEach(section => {
        section.classList.add('hidden');
    });
    
    document.getElementById(`${sectionId}-section`).classList.remove('hidden');
    
    switch(sectionId) {
        case 'home':
            loadNews();
            break;
        case 'my-news':
            loadMyNews();
            break;
        case 'profile':
            loadProfile();
            break;
    }
    
    document.getElementById('mobileMenu').classList.remove('open');
}

function showAuthForm(formType) {
    document.getElementById('auth-forms').classList.remove('hidden');
    document.getElementById('app-sections').classList.add('hidden');

    if (formType === 'login') {
        document.getElementById('login-form').classList.remove('hidden');
        document.getElementById('register-form').classList.add('hidden');
    } else {
        document.getElementById('login-form').classList.add('hidden');
        document.getElementById('register-form').classList.remove('hidden');
    }

    document.getElementById('mobileMenu').classList.remove('open');
}

function getCategoryName(category) {
    const categories = {
        'politics': 'Політика',
        'sports': 'Спорт',
        'technology': 'Технології',
        'entertainment': 'Розваги'
    };
    return categories[category] || category;
}

function getStatusName(status) {
    const statuses = {
        'published': 'Опубліковано',
        'pending': 'На перевірці',
        'rejected': 'Відхилено',
        'draft': 'Чернетка'
    };
    return statuses[status] || status;
}

function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('uk-UA', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
}

function closeNewsDetails() {
    document.getElementById('news-details-modal').classList.add('hidden');
}

function showToast(message, type = 'success', duration = 3000) {
    document.querySelectorAll('.toast-message').forEach(toast => {
        toast.classList.add('toast-fade-out');
        setTimeout(() => toast.remove(), 300);
    });

    const toast = document.createElement('div');
    toast.className = `toast-message toast-${type}`;

	if (type === 'error' && message.includes('10MB')) {
        toast.innerHTML = `
            <div class="flex items-start">
                <i class="fas fa-exclamation-circle mr-3 mt-0.5"></i>
                <div>
                    <p class="font-medium">${message}</p>
                    <p class="text-sm mt-1">Спробуйте стиснути файл або вибрати менший</p>
                </div>
                <button onclick="this.parentElement.parentElement.remove()" class="ml-4 text-white hover:text-gray-200">
                    &times;
                </button>
            </div>
        `;
    	duration = 5000;
	}

    let icon;
    switch (type) {
        case 'success':
            icon = '✓';
            break;
        case 'error':
            icon = '✕';
            break;
        case 'warning':
            icon = '⚠';
            break;
        case 'info':
            icon = 'ℹ';
            break;
        default:
            icon = '';
    }

    toast.innerHTML = `
        <span class="mr-2">${icon}</span>
        <span>${message}</span>
        <button onclick="this.parentElement.remove()" class="ml-4 text-white hover:text-gray-200">
            &times;
        </button>
    `;

    document.body.appendChild(toast);

    if (duration > 0) {
        setTimeout(() => {
            toast.classList.add('toast-fade-out');
            setTimeout(() => toast.remove(), 300);
        }, duration);
    }

    return toast;
}

async function loadProfile() {
    if (!currentUser) {
        showAuthForm('login');
        return;
    }

    try {
        const userData = await fetchData('/auth/me');

        if (userData && userData.user) {
            const token = currentUser.token;
            currentUser = { ...userData.user, token };

            document.getElementById('profile-name').textContent = currentUser.name;
            document.getElementById('profile-email').textContent = currentUser.email;
            document.getElementById('profile-initials').textContent = currentUser.name.charAt(0).toUpperCase();

            const roleElement = document.getElementById('profile-role');
            roleElement.textContent = currentUser.role === 'admin' ? 'Адміністратор' : 'Користувач';
            roleElement.className = currentUser.role === 'admin' ?
                'inline-block mt-1 px-2 py-1 text-xs font-semibold rounded-full bg-purple-100 text-purple-800' :
                'inline-block mt-1 px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800';

            document.getElementById('profile-new-name').value = currentUser.name;

            document.getElementById('admin-panel').classList.toggle('hidden', currentUser.role !== 'admin');

            if (currentUser.role === 'admin') {
                loadPendingNews();
                loadStatistics();
            }
        }
    } catch (error) {
        console.error('Error loading profile:', error);
        showToast('Не вдалося завантажити дані профілю', 'error');
    }
}

async function updateProfile() {
    if (!currentUser || !currentUser.token) {
        showToast('Будь ласка, увійдіть в систему', 'warning');
        showAuthForm('login');
        return;
    }

    const newName = document.getElementById('profile-new-name').value;
    const currentPassword = document.getElementById('profile-current-password').value;
    const newPassword = document.getElementById('profile-new-password').value;
    const confirmPassword = document.getElementById('profile-confirm-password').value;

    if (newPassword && newPassword !== confirmPassword) {
        showToast('Новий пароль і підтвердження не співпадають', 'error');
        return;
    }

    if (newPassword && !currentPassword) {
        showToast('Будь ласка, введіть поточний пароль', 'warning');
        return;
    }

    try {
        const response = await fetch(`${API_URL}/auth/profile`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${currentUser.token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                name: newName,
                currentPassword: currentPassword,
                newPassword: newPassword
            })
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || 'Помилка при оновленні профілю');
        }

        const { user } = await response.json();

        currentUser = { ...user, token: currentUser.token };

        showToast('Профіль успішно оновлено!', 'success');

        document.getElementById('profile-current-password').value = '';
        document.getElementById('profile-new-password').value = '';
        document.getElementById('profile-confirm-password').value = '';

        loadProfile();
    } catch (error) {
        console.error('Error updating profile:', error);
        showToast(error.message || 'Помилка при оновленні профілю', 'error');
    }
}

document.getElementById('preview-news').addEventListener('click', function () {
    const title = document.getElementById('news-title').value;
    const content = document.getElementById('news-content').value;
    const category = document.getElementById('news-category').value;
    const mediaFile = document.getElementById('news-media').files[0];

    if (!title || !content || !category) {
        showToast('Будь ласка, заповніть всі обов\'язкові поля', 'warning');
        return;
    }

    document.getElementById('preview-title').textContent = title;
    document.getElementById('preview-content').innerHTML = content.replace(/\n/g, '<br>');
    document.getElementById('preview-category').textContent = getCategoryName(category);
    document.getElementById('preview-date').textContent = 'Попередній перегляд';

    const mediaContainer = document.getElementById('preview-media-container');
    mediaContainer.innerHTML = '';

    if (mediaFile) {
        const reader = new FileReader();
        reader.onload = function (e) {
            const fileExtension = mediaFile.name.split('.').pop().toLowerCase();
            const isVideo = ['mp4', 'webm', 'ogg'].includes(fileExtension);

            if (isVideo) {
                const video = document.createElement('video');
                video.src = e.target.result;
                video.controls = true;
                video.className = 'w-full h-auto rounded-lg';
                mediaContainer.appendChild(video);
            } else {
                const img = document.createElement('img');
                img.src = e.target.result;
                img.className = 'w-full h-auto rounded-lg';
                mediaContainer.appendChild(img);
            }
        };
        reader.readAsDataURL(mediaFile);
    } else {
        const placeholder = document.createElement('div');
        placeholder.className = 'w-full h-48 bg-gray-200 rounded-lg flex items-center justify-center text-gray-500';
        placeholder.textContent = 'Немає медіа';
        mediaContainer.appendChild(placeholder);
    }

    document.getElementById('news-preview-modal').classList.remove('hidden');
});

function closePreview() {
    document.getElementById('news-preview-modal').classList.add('hidden');
}

async function loadPendingNews() {
    if (!currentUser || currentUser.role !== 'admin') return;

    const pendingNewsList = document.getElementById('pending-news-list');
    pendingNewsList.innerHTML = '<tr><td colspan="4" class="px-6 py-4 text-center text-gray-500">Завантаження...</td></tr>';

    try {
        const pendingNews = await fetchData('/news?status=pending');

        if (pendingNews.length === 0) {
            pendingNewsList.innerHTML = '<tr><td colspan="4" class="px-6 py-4 text-center text-gray-500">Новин на перевірку немає</td></tr>';
            return;
        }

        pendingNewsList.innerHTML = '';
        pendingNews.forEach(item => {
            const row = document.createElement('tr');
            row.className = 'hover:bg-gray-50';
            row.innerHTML = `
                <td class="px-6 py-4 whitespace-nowrap">
                    <div class="font-medium cursor-pointer hover:text-blue-600" onclick="openViewModal('${item._id}')">${item.title}</div>
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                    <div>${item.author.name}</div>
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${formatDate(item.createdAt)}</td>
                <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <button onclick="event.stopPropagation(); openViewModal('${item._id}')" class="text-blue-600 hover:text-blue-900 mr-2">
                        <i class="fas fa-eye mr-1"></i>Перегляд
                    </button>
                    <button onclick="event.stopPropagation(); approveNews('${item._id}')" class="text-green-600 hover:text-green-900 mr-2">
                        <i class="fas fa-check mr-1"></i>Схвалити
                    </button>
                    <button onclick="event.stopPropagation(); rejectNews('${item._id}')" class="text-red-600 hover:text-red-900">
                        <i class="fas fa-times mr-1"></i>Відхилити
                    </button>
                </td>
            `;
            pendingNewsList.appendChild(row);
        });
    } catch (error) {
        console.error('Error loading pending news:', error);
        pendingNewsList.innerHTML = '<tr><td colspan="4" class="px-6 py-4 text-center text-gray-500">Помилка завантаження</td></tr>';
    }
}

window.addEventListener('beforeunload', function() {
    // Only run this code on the index.html page
    if (document.getElementById('app-sections')) {
        const currentSection = document.querySelector('#app-sections > div:not(.hidden)')?.id.replace('-section', '');
        if (currentSection) {
            localStorage.setItem('lastActiveSection', currentSection);
            
            if (currentSection === 'home') {
                localStorage.setItem('newsFilters', JSON.stringify({
                    sort: currentSort,
                    category: currentCategory,
                    search: currentSearch
                }));
            }
        }
    }
});window.addEventListener('beforeunload', function() {
    if (document.getElementById('app-sections')) {
        const currentSection = document.querySelector('#app-sections > div:not(.hidden)')?.id.replace('-section', '');
        if (currentSection) {
            localStorage.setItem('lastActiveSection', currentSection);
            
            if (currentSection === 'home') {
                localStorage.setItem('newsFilters', JSON.stringify({
                    sort: currentSort,
                    category: currentCategory,
                    search: currentSearch
                }));
            }
        }
    }
});

async function approveNews(newsId) {
    try {
        const response = await fetch(`${API_URL}/news/${newsId}/status`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${currentUser.token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ status: 'published' })
        });

        const responseData = await response.json();

        if (!response.ok) {
            throw new Error(responseData.error || 'Помилка при схваленні новини');
        }

        showToast('Новину схвалено та опубліковано!', 'success');
        loadPendingNews();
    } catch (error) {
        console.error('Error approving news:', error);
        showToast(error.message || 'Помилка при схваленні новини', 'error');
    }
}

async function rejectNews(newsId) {
    try {
        const response = await fetch(`${API_URL}/news/${newsId}/status`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${currentUser.token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ status: 'rejected' })
        });

        const responseData = await response.json();

        if (!response.ok) {
            throw new Error(responseData.error || 'Помилка при відхиленні новини');
        }

        showToast('Новину відхилено!', 'success');
        loadPendingNews();
    } catch (error) {
        console.error('Error rejecting news:', error);
        showToast(error.message || 'Помилка при відхиленні новини', 'error');
    }
}

async function loadStatistics() {
    if (!currentUser || currentUser.role !== 'admin') return;

    try {
        const [users, publishedNews, comments] = await Promise.all([
            fetchData('/auth/count'),
            fetchData('/news/count/published'),
            fetchData('/comments/count')
        ]);

        if (users?.count !== undefined) {
            document.getElementById('users-count').textContent = users.count;
        }
        if (publishedNews?.count !== undefined) {
            document.getElementById('news-count').textContent = publishedNews.count;
        }
        if (comments?.count !== undefined) {
            document.getElementById('comments-count').textContent = comments.count;
        }
    } catch (error) {
        console.error('Error loading statistics:', error);
        showToast('Не вдалося завантажити статистику', 'error');
    }
}

let currentEditingNewsId = null;

function openEditModal(newsId) {
    currentEditingNewsId = newsId;
    document.getElementById('edit-news-modal').classList.remove('hidden');
}

function closeEditModal() {
    document.getElementById('edit-news-modal').classList.add('hidden');
    currentEditingNewsId = null;
    resetEditForm();
}

function resetEditForm() {
    document.getElementById('edit-news-form').reset();
    document.getElementById('current-media-container').innerHTML = '';
}

async function editNews(newsId) {
    try {
        const newsItem = await fetchData(`/news/${newsId}`);

        document.getElementById('edit-news-title').value = newsItem.title;
        document.getElementById('edit-news-content').value = newsItem.content;
        document.getElementById('edit-news-category').value = newsItem.category;

        const mediaContainer = document.getElementById('current-media-container');
        mediaContainer.innerHTML = '';

        if (newsItem.mediaUrl) {
            const fileExtension = newsItem.mediaUrl.split('.').pop().toLowerCase();
            const isVideo = ['mp4', 'webm', 'ogg'].includes(fileExtension);

            mediaContainer.innerHTML = `
                <p class="text-sm text-gray-500 mb-1">Поточне медіа:</p>
                <div class="relative">
                    ${isVideo ?
                    `<video src="${newsItem.mediaUrl}" controls class="w-full h-auto rounded-md"></video>` :
                    `<img src="${newsItem.mediaUrl}" class="w-full h-32 object-cover rounded-md">`
                }
                    <button onclick="removeCurrentMedia('${newsId}')" 
                            class="absolute top-2 right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <p class="text-xs text-gray-500 mt-1">Щоб змінити, завантажте нове медіа</p>
            `;
        } else {
            mediaContainer.innerHTML = '<p class="text-sm text-gray-500">Немає медіа</p>';
        }

        document.getElementById('edit-news-form').onsubmit = function (e) {
            e.preventDefault();
            updateNews(newsId);
        };

        openEditModal(newsId);
    } catch (error) {
        console.error('Error loading news for edit:', error);
        showToast(error.message || 'Не вдалося завантажити новину для редагування', 'error');
    }
}

async function updateNews(newsId) {
    const submitBtn = document.querySelector('#edit-news-form button[type="submit"]');
    const originalBtnText = submitBtn.textContent;
    
    try {
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>Оновлення...';
        
        const title = document.getElementById('edit-news-title').value;
        const content = document.getElementById('edit-news-content').value;
        const category = document.getElementById('edit-news-category').value;
        const fileInput = document.getElementById('edit-news-media');
        
        if (fileInput.files[0] && !validateFileSize(fileInput.files[0])) {
            return;
        }
        
        const formData = new FormData();
        formData.append('title', title);
        formData.append('content', content);
        formData.append('category', category);
        
        if (fileInput.files[0]) {
            formData.append('media', fileInput.files[0]);
        }
        
        const response = await fetch(`${API_URL}/news/${newsId}`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${currentUser.token}`
            },
            body: formData
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || 'Помилка при оновленні новини');
        }
        
        showToast('Новину успішно оновлено!', 'success');
        closeEditModal();
        loadMyNews();
    } catch (error) {
        console.error('Error updating news:', error);
        showToast(error.message || 'Помилка при оновленні новини', 'error');
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = originalBtnText;
    }
}

document.getElementById('preview-edit-news').addEventListener('click', function () {
    const title = document.getElementById('edit-news-title').value;
    const content = document.getElementById('edit-news-content').value;
    const category = document.getElementById('edit-news-category').value;
    const mediaFile = document.getElementById('edit-news-media').files[0];

    if (!title || !content || !category) {
        showToast('Будь ласка, заповніть всі обов\'язкові поля', 'warning');
        return;
    }

    document.getElementById('edit-preview-title').textContent = title;
    document.getElementById('edit-preview-content').innerHTML = content.replace(/\n/g, '<br>');
    document.getElementById('edit-preview-category').textContent = getCategoryName(category);
    document.getElementById('edit-preview-date').textContent = 'Попередній перегляд';

    const mediaContainer = document.getElementById('edit-preview-media-container');
    mediaContainer.innerHTML = '';

    if (mediaFile) {
        const reader = new FileReader();
        reader.onload = function (e) {
            const fileExtension = mediaFile.name.split('.').pop().toLowerCase();
            const isVideo = ['mp4', 'webm', 'ogg'].includes(fileExtension);

            if (isVideo) {
                const video = document.createElement('video');
                video.src = e.target.result;
                video.controls = true;
                video.className = 'w-full h-auto rounded-lg';
                mediaContainer.appendChild(video);
            } else {
                const img = document.createElement('img');
                img.src = e.target.result;
                img.className = 'w-full h-auto rounded-lg';
                mediaContainer.appendChild(img);
            }
        };
        reader.readAsDataURL(mediaFile);
    } else {
        const currentMedia = document.querySelector('#current-media-container img');
        if (currentMedia) {
            const img = document.createElement('img');
            img.src = currentMedia.src;
            img.className = 'w-full h-auto rounded-lg';
            mediaContainer.appendChild(img);
        } else {
            const placeholder = document.createElement('div');
            placeholder.className = 'w-full h-48 bg-gray-200 rounded-lg flex items-center justify-center text-gray-500';
            placeholder.textContent = 'Немає медіа';
            mediaContainer.appendChild(placeholder);
        }
    }

    document.getElementById('edit-news-preview-modal').classList.remove('hidden');
});

function closeEditPreview() {
    document.getElementById('edit-news-preview-modal').classList.add('hidden');
}

async function getNewsWithComments(newsId) {
    try {
        if (!mongoose.Types.ObjectId.isValid(newsId)) {
            return { error: "Невірний ID новини" };
        }

        const news = await news.findById(newsId)
            .populate('author', 'name')
            .populate({
                path: 'comments',
                populate: {
                    path: 'author',
                    select: 'name'
                }
            });

        if (!news) {
            return { error: "Новину не знайдено" };
        }

        return news;
    } catch (error) {
        console.error("Помилка при отриманні новини з коментарями:", error);
        return { error: "Внутрішня помилка сервера" };
    }
}

let currentItemToDelete = null;
let deleteCallback = null;

function showDeleteModal(itemId, callback) {
    currentItemToDelete = itemId;
    deleteCallback = callback;
    document.getElementById('delete-confirm-modal').classList.remove('hidden');
}

function hideDeleteModal() {
    document.getElementById('delete-confirm-modal').classList.add('hidden');
    currentItemToDelete = null;
    deleteCallback = null;
}

document.getElementById('confirm-delete-btn').addEventListener('click', function () {
    if (deleteCallback && currentItemToDelete) {
        deleteCallback(currentItemToDelete);
    }
    hideDeleteModal();
});

async function deleteNews(newsId) {
    showDeleteModal(newsId, async (id) => {
        try {
            const response = await fetch(`${API_URL}/news/${id}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${currentUser.token}`,
                    'Content-Type': 'application/json'
                }
            });

            const responseData = await response.json();

            if (!response.ok) {
                throw new Error(responseData.message || 'Помилка при видаленні новини');
            }

            showToast('Новину успішно видалено!', 'success');
            loadMyNews();
        } catch (error) {
            console.error('Error deleting news:', error);
            showToast(error.message || 'Помилка при видаленні новини', 'error');
        }
    });
}

async function openViewModal(newsId) {
    localStorage.setItem('prevPage', window.location.href);
    const newsResponse = await fetch(`${API_URL}/news/${newsId}`);
    const news = await newsResponse.json();
    if (news.status === 'published') {
        window.location.href = `/news.html?id=${newsId}`;
    } else {
        loadNewsForView(newsId);
        document.getElementById('news-view-modal').classList.remove('hidden');
    }
}

function closeViewModal() {
    document.getElementById('news-view-modal').classList.add('hidden');
}

async function loadNewsForView(newsId) {
    try {
        const newsItem = await fetchData(`/news/${newsId}`);

        document.getElementById('view-news-title').textContent = newsItem.title;
        document.getElementById('view-news-content').innerHTML = newsItem.content.replace(/\n/g, '<br>');
        document.getElementById('view-news-category').textContent = getCategoryName(newsItem.category);

        const statusElement = document.getElementById('view-news-status');
        statusElement.textContent = getStatusName(newsItem.status);
        statusElement.className = `ml-2 px-2 py-1 text-xs font-semibold rounded-full status-${newsItem.status}`;

        document.getElementById('view-news-date').textContent = formatDate(newsItem.createdAt);

        const mediaContainer = document.getElementById('view-news-media-container');
        mediaContainer.innerHTML = '';

        if (newsItem.mediaUrl) {
            // Визначаємо тип медіа (зображення чи відео)
            const fileExtension = newsItem.mediaUrl.split('.').pop().toLowerCase();
            const isVideo = ['mp4', 'webm', 'ogg'].includes(fileExtension);

            if (isVideo) {
                const video = document.createElement('video');
                video.src = newsItem.mediaUrl;
                video.controls = true;
                video.className = 'w-full h-auto rounded-lg';
                mediaContainer.appendChild(video);
            } else {
                const img = document.createElement('img');
                img.src = newsItem.mediaUrl;
                img.className = 'w-full h-auto rounded-lg';
                img.alt = newsItem.title;
                mediaContainer.appendChild(img);
            }
        } else {
            const placeholder = document.createElement('div');
            placeholder.className = 'w-full h-48 bg-gray-200 rounded-lg flex items-center justify-center text-gray-500';
            placeholder.textContent = 'Немає медіа';
            mediaContainer.appendChild(placeholder);
        }

    } catch (error) {
        console.error('Error loading news for view:', error);
        showToast('Не вдалося завантажити новину', 'error');
        closeViewModal();
    }
}

let currentSort = 'newest';
let currentCategory = 'all';
let currentSearch = '';

async function loadNews() {
    const newsList = document.getElementById('news-list');
    newsList.innerHTML = '<p class="text-gray-500">Завантаження...</p>';

    try {
        const params = new URLSearchParams({
            status: 'published',
            sort: currentSort,
            category: currentCategory,
            ...(currentSearch && { search: currentSearch })
        });

        const publishedNews = await fetchData(`/news?${params.toString()}`);

        if (publishedNews.length === 0) {
            newsList.innerHTML = '<p class="text-gray-500">Новин не знайдено</p>';
            return;
        }

        newsList.innerHTML = '';
        for (const item of publishedNews) {
            const commentsResponse = await fetch(`${API_URL}/news/${item._id}/comments`);
            const comments = await commentsResponse.json();
            const commentsCount = comments?.length || 0;

            const newsCard = document.createElement('div');
            newsCard.className = 'bg-white rounded-lg shadow-md overflow-hidden news-card transition duration-300';

            let mediaContent = '';
            if (item.mediaUrl) {
                const fileExtension = item.mediaUrl.split('.').pop().toLowerCase();
                const isVideo = ['mp4', 'webm', 'ogg'].includes(fileExtension);

                if (isVideo) {
                    mediaContent = `
                        <video class="w-full h-48 object-cover" muted loop>
                            <source src="${item.mediaUrl}" type="video/${fileExtension}">
                        </video>
                    `;
                } else {
                    mediaContent = `<img src="${item.mediaUrl}" alt="${item.title}" class="w-full h-48 object-cover">`;
                }
            } else {
                mediaContent = '<div class="w-full h-48 bg-gray-200 flex items-center justify-center text-gray-500">Немає медіа</div>';
            }

            newsCard.innerHTML = `
                <div class="h-48 overflow-hidden">
                    ${mediaContent}
                </div>
                <div class="p-4">
                    <div class="flex justify-between items-start mb-2">
                        <h3 class="text-lg font-bold">${item.title}</h3>
                        <span class="inline-block px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800">${getCategoryName(item.category)}</span>
                    </div>
                    <p class="text-gray-600 mb-4 line-clamp-3">${item.content}</p>
                    <div class="flex justify-between items-center text-sm text-gray-500">
                        <span>${item.author.name}</span>
                        <div class="flex space-x-2">
                            <span class="flex items-center">
                                <i class="far fa-heart mr-1"></i> ${item.likes?.length || 0}
                            </span>
                            <span class="flex items-center">
                                <i class="far fa-comment mr-1"></i> ${commentsCount}
                            </span>
                            <span>${formatDate(item.createdAt)}</span>
                        </div>
                    </div>
                </div>
            `;

            newsCard.addEventListener('click', () => openViewModal(item._id));
            newsList.appendChild(newsCard);
        }
    } catch (error) {
        console.error('Error loading news:', error);
        newsList.innerHTML = '<p class="text-gray-500">Помилка завантаження новин</p>';
    }
}

function debounce(func, wait) {
    let timeout;
    return function () {
        const context = this, args = arguments;
        clearTimeout(timeout);
        timeout = setTimeout(() => {
            func.apply(context, args);
        }, wait);
    };
}

function clearFilters() {
    currentSort = 'newest';
    currentCategory = 'all';
    currentSearch = '';

    if (document.getElementById('sort-news')) {
        document.getElementById('sort-news').value = currentSort;
    }
    if (document.getElementById('category-filter')) {
        document.getElementById('category-filter').value = currentCategory;
    }
    if (document.getElementById('search-news')) {
        document.getElementById('search-news').value = currentSearch;
    }

    localStorage.removeItem('newsFilters');
}