const API_URL = 'http://localhost:3000/api';
let currentUser = null;
let currentItemToReject = null;

function showRejectModal(newsId) {
    currentItemToReject = newsId;
    document.getElementById('reject-confirm-modal').classList.remove('hidden');
}

function hideRejectModal() {
    document.getElementById('reject-confirm-modal').classList.add('hidden');
    currentItemToReject = null;
}

async function performRejectNews(newsId) {
    try {
        const token = localStorage.getItem('token');
        if (!token) {
            showToast('Будь ласка, увійдіть як адміністратор', 'warning');
            return;
        }

        const response = await fetch(`${API_URL}/news/${newsId}/status`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ status: 'rejected' })
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || 'Помилка при відхиленні новини');
        }

        showToast('Новину успішно відхилено!', 'success');
        setTimeout(() => window.location.href = '/', 1500);
    } catch (error) {
        console.error('Error rejecting news:', error);
        showToast(error.message || 'Помилка при відхиленні новини', 'error');
    }
}

async function rejectNews(newsId) {
    showRejectModal(newsId);
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

function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('uk-UA', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
}

function showToast(message, type = 'success', duration = 3000) {
    document.querySelectorAll('.toast-message').forEach(toast => {
        toast.classList.add('toast-fade-out');
        setTimeout(() => toast.remove(), 300);
    });

    const toast = document.createElement('div');
    toast.className = `toast-message toast-${type}`;

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
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.message || `HTTP помилка! статус: ${response.status}`);
        }

        return await response.json();
    } catch (error) {
        console.error(`Помилка ${method} ${endpoint}:`, error);
        throw error;
    }
}

const urlParams = new URLSearchParams(window.location.search);
const newsId = urlParams.get('id');

window.addEventListener('beforeunload', () => {
    const urlParams = new URLSearchParams(window.location.search);
    const newsId = urlParams.get('id');
    if (newsId) {
        localStorage.setItem('lastViewedNews', newsId);
    }
});

document.addEventListener('DOMContentLoaded', async () => {
    if (!newsId) {
        window.location.href = '/';
        return;
    }

    document.getElementById('confirm-reject-btn').addEventListener('click', function () {
        if (currentItemToReject) {
            performRejectNews(currentItemToReject);
        }
        hideRejectModal();
    });
    
    if (newsId) {
        localStorage.setItem('lastViewedNews', newsId);
    }

    try {
        const token = localStorage.getItem('token');
        if (token) {
            try {
                const userData = await fetchData('/auth/me');
                if (userData && userData.user) {
                    currentUser = userData.user;
                    currentUser.token = token;

                    document.getElementById('comment-form-container').classList.remove('hidden');
                    document.getElementById('comment-login-message').classList.add('hidden');
                }
            } catch (error) {
                console.log('Авторизація не вдалася:', error);
                localStorage.removeItem('token');
            }
        }

        const newsItem = await fetchData(`/news/${newsId}`);

        const newsContainer = document.getElementById('news-container');
        newsContainer.innerHTML = `
            <div class="flex justify-between items-start mb-4">
                <h1 class="text-2xl font-bold">${newsItem.title}</h1>
                <div class="flex items-center">
                    <button id="like-button" onclick="likeNews('${newsId}')" class="flex items-center text-gray-500 hover:text-red-500 mr-4">
                        <i class="far fa-heart text-xl mr-1"></i>
                        <span id="like-count">${newsItem.likes?.length || 0}</span>
                    </button>
                    ${currentUser?.role === 'admin' ?
                `<button onclick="rejectNews('${newsId}')" class="px-3 py-1 bg-red-600 text-white rounded-md hover:bg-red-700">
                            <i class="fas fa-times mr-1"></i> Відхилити
                        </button>` :
                ''
            }
                </div>
            </div>
            <div class="mb-4">
                <span class="inline-block px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800">${getCategoryName(newsItem.category)}</span>
                <span class="ml-2 text-sm text-gray-500">${formatDate(newsItem.createdAt)}</span>
            </div>
            ${newsItem.mediaUrl ?
                (() => {
                    const fileExtension = newsItem.mediaUrl.split('.').pop().toLowerCase();
                    const isVideo = ['mp4', 'webm', 'ogg'].includes(fileExtension);
                    if (isVideo) {
                        return `<video controls class="w-full h-auto rounded-lg mb-4">
                            <source src="${newsItem.mediaUrl}" type="video/${fileExtension}">
                            Ваш браузер не підтримує відео.
                        </video>`;
                    } else {
                        return `<img src="${newsItem.mediaUrl}" alt="${newsItem.title}" class="w-full h-auto rounded-lg mb-4">`;
                    }
                })() :
                '<div class="w-full h-48 bg-gray-200 rounded-lg flex items-center justify-center text-gray-500 mb-4">Немає медіа</div>'
            }
            <div class="prose max-w-none mb-6">
                ${newsItem.content.replace(/\n/g, '<br>')}
            </div>
            <div class="border-t pt-4 text-sm text-gray-500">
                Автор: ${newsItem.author?.name || 'Невідомий автор'}
            </div>
        `;

        await loadComments(newsId);
    } catch (error) {
        console.error('Помилка завантаження новини:', error);
        showToast('Не вдалося завантажити новину', 'error');
        setTimeout(() => window.location.href = '/', 2000);
    }
});

async function addComment() {
    const content = document.getElementById('comment-content').value.trim();

    if (!content) {
        showToast('Будь ласка, введіть текст коментаря', 'warning');
        return;
    }

    try {
        const response = await fetch(`${API_URL}/news/${newsId}/comment`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ content })
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || 'Помилка при додаванні коментаря');
        }

        document.getElementById('comment-content').value = '';
        await loadComments(newsId);
        showToast('Коментар успішно додано!', 'success');
    } catch (error) {
        console.error('Помилка додавання коментаря:', error);
        showToast(error.message || 'Помилка при додаванні коментаря', 'error');
    }
}

async function loadComments(newsId) {
    try {
        const commentsContainer = document.getElementById('comments-container');
        commentsContainer.innerHTML = '<p class="text-gray-500">Завантаження коментарів...</p>';

        const response = await fetch(`${API_URL}/news/${newsId}/comments`);

        if (!response.ok) {
            throw new Error('Не вдалося отримати коментарі');
        }

        const comments = await response.json();

        if (!comments || comments.length === 0) {
            commentsContainer.innerHTML = '<p class="text-gray-500">Коментарів поки немає</p>';
            return;
        }

        commentsContainer.innerHTML = '';
        comments.forEach(comment => {
            const commentElement = document.createElement('div');
            commentElement.className = 'p-4 bg-gray-50 rounded-lg mb-2';
            commentElement.innerHTML = `
                <div class="flex justify-between items-start mb-1">
                    <p class="font-medium">${comment.author?.name || 'Анонім'}</p>
                    <span class="text-xs text-gray-500">${new Date(comment.createdAt).toLocaleString()}</span>
                </div>
                <p class="text-gray-700">${comment.content}</p>
            `;
            commentsContainer.appendChild(commentElement);
        });
    } catch (error) {
        console.error('Помилка завантаження коментарів:', error);
        document.getElementById('comments-container').innerHTML =
            '<p class="text-gray-500">Помилка завантаження коментарів</p>';
    }
}

async function likeNews(newsId) {
    const token = localStorage.getItem('token');
    if (!token) {
        showToast('Будь ласка, увійдіть, щоб ставити лайки', 'warning');
        return;
    }

    try {
        const response = await fetch(`${API_URL}/news/${newsId}/like`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || 'Помилка при додаванні лайку');
        }

        const result = await response.json();

        document.getElementById('like-count').textContent = result.likesCount || 0;

        const likeIcon = document.querySelector('#like-button i');
        if (result.isLiked) {
            likeIcon.classList.remove('far');
            likeIcon.classList.add('fas', 'text-red-500');
        } else {
            likeIcon.classList.remove('fas', 'text-red-500');
            likeIcon.classList.add('far');
        }

        showToast(result.isLiked ? 'Лайк додано!' : 'Лайк видалено', 'success');

    } catch (error) {
        console.error('Error liking news:', error);
        showToast(error.message || 'Помилка при додаванні лайку', 'error');
    }
}

function goBack() {
    const prevPage = localStorage.getItem('prevPage');
    if (prevPage && !prevPage.includes('/auth')) {
        window.location.href = prevPage;
    } else {
        window.location.href = '/';
    }
}