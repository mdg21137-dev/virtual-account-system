// api.js - 서버 API 연동 모듈

// API 서버 URL 설정
const API_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? 'http://localhost:3000/api'
    : '/api';

// 기기 타입 감지
function getDeviceType() {
    const ua = navigator.userAgent;
    if (/android/i.test(ua)) return 'Android';
    if (/iPad|iPhone|iPod/.test(ua) && !window.MSStream) return 'iOS';
    if (/Windows/.test(ua)) return 'Windows';
    if (/Mac/.test(ua)) return 'Mac';
    if (/Linux/.test(ua)) return 'Linux';
    return 'Unknown';
}

// 출처 정보 가져오기
function getSource() {
    return window.location.hostname || 'localhost';
}

// API 호출 헬퍼 함수
async function apiCall(endpoint, options = {}) {
    try {
        const response = await fetch(`${API_URL}${endpoint}`, {
            ...options,
            headers: {
                'Content-Type': 'application/json',
                ...options.headers
            }
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || '서버 오류');
        }

        return await response.json();
    } catch (error) {
        console.error('API 호출 오류:', error);
        throw error;
    }
}

// ===== 인증 API =====
async function login(username, password) {
    return await apiCall('/login', {
        method: 'POST',
        body: JSON.stringify({ username, password })
    });
}

// ===== 사용자 관리 API =====
async function getUsers() {
    return await apiCall('/users');
}

async function createUser(id, password, role = 'customer') {
    return await apiCall('/users', {
        method: 'POST',
        body: JSON.stringify({ id, password, role })
    });
}

async function deleteUser(id) {
    return await apiCall(`/users/${id}`, {
        method: 'DELETE'
    });
}

// ===== 신청 관리 API =====
async function getAllApplications() {
    return await apiCall('/applications');
}

async function getUserApplications(customerId) {
    return await apiCall(`/applications/user/${customerId}`);
}

async function createApplication(appData) {
    // 출처와 기기 타입 자동 추가
    const dataWithMetadata = {
        ...appData,
        source: getSource(),
        deviceType: getDeviceType()
    };
    
    return await apiCall('/applications', {
        method: 'POST',
        body: JSON.stringify(dataWithMetadata)
    });
}

async function updateApplication(appNo, updates) {
    return await apiCall(`/applications/${appNo}`, {
        method: 'PUT',
        body: JSON.stringify(updates)
    });
}

async function deleteApplication(appNo) {
    return await apiCall(`/applications/${appNo}`, {
        method: 'DELETE'
    });
}

// ===== 통계 API =====
async function getStats() {
    return await apiCall('/stats');
}

async function getDeviceStats() {
    return await apiCall('/stats/devices');
}

async function getSourceStats() {
    return await apiCall('/stats/sources');
}

// 전역으로 export
window.API = {
    login,
    getUsers,
    createUser,
    deleteUser,
    getAllApplications,
    getUserApplications,
    createApplication,
    updateApplication,
    deleteApplication,
    getStats,
    getDeviceStats,
    getSourceStats,
    getDeviceType,
    getSource
};
