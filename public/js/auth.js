// Auth state management
let currentUser = null;
let authToken = localStorage.getItem('authToken');

// API endpoints - use user service via proxy
const AUTH_API_URL = config.services.user;

// Check if user is logged in
async function checkAuth() {
    const token = localStorage.getItem('authToken');
    if (!token) {
        showLoginForm();
        return false;
    }

    try {
        // Try to use the verify endpoint
        console.debug('[checkAuth] Trying verify endpoint');
        const response = await fetch(`${AUTH_API_URL}/auth/verify`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (response.ok) {
            currentUser = await response.json();
            showLoggedInState();
            return true;
        } else {
            // If verify endpoint fails, try the /auth/me endpoint
            console.debug('[checkAuth] /auth/verify failed, trying /auth/me fallback');
            const meResponse = await fetch(`${AUTH_API_URL}/auth/me`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (!meResponse.ok) {
                throw new Error('Auth failed');
            }

            currentUser = await meResponse.json();
            showLoggedInState();
            return true;
        }
    } catch (error) {
        console.error('[checkAuth] Auth check error:', error);
        localStorage.removeItem('authToken');
        showLoginForm();
        return false;
    }
}

// Login function
async function login(email, password) {
    try {
        console.debug('[login] Attempting login with:', email);

        // Use explicit login URL without complex path rewriting
        const loginUrl = '/api/users/auth/login';
        
        console.debug('[login] Using login URL:', loginUrl);
        
        const response = await fetch(loginUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ email, password })
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || `Login failed: ${response.status}`);
        }

        const data = await response.json();
        console.debug('[login] Login successful:', { userId: data.user?.id });
        localStorage.setItem('authToken', data.token);
        currentUser = data.user;
        
        // Show the main content first and ensure tickets tab is active
        showLoggedInState();
        
        // Log token payload for debugging
        const tokenParts = data.token.split('.');
        if (tokenParts.length === 3) {
            try {
                const payload = JSON.parse(atob(tokenParts[1]));
                console.debug('[login] Token payload:', payload);
            } catch (e) {
                console.error('[login] Error decoding token:', e);
            }
        }
        
        // Activate tickets tab if not already active
        const ticketsNavTab = document.querySelector('[data-tab="tickets"]');
        if (ticketsNavTab) {
            document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
            ticketsNavTab.classList.add('active');
            const ticketsContent = document.getElementById('tickets-tab');
            if (ticketsContent) {
                ticketsContent.classList.add('active');
            }
        }
        
        // Ensure main content and tickets tab are visible before fetching
        const mainContent = document.getElementById('main-content');
        const ticketsTabContent = document.getElementById('tickets-tab');
        
        if (mainContent && ticketsTabContent) {
            console.debug('[login] Content elements found:', {
                mainContentDisplay: mainContent.style.display,
                ticketsTabDisplay: ticketsTabContent.style.display,
                ticketsTabClasses: ticketsTabContent.className
            });
            
            // Make sure main content is visible
            mainContent.style.display = 'block';
            
            // Make sure tickets tab is active
            ticketsTabContent.classList.add('active');
            
            // Fetch tickets
            console.debug('[login] Fetching tickets...');
            if (window.fetchTickets) {
                await window.fetchTickets();
            }
        }
    } catch (error) {
        console.error('[login] Login error:', error);
        const errorMsg = document.getElementById('login-error');
        if (errorMsg) {
            errorMsg.textContent = error.message || 'Login failed';
            errorMsg.style.display = 'block';
        }
    }
}

// Logout function
function logout() {
    localStorage.removeItem('authToken');
    currentUser = null;
    showLoginForm();
}

// Display login form
function showLoginForm() {
    const loginForm = document.getElementById('login-form');
    const mainContent = document.getElementById('main-content');
    
    if (loginForm) loginForm.style.display = 'block';
    if (mainContent) mainContent.style.display = 'none';
    
    // Add event listener to login form
    const authForm = document.getElementById('auth-form');
    if (authForm) {
        authForm.removeEventListener('submit', handleLogin);
        authForm.addEventListener('submit', handleLogin);
    }
}

// Show logged in state
function showLoggedInState() {
    console.debug('[showLoggedInState] Updating UI elements');
    const loginForm = document.getElementById('login-form');
    const mainContent = document.getElementById('main-content');
    const userInfo = document.getElementById('user-info');
    
    if (loginForm) loginForm.style.display = 'none';
    if (mainContent) mainContent.style.display = 'block';
    
    if (userInfo && currentUser) {
        userInfo.textContent = `Logged in as: ${currentUser.name || currentUser.email || currentUser.userId || currentUser.id}`;
    }
    
    // Add event listener to logout button
    const logoutButton = document.getElementById('logout-button');
    if (logoutButton) {
        logoutButton.removeEventListener('click', logout);
        logoutButton.addEventListener('click', logout);
    }
}

// Handle login form submission
function handleLogin(e) {
    e.preventDefault();
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    login(email, password);
}

// Initialize auth state
document.addEventListener('DOMContentLoaded', () => {
    const authForm = document.getElementById('auth-form');
    const logoutButton = document.getElementById('logout-button');
    
    if (authForm) {
        authForm.addEventListener('submit', handleLogin);
    }
    
    if (logoutButton) {
        logoutButton.addEventListener('click', logout);
    }
    
    checkAuth();
});

// Expose functions to global scope
window.login = login;
window.logout = logout; 