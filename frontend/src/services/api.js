export const getDefaultApiBaseUrl = () => {
    const configuredBaseUrl = import.meta.env.VITE_API_BASE_URL?.trim();
    if (configuredBaseUrl) {
        return configuredBaseUrl.replace(/\/+$/, '');
    }

    if (typeof window !== 'undefined' && window.location?.origin) {
        return `${window.location.origin}/api`;
    }

    return 'http://localhost:5000/api';
};

const DEFAULT_API_BASE_URL = getDefaultApiBaseUrl();

// Default URL (can be overridden in localStorage)
export const getBaseUrl = () => {
    return (localStorage.getItem('custom_api_url') || DEFAULT_API_BASE_URL).replace(/\/+$/, '');
};

export const API_BASE_URL = getBaseUrl();

// Global fetch wrapper to handle 401 Unauthorized
const request = async (url, options = {}) => {
    try {
        const response = await fetch(url, options);

        // Security: Single Session Enforcement
        if (response.status === 401) {
            const data = await response.clone().json().catch(() => ({}));
            // Only redirect if it's explicitly a session expiry or if we are unauthorized on a protected route
            // For now, any 401 on the API implies the token is bad.
            // Avoid loops on login page or public endpoints if possible, but 401 usually means "Invalid Token".
            console.warn("Unauthorized (401) - clearing session...", data.message);

            if (localStorage.getItem('token')) {
                localStorage.removeItem('token');
                localStorage.removeItem('user');
                // Force reload to clear React state and redirect to /
                window.location.href = '/';
                return;
            }
        }

        return response;
    } catch (error) {
        throw error;
    }
};

export const api = {
    login: async (credentials, pin) => {
        const response = await request(`${API_BASE_URL}/auth/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ credentials, pin }),
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || 'Login failed');
        }

        return await response.json();
    },

    dealerLogin: async (credentials, pin) => {
        const response = await request(`${API_BASE_URL}/auth/dealer-login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ credentials, pin }),
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || 'Dealer login failed');
        }

        return await response.json();
    },

    getMe: async (token) => {
        const response = await request(`${API_BASE_URL}/users/me`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!response.ok) throw new Error('Failed to fetch user data');
        return await response.json();
    },

    getLeaderboard: async () => {
        const response = await request(`${API_BASE_URL}/users/leaderboard`);
        return await response.json();
    },

    getPluginDashboardTiles: async (surface, token) => {
        const response = await request(`${API_BASE_URL}/plugin-runtime/dashboard/${surface}`, {
            headers: token ? { 'Authorization': `Bearer ${token}` } : undefined
        });
        if (!response.ok) throw new Error('Plugin-Kacheln konnten nicht geladen werden');
        return await response.json();
    },

    getUserByQr: async (uuid) => {
        const response = await request(`${API_BASE_URL}/users/qr/${uuid}`);
        if (!response.ok) throw new Error('QR Code ungültig');
        return await response.json();
    },

    getTransactions: async (userId, token) => {
        // If userId is provided, fetch specific user (public), else fetch own (protected)
        const url = userId
            ? `${API_BASE_URL}/transactions/user/${userId}`
            : `${API_BASE_URL}/transactions/my-history`;

        const headers = {};
        if (token) headers['Authorization'] = `Bearer ${token}`;

        const response = await request(url, { headers });
        return await response.json();
    },

    createTransaction: async (token, userId, amount, game) => {
        const response = await request(`${API_BASE_URL}/transactions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ userId, amount, game }),
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || 'Transaction failed');
        }

        return await response.json();
    },

    transfer: async (token, recipientId, amount) => {
        const response = await request(`${API_BASE_URL}/transactions/transfer`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ recipientId, amount }),
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || 'Transfer failed');
        }
        return await response.json();
    },

    changePin: async (token, oldPin, newPin) => {
        const response = await request(`${API_BASE_URL}/users/change-pin`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ oldPin, newPin }),
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || 'PIN Änderung fehlgeschlagen');
        }
        return await response.json();
    },

    // Admin
    getUsers: async (token) => {
        const response = await request(`${API_BASE_URL}/admin/users`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        return await response.json();
    },

    createUser: async (token, username, pin, permissionGroups = ['PLAYER'], options = {}) => {
        const response = await request(`${API_BASE_URL}/admin/users`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ username, pin, permissionGroups, ...options }),
        });
        if (!response.ok) throw new Error('Failed to create user');
        return await response.json();
    },

    deleteUser: async (token, id) => {
        const response = await request(`${API_BASE_URL}/admin/users/${id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!response.ok) throw new Error('Failed to delete user');
    },

    declareBankruptcy: async (token, id) => {
        const response = await request(`${API_BASE_URL}/admin/users/${id}/bankruptcy`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!response.ok) throw new Error('Failed to declare bankruptcy');
        return await response.json();
    },

    updateUser: async (token, id, data) => {
        const response = await request(`${API_BASE_URL}/admin/users/${id}`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(data)
        });
        if (!response.ok) {
            const err = await response.text();
            throw new Error(err || 'Failed to update user');
        }
        return await response.json();
    },

    uploadAvatar: async (token, userId, file) => {
        // 1. Upload zum Webspace (PHP)
        const formData = new FormData();
        formData.append('file', file);
        formData.append('userId', userId);

        const webspaceUrl = window.location.origin + '/avatars/upload.php';

        const uploadResponse = await request(webspaceUrl, {
            method: 'POST',
            body: formData
        });

        if (!uploadResponse.ok) throw new Error('Failed to upload avatar to webspace');
        const uploadResult = await uploadResponse.json();

        // 2. Update Avatar URL im Backend
        const response = await request(`${API_BASE_URL}/admin/users/${userId}/avatar`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ avatarUrl: uploadResult.avatarUrl })
        });

        if (!response.ok) throw new Error('Failed to update avatar URL');
        return await response.json();
    },

    // Dealer Management
    getDealers: async (token) => {
        const response = await request(`${API_BASE_URL}/admin/dealers`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!response.ok) throw new Error('Failed to fetch dealers');
        return await response.json();
    },

    createDealer: async (token, name, pin) => {
        const response = await request(`${API_BASE_URL}/admin/dealers`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ name, pin })
        });
        if (!response.ok) {
            const err = await response.text();
            throw new Error(err || 'Failed to create dealer');
        }
        return await response.json();
    },

    updateDealer: async (token, id, data) => {
        const response = await request(`${API_BASE_URL}/admin/dealers/${id}`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(data)
        });
        if (!response.ok) throw new Error('Failed to update dealer');
        return await response.json();
    },

    deleteDealer: async (token, id) => {
        const response = await request(`${API_BASE_URL}/admin/dealers/${id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!response.ok) throw new Error('Failed to delete dealer');
    },

    // NFC
    getUserByNfc: async (cardUid) => {
        const response = await request(`${API_BASE_URL}/nfc/${cardUid}`);
        if (response.status === 404) return null;
        if (!response.ok) throw new Error('NFC lookup failed');
        return await response.json();
    },

    assignCard: async (token, userId, cardUid) => {
        const response = await request(`${API_BASE_URL}/nfc/assign`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ userId, cardUid })
        });
        if (!response.ok) throw new Error('Failed to assign card');
        return await response.json();
    },

    // QR Code
    getUserByQr: async (uuid) => {
        const response = await request(`${API_BASE_URL}/users/qr/${uuid}`);
        if (response.status === 404) return null;
        if (!response.ok) throw new Error('QR lookup failed');
        return await response.json();
    },

    // Health
    getHealth: async () => {
        try {
            const response = await request(`${API_BASE_URL}/health`);
            if (!response.ok) throw new Error('Server Error');
            return await response.json();
        } catch (error) {
            return { server: 'Offline', database: 'Unreachable' };
        }
    },

    // Table Management (Dealer)
    getInstalledLiveGamePackages: async (token) => {
        const response = await request(`${API_BASE_URL}/admin/live-game-plugins`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!response.ok) throw new Error('Failed to load installed plugin packages');
        return await response.json();
    },

    uploadLiveGamePackage: async (token, file) => {
        const formData = new FormData();
        formData.append('file', file);

        const response = await request(`${API_BASE_URL}/admin/live-game-plugins/upload`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`
            },
            body: formData
        });

        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
            throw new Error(payload.message || 'Plugin upload failed');
        }

        return payload;
    },

    deleteLiveGamePackage: async (token, key) => {
        const response = await request(`${API_BASE_URL}/admin/live-game-plugins/${key}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
            throw new Error(payload.message || 'Plugin uninstall failed');
        }
        return payload;
    },

    getDealerLiveGames: async () => {
        const response = await request(`${API_BASE_URL}/livegames/dealer`);
        if (!response.ok) throw new Error('Failed to load live games');
        return await response.json();
    },

    setTableGame: async (token, game) => {
        const response = await request(`${API_BASE_URL}/table/set-game`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ game })
        });
        if (!response.ok) throw new Error('Failed to set game');
        return await response.json();
    },

    getTablePlayers: async (token) => {
        const response = await request(`${API_BASE_URL}/table/players`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!response.ok) throw new Error('Failed to get players');
        return await response.json();
    },

    joinTable: async (token, userId) => {
        const response = await request(`${API_BASE_URL}/table/join`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ userId })
        });
        if (!response.ok) {
            const err = await response.json();
            throw new Error(err.message || 'Failed to add player');
        }
        return await response.json();
    },

    leaveTable: async (token, userId) => {
        const response = await request(`${API_BASE_URL}/table/leave`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ userId })
        });
        if (!response.ok) throw new Error('Failed to remove player');
        return await response.json();
    },

    endTableSession: async (token) => {
        const response = await request(`${API_BASE_URL}/table/end-session`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!response.ok) throw new Error('Failed to end session');
        return await response.json();
    },

    // Stats (Admin)
    getDashboardStats: async (token) => {
        const response = await request(`${API_BASE_URL}/stats/dashboard`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!response.ok) throw new Error('Failed to get stats');
        return await response.json();
    },

    getChartData: async (token, days = 7) => {
        const response = await request(`${API_BASE_URL}/stats/charts?days=${days}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!response.ok) throw new Error('Failed to get chart data');
        return await response.json();
    },

    getTopPlayers: async (token, type = 'winners') => {
        const response = await request(`${API_BASE_URL}/stats/top-players?type=${type}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!response.ok) throw new Error('Failed to get top players');
        return await response.json();
    },

    getActiveTables: async (token) => {
        const response = await request(`${API_BASE_URL}/stats/active-tables`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!response.ok) throw new Error('Failed to get active tables');
        return await response.json();
    },

    verifyDealerSession: async (token) => {
        const response = await request(`${API_BASE_URL}/auth/verify-dealer-session`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || 'Session invalid');
        }
        return await response.json();
    },

    // Player Profile (requires authentication)
    getPlayerProfile: async (userId) => {
        const token = localStorage.getItem('token');
        const response = await request(`${API_BASE_URL}/PlayerProfile/${userId}`, {
            headers: token ? { 'Authorization': `Bearer ${token}` } : {}
        });
        if (!response.ok) throw new Error('Failed to get player profile');
        return await response.json();
    },

    getPlayerChartData: async (userId, days = 7) => {
        const token = localStorage.getItem('token');
        const response = await request(`${API_BASE_URL}/PlayerProfile/${userId}/chart?days=${days}`, {
            headers: token ? { 'Authorization': `Bearer ${token}` } : {}
        });
        if (!response.ok) throw new Error('Failed to get chart data');
        return await response.json();
    },

    // SSL Certificate
    getSslCertificate: async (token) => {
        const response = await request(`${API_BASE_URL}/ssl/certificate`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!response.ok) throw new Error('Failed to get SSL info');
        return await response.json();
    }
};
