// DOM Elements
let ticketForm;
let ticketsList;
let userForm;
let usersList;
let modal;
let editForm;
let closeModal;
let statusFilter;
let priorityFilter;
let navTabs;
let tabContents;

// API endpoints
const TICKET_API_URL = config.services.ticket;
const USER_API_URL = config.services.user;
const STATUS_API_URL = config.services.status;
const DOWNLOADER_API_URL = config.services.downloader;

// State
let tickets = [];
let users = [];
// Add status cache with expiry times
const statusCache = new Map(); // Cache for status data
const STATUS_CACHE_TTL = 30000; // 30 seconds cache TTL

// Initialize DOM elements
function initializeDOMElements() {
    console.debug('[initializeDOMElements] Starting initialization');
    
    // Initialize forms
    ticketForm = document.getElementById('ticketForm');
    editForm = document.getElementById('editForm');
    userForm = document.getElementById('userForm');
    
    // Log initialization status
    console.debug('[initializeDOMElements] Forms initialized:', {
        ticketFormFound: !!ticketForm,
        editFormFound: !!editForm,
        userFormFound: !!userForm
    });

    if (!ticketForm) {
        console.error('[initializeDOMElements] ticketForm not found');
    }
    if (!editForm) {
        console.error('[initializeDOMElements] editForm not found');
    }
    if (!userForm) {
        console.error('[initializeDOMElements] userForm not found');
    }

    // Initialize other elements
    ticketsList = document.getElementById('ticketList');
    usersList = document.getElementById('usersList');
    fileList = document.getElementById('fileList');
    
    console.debug('[initializeDOMElements] Lists initialized:', {
        ticketListFound: !!ticketsList,
        userListFound: !!usersList,
        fileListFound: !!fileList
    });

    // Initialize filters
    statusFilter = document.getElementById('statusFilter');
    priorityFilter = document.getElementById('priorityFilter');
    
    console.debug('[initializeDOMElements] Filters initialized:', {
        statusFilterFound: !!statusFilter,
        priorityFilterFound: !!priorityFilter
    });

    // Initialize modals
    const modal = document.getElementById('editModal');
    if (modal) {
        const closeButton = modal.querySelector('.close');
        if (closeButton) {
            closeButton.addEventListener('click', () => {
                modal.style.display = 'none';
            });
        }
    }
}

// Set up event listeners
function setupEventListeners() {
    console.debug('[setupEventListeners] Setting up event listeners');
    
    // Ticket form submission
    ticketForm.addEventListener('submit', handleTicketSubmit);
    
    // User form submission
    userForm.addEventListener('submit', handleUserSubmit);
    
    // Edit form submission
    const editForm = document.getElementById('editForm');
    if (editForm) {
        console.debug('[setupEventListeners] Setting up edit form submit handler');
        editForm.addEventListener('submit', handleEditSubmit);
    } else {
        console.error('[setupEventListeners] Edit form not found in DOM');
    }
    
    // Set up filter listeners
    const statusFilterElement = document.getElementById('statusFilter');
    if (statusFilterElement) {
        console.debug('[setupEventListeners] Setting up statusFilter listener');
        statusFilterElement.addEventListener('change', () => {
            fetchTickets();
        });
    } else {
        console.error('[setupEventListeners] statusFilter not found');
    }

    const priorityFilterElement = document.getElementById('priorityFilter');
    if (priorityFilterElement) {
        console.debug('[setupEventListeners] Setting up priorityFilter listener');
        priorityFilterElement.addEventListener('change', () => {
            fetchTickets();
        });
    } else {
        console.error('[setupEventListeners] priorityFilter not found');
    }

    // Tab switching
    const tabs = document.querySelectorAll('[data-tab]');
    tabs.forEach(tab => {
        tab.addEventListener('click', function() {
            const targetTab = this.getAttribute('data-tab');
            
            // Hide all tab contents
            document.querySelectorAll('.tab-content').forEach(content => {
                content.classList.remove('active');
            });
            
            // Remove active class from all tabs
            tabs.forEach(t => t.classList.remove('active'));
            
            // Show the selected tab content
            document.getElementById(`${targetTab}-tab`).classList.add('active');
            
            // Add active class to clicked tab
            this.classList.add('active');
            
            // Load content based on tab
            if (targetTab === 'users') {
                fetchUsers();
            } else if (targetTab === 'tickets') {
                fetchTickets();
            } else if (targetTab === 'files') {
                listFiles();
            }
        });
    });
    
    // Global ESC key handler for modals
    document.addEventListener('keydown', function(event) {
        if (event.key === 'Escape') {
            console.debug('[setupEventListeners] ESC key pressed, checking for open modals');
            const modalBackdrop = document.querySelector('.modal-backdrop');
            if (modalBackdrop || document.body.classList.contains('modal-open')) {
                console.debug('[setupEventListeners] Modal appears to be open, closing it');
                closeModalHandler();
            }
        }
    });
    
    console.debug('[setupEventListeners] Event listeners setup complete');
}

// Event handlers
async function handleTicketSubmit(e) {
    e.preventDefault();
    const formData = new FormData(ticketForm);
    const data = Object.fromEntries(formData);
    
    // Get user ID from input or use default
    const userId = document.getElementById('userId').value;
    if (userId) {
        try {
            console.debug(`[handleTicketSubmit] Validating user ID: ${userId}`);
            console.debug(`[handleTicketSubmit] Using endpoint: ${USER_API_URL}/users/${userId}`);
            
            const userResponse = await fetch(`${USER_API_URL}/users/${userId}`);
            console.debug(`[handleTicketSubmit] User validation response status: ${userResponse.status}`);
            
            if (!userResponse.ok) {
                if (userResponse.status === 404) {
                    showError(`User ID '${userId}' not found. Please provide a valid user ID.`);
                } else {
                    showError(`Failed to validate user ID: ${userResponse.status}`);
                }
                return;
            }
            
            const userData = await userResponse.json();
            console.debug(`[handleTicketSubmit] User data retrieved:`, userData);
            data.createdBy = userData.name || userId;
            data.userId = userId; // Make sure userId is included in the ticket data
        } catch (error) {
            console.error('[handleTicketSubmit] Error validating user:', error);
            showError('Failed to validate user. Please ensure the user service is running.');
            return;
        }
    } else {
        showError('User ID is required. Please enter a valid user ID.');
        return;
    }
    
    try {
        console.debug('[handleTicketSubmit] Creating ticket with data:', data);
        const newTicket = await createTicket(data);
        console.debug('[handleTicketSubmit] Ticket created:', newTicket);
        ticketForm.reset();
        await fetchTickets(); // Refresh the tickets list
        showSuccess('Ticket created successfully');
    } catch (error) {
        console.error('[handleTicketSubmit] Error creating ticket:', error);
        showError('Failed to create ticket: ' + (error.message || 'Unknown error'));
    }
}

async function handleEditSubmit(e) {
    e.preventDefault();
    console.debug('[handleEditSubmit] Edit form submitted');
    
    try {
        const id = document.getElementById('editId').value;
        const formData = new FormData(e.target);
        const data = Object.fromEntries(formData);
        
        const statusSelect = document.getElementById('editStatus');
        const originalStatus = statusSelect.getAttribute('data-original');
        const newStatus = statusSelect.value;
        
        // Check if status is being changed and reason is required
        if (originalStatus !== newStatus) {
            const reasonField = document.getElementById('editStatusReason');
            const reason = reasonField.value.trim();
            
            if (!reason) {
                console.warn('[handleEditSubmit] Status changed but no reason provided');
                showError('Please provide a reason for changing the status from ' + originalStatus + ' to ' + newStatus);
                
                // Highlight the reason field
                reasonField.style.borderColor = '#dc3545';
                reasonField.focus();
                
                // Make sure the reason div is visible
                const reasonDiv = document.getElementById('statusReasonDiv');
                reasonDiv.style.display = 'block';
                reasonDiv.classList.add('visible');
                
                return;
            }
            
            // Make sure reason is included in data
            data.reason = reason;
            console.debug(`[handleEditSubmit] Status change from ${originalStatus} to ${newStatus}. Reason: ${reason}`);
        }
        
        console.debug('[handleEditSubmit] Updating ticket:', id, data);
        const updatedTicket = await updateTicket(id, data);
        
        console.debug('[handleEditSubmit] Ticket updated, closing modal');
        
        // Close the modal properly with error handling
        try {
            closeModalHandler();
        } catch (modalError) {
            console.error('[handleEditSubmit] Error closing modal:', modalError);
            
            // Last resort manual cleanup
            document.querySelectorAll('.modal-backdrop').forEach(el => el.remove());
            document.body.classList.remove('modal-open');
            document.body.style.overflow = '';
            document.body.style.paddingRight = '';
            
            const modalElement = document.getElementById('editModal');
            if (modalElement) {
                modalElement.classList.remove('show');
                modalElement.style.display = 'none';
                modalElement.setAttribute('aria-hidden', 'true');
            }
        }
        
        console.debug('[handleEditSubmit] Updating ticket list in UI');
        // Update the ticket in the list and re-render
        tickets = tickets.map(t => t._id === id ? updatedTicket : t);
        renderTickets(tickets);
        showSuccess('Ticket updated successfully');
    } catch (error) {
        console.error('[handleEditSubmit] Error updating ticket:', error);
        showError(error.message || 'Failed to update ticket');
        
        // Try to close the modal even if the update failed
        try {
            closeModalHandler();
        } catch (modalError) {
            console.error('[handleEditSubmit] Error closing modal after failed update:', modalError);
        }
    }
}

async function handleUserSubmit(e) {
    e.preventDefault();
    const formData = new FormData(userForm);
    const data = Object.fromEntries(formData);
    
    if (!data.id) {
        delete data.id;
    }
    
    try {
        await createUser(data);
        userForm.reset();
        await fetchUsers(); // Refresh the users list
    } catch (error) {
        console.error('Error creating user:', error);
        showError('Failed to create user');
    }
}

// Main application logic
console.debug('App loaded with configuration:', {
    userService: config.services.user,
    statusService: config.services.status,
    downloaderService: config.services.downloader,
    ticketService: config.services.ticket
});

// Custom fetch wrapper with logging
async function fetchWithLogging(url, options = {}) {
    console.debug(`[fetchWithLogging] Requesting: ${url}`, options);
    try {
        // Use the original fetch directly to avoid recursion
        const response = await originalFetch(url, options);
        console.debug(`[fetchWithLogging] Response from ${url}:`, {
            status: response.status,
            statusText: response.statusText,
            ok: response.ok
        });
        return response;
    } catch (error) {
        console.error(`[fetchWithLogging] Error fetching ${url}:`, error);
        throw error;
    }
}

// Replace standard fetch with logging version for API calls
const originalFetch = window.fetch;
window.fetch = function(url, options) {
    // Only apply to API calls but avoid recursion and login issues
    if (url.includes('/api/') && 
        !url.includes('/api/users/auth/login') && 
        !url.includes('/api/users/auth/verify') && 
        !url.includes('/api/users/auth/me')) {
        
        return fetchWithLogging(url, options);
    }
    // Use original fetch for auth calls and other non-API calls
    return originalFetch(url, options);
};

// Document ready handler
document.addEventListener('DOMContentLoaded', () => {
    console.debug('DOM fully loaded');
    
    // Set up tab navigation
    const tabs = document.querySelectorAll('.nav-tab');
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const targetId = tab.getAttribute('data-tab');
            console.debug(`Tab clicked: ${targetId}`);
            
            // Update active tab
            tabs.forEach(t => t.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
            
            tab.classList.add('active');
            document.getElementById(`${targetId}-tab`).classList.add('active');
        });
    });
});

// Initial load
document.addEventListener('DOMContentLoaded', async () => {
    console.debug('[DOMContentLoaded] Initializing application');
    
    // Check if Bootstrap is properly loaded
    if (typeof bootstrap === 'undefined') {
        console.error('[DOMContentLoaded] Bootstrap is not loaded correctly!');
    } else {
        console.debug('[DOMContentLoaded] Bootstrap is loaded successfully', bootstrap);
        
        // Initialize Bootstrap tooltips and popovers
        try {
            const tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'));
            const tooltipList = tooltipTriggerList.map(function(tooltipTriggerEl) {
                return new bootstrap.Tooltip(tooltipTriggerEl);
            });
            
            const popoverTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="popover"]'));
            const popoverList = popoverTriggerList.map(function(popoverTriggerEl) {
                return new bootstrap.Popover(popoverTriggerEl);
            });
            
            console.debug('[DOMContentLoaded] Bootstrap components initialized successfully');
        } catch (error) {
            console.error('[DOMContentLoaded] Error initializing Bootstrap components:', error);
        }
    }
    
    // Initialize DOM elements first
    initializeDOMElements();
    
    // Set up event listeners
    setupEventListeners();
    
    // Set up modal event listeners
    try {
        console.debug('[DOMContentLoaded] Setting up modal event listeners');
        
        // Set up global modal event listeners
        document.addEventListener('hidden.bs.modal', function(event) {
            console.debug('[Modal Event] Modal hidden event fired for', event.target.id);
            // Force cleanup
            document.querySelectorAll('.modal-backdrop').forEach(el => el.remove());
            document.body.classList.remove('modal-open');
            document.body.style.overflow = '';
            document.body.style.paddingRight = '';
        });
        
        document.addEventListener('shown.bs.modal', function(event) {
            console.debug('[Modal Event] Modal shown event fired for', event.target.id);
        });
    } catch (error) {
        console.error('[DOMContentLoaded] Error setting up modal event listeners:', error);
    }
    
    // Check authentication
    const authToken = localStorage.getItem('authToken');
    if (!authToken) {
        console.debug('[DOMContentLoaded] No auth token found');
        // Hide main content and show login form
        const mainContent = document.getElementById('main-content');
        if (mainContent) {
            mainContent.style.display = 'none';
        }
        
        // Show login form - using auth.js function if available
        if (typeof showLoginForm === 'function') {
            showLoginForm();
        }
        return;
    }

    try {
        // Try to verify token with both endpoints
        let userData = null;
        let tokenValid = false;
        
        // First try /auth/verify
        try {
            console.debug('[DOMContentLoaded] Verifying token with /auth/verify endpoint at:', `${USER_API_URL}/auth/verify`);
            const response = await fetch(`${USER_API_URL}/auth/verify`, {
                headers: {
                    'Authorization': `Bearer ${authToken}`
                }
            });

            if (response.ok) {
                userData = await response.json();
                tokenValid = true;
                console.debug('[DOMContentLoaded] Token verified with /auth/verify');
            }
        } catch (verifyError) {
            console.debug('[DOMContentLoaded] /auth/verify failed, trying /auth/me fallback');
        }
        
        // If /auth/verify fails, try /auth/me
        if (!tokenValid) {
            try {
                console.debug('[DOMContentLoaded] Verifying token with /auth/me endpoint');
                const response = await fetch(`${USER_API_URL}/auth/me`, {
                    headers: {
                        'Authorization': `Bearer ${authToken}`
                    }
                });
                
                if (response.ok) {
                    userData = await response.json();
                    tokenValid = true;
                    console.debug('[DOMContentLoaded] Token verified with /auth/me');
                } else {
                    throw new Error('Invalid token');
                }
            } catch (meError) {
                console.error('[DOMContentLoaded] Token verification failed with both endpoints');
                throw new Error('Authentication failed');
            }
        }

        // Token is valid, save user data
        console.debug('[DOMContentLoaded] User authenticated:', userData);
        currentUser = userData;

        // Show main content if token is valid
        const mainContent = document.getElementById('main-content');
        if (mainContent) {
            mainContent.style.display = 'block';
            console.debug('[DOMContentLoaded] Main content displayed');
    }

    // Load initial tab content
    const activeTab = document.querySelector('.nav-tab.active');
    if (activeTab) {
        const tabId = `${activeTab.dataset.tab}-tab`;
        const tabContent = document.getElementById(tabId);
        
        console.debug('[DOMContentLoaded] Active tab:', {
            tabId,
            isTicketsTab: tabId === 'tickets-tab',
            tabContentFound: !!tabContent
        });
        
        if (tabContent) {
            tabContent.classList.add('active');
        }

        if (tabId === 'users-tab') {
            fetchUsers();
        } else if (tabId === 'tickets-tab') {
                console.debug('[DOMContentLoaded] Fetching tickets');
                        fetchTickets();
        } else if (tabId === 'files-tab') {
            listFiles();
        }
    }
    } catch (error) {
        console.error('[DOMContentLoaded] Auth error:', error);
        localStorage.removeItem('authToken');
        
        // Hide main content
        const mainContent = document.getElementById('main-content');
        if (mainContent) {
            mainContent.style.display = 'none';
        }
        
        // Show login form - using auth.js function if available
        if (typeof showLoginForm === 'function') {
            showLoginForm();
        }
    }
});

// Error handling for API calls
const handleApiError = (error) => {
    if (error.response) {
        if (error.response.status === 401 || error.response.status === 403) {
            // Authentication error - redirect to login
            localStorage.removeItem('authToken');
            showLoginForm();
            return { error: 'Authentication required. Please log in.' };
        }
        return { error: error.response.data.message || 'An error occurred' };
    }
    return { error: 'Network error. Please try again.' };
};

// API call wrapper with authentication
const authenticatedFetch = async (url, options = {}) => {
    const token = localStorage.getItem('authToken');
    if (!token) {
        console.debug('[authenticatedFetch] No auth token found');
        const mainContent = document.getElementById('main-content');
        if (mainContent) {
            mainContent.style.display = 'none';
        }
        
        // Show login form if available
        if (typeof showLoginForm === 'function') {
        showLoginForm();
        }
        
        throw new Error('Authentication required');
    }

    const headers = {
        ...options.headers,
        'Authorization': `Bearer ${token}`,
        'Content-Type': options.headers?.['Content-Type'] || 'application/json'
    };

    try {
        console.debug(`[authenticatedFetch] Making authenticated request to: ${url}`);
        const response = await fetch(url, { ...options, headers });
        
        if (response.status === 401 || response.status === 403) {
            console.debug('[authenticatedFetch] Auth error:', response.status);
            
            // Try to verify the token with both endpoints
            let isValid = false;
            
            // First try with /auth/verify
            try {
                console.debug('[authenticatedFetch] Verifying token with /auth/verify');
                const verifyResponse = await fetch(`${USER_API_URL}/auth/verify`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                
                if (verifyResponse.ok) {
                    isValid = true;
                    console.debug('[authenticatedFetch] Token verified with /auth/verify');
                }
            } catch (verifyError) {
                console.debug('[authenticatedFetch] /auth/verify failed:', verifyError.message);
            }
            
            // If verify fails, try with /auth/me
            if (!isValid) {
                try {
                    console.debug('[authenticatedFetch] Verifying token with /auth/me');
                    const meResponse = await fetch(`${USER_API_URL}/auth/me`, {
                        headers: { 'Authorization': `Bearer ${token}` }
                    });
                    
                    if (meResponse.ok) {
                        isValid = true;
                        console.debug('[authenticatedFetch] Token verified with /auth/me');
                    }
                } catch (meError) {
                    console.debug('[authenticatedFetch] /auth/me failed:', meError.message);
                }
            }
            
            if (!isValid) {
                // Token is invalid, clear it and show login
                console.error('[authenticatedFetch] Token verification failed');
            localStorage.removeItem('authToken');
                const mainContent = document.getElementById('main-content');
                if (mainContent) {
                    mainContent.style.display = 'none';
                }
                
                if (typeof showLoginForm === 'function') {
            showLoginForm();
                }
                
                throw new Error('Authentication token expired');
            } else {
                // Token is valid but the endpoint requires specific permissions
                console.debug('[authenticatedFetch] Token is valid but access denied to the resource');
                throw new Error('Access denied to this resource');
            }
        }
        
        return response;
    } catch (error) {
        console.error('[authenticatedFetch] Error:', error);
        throw error;
    }
};

// Fetch all tickets
async function fetchTickets() {
    try {
        console.debug('[fetchTickets] Starting fetch');
        const response = await authenticatedFetch(TICKET_API_URL);
        if (!response.ok) {
            throw new Error('Failed to fetch tickets');
        }
        const ticketsData = await response.json();
        console.debug('[fetchTickets] Tickets fetched:', {
            count: ticketsData.length,
            ticketsData: ticketsData
        });
        tickets = ticketsData; // Update global tickets array
        renderTickets(ticketsData);
    } catch (error) {
        console.error('[fetchTickets] Error:', error);
        if (error.message !== 'Authentication required') {
            showError('Failed to fetch tickets. Please try again later.');
        }
    }
}

// Create ticket
async function createTicket(ticketData) {
    try {
        console.debug('[createTicket] Creating ticket with data:', ticketData);
        const response = await authenticatedFetch(TICKET_API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(ticketData)
        });
        
        if (!response.ok) {
            const errorText = await response.text();
            console.error(`[createTicket] Error response (${response.status}):`, errorText);
            
            try {
                // Try to parse as JSON
                const errorData = JSON.parse(errorText);
                throw new Error(errorData.error || errorData.message || `Server error: ${response.status}`);
            } catch (parseError) {
                // If not JSON, use text
                throw new Error(`Server error (${response.status}): ${errorText}`);
            }
        }
        
        const newTicket = await response.json();
        console.debug('[createTicket] Ticket created successfully:', newTicket);
        return newTicket;
    } catch (error) {
        console.error('[createTicket] Error:', error);
        throw error;
    }
}

// Function to refresh a ticket's data
async function refreshTicket(ticketId, shouldRender = true) {
    try {
        const authToken = localStorage.getItem('authToken');
        if (!authToken) {
            throw new Error('No authentication token found');
        }

        // First fetch ticket data
        const ticketResponse = await fetch(`${TICKET_API_URL}/${ticketId}`, { 
            headers: getAuthHeaders(),
            credentials: 'include',
            mode: 'cors'
        });
        
        if (!ticketResponse.ok) {
            throw new Error(`Failed to fetch ticket: ${ticketResponse.status}`);
        }

        const ticketData = await ticketResponse.json();
        
        // Then check if we have cached status data
        let statusData = { currentStatus: ticketData.status || 'open', history: [] };
        const now = Date.now();
        const cachedStatus = statusCache.get(ticketId);
        
        // Use cached status data if it exists and hasn't expired
        if (cachedStatus && cachedStatus.expiresAt > now) {
            statusData = cachedStatus.data;
        } else {
            try {
                const statusResponse = await fetch(`${STATUS_API_URL}/status/${ticketId}`, { 
                    headers: getAuthHeaders('status'),
                    credentials: 'include',
                    mode: 'cors'
                });
                
                if (statusResponse.ok) {
                    statusData = await statusResponse.json();
                    
                    // Cache the status data with expiry time
                    statusCache.set(ticketId, {
                        data: statusData,
                        expiresAt: now + STATUS_CACHE_TTL
                    });
                }
            } catch (error) {
                console.warn(`Error fetching status data for ticket ${ticketId}:`, error.message);
            }
        }
        
        const updatedTicket = {
            ...ticketData,
            currentStatus: statusData.currentStatus || ticketData.status || 'open',
            statusHistory: statusData.history || []
        };
        
        tickets = tickets.map(t => t._id === ticketId ? updatedTicket : t);
        
        if (shouldRender) {
            renderTickets(tickets);
        }
        
        return updatedTicket;
    } catch (error) {
        console.error(`Error refreshing ticket ${ticketId}:`, error.message);
        throw error;
    }
}

// Update ticket
async function updateTicket(ticketId, updateData) {
    try {
        console.debug(`[updateTicket] Updating ticket ${ticketId}:`, updateData);
        const authToken = localStorage.getItem('authToken');
        if (!authToken) {
            throw new Error('No authentication token found');
        }

        // Get the current user's ID from the token
        let tokenData;
        try {
            const tokenParts = authToken.split('.');
            if (tokenParts.length !== 3) {
                throw new Error('Invalid token format');
            }
            
            tokenData = JSON.parse(atob(tokenParts[1]));
            if (!tokenData.userId) {
                throw new Error('User ID not found in token');
            }
            updateData.userId = tokenData.userId; // Add userId to the update data
        } catch (error) {
            console.error('[updateTicket] Error parsing token:', error);
            throw new Error('Invalid authentication token. Please log in again.');
        }

        // First, update the ticket
        const ticketResponse = await fetch(`${TICKET_API_URL}/${ticketId}`, {
            method: 'PUT',
            headers: getAuthHeaders(),
            body: JSON.stringify(updateData)
        });

        if (!ticketResponse.ok) {
            const errorData = await ticketResponse.json();
            if (ticketResponse.status === 401) {
                localStorage.removeItem('authToken');
                window.location.href = '/login.html';
                throw new Error('Authentication expired. Please log in again.');
            }
            throw new Error(`Failed to update ticket: ${JSON.stringify(errorData)}`);
        }

        const updatedTicket = await ticketResponse.json();
        console.debug(`[updateTicket] Ticket updated successfully:`, updatedTicket);

        // If status was changed, update the status service
        const originalStatus = document.getElementById('editStatus').getAttribute('data-original');
        if (updateData.status && updateData.status !== originalStatus) {
            try {
                console.debug(`[updateTicket] Status changed from ${originalStatus} to ${updateData.status}, updating status service`);
                
                // Prepare reason for status change
                const reason = updateData.reason || `Status changed from ${originalStatus} to ${updateData.status}`;
                console.debug(`[updateTicket] Status change reason: "${reason}"`);
                
                // Log the transaction clearly
                console.log(`[STATUS UPDATE] Ticket ${ticketId}: ${originalStatus} → ${updateData.status} | Reason: "${reason}"`);
                
                const statusUpdateResponse = await fetch(`${STATUS_API_URL}/status/${ticketId}/update`, {
                    method: 'POST',
                    headers: getAuthHeaders('status'),
                    credentials: 'include',
                    body: JSON.stringify({
                        status: updateData.status,
                        reason: reason,
                        updatedBy: updatedTicket.updatedBy || tokenData.email || 'Unknown'
                    })
                });

                if (!statusUpdateResponse.ok) {
                    const errorText = await statusUpdateResponse.text();
                    console.error('[updateTicket] Failed to update status:', errorText);
                    
                    // Show a warning to the user but don't fail the entire update
                    showError(`Ticket was updated but failed to update status: ${errorText}`);
                } else {
                    console.debug('[updateTicket] Status updated successfully, fetching latest status data');
                    // Fetch the latest status data
                    const statusResponse = await fetch(`${STATUS_API_URL}/status/${ticketId}`, { 
                        headers: getAuthHeaders('status'),
                        credentials: 'include'
                    });
                    if (statusResponse.ok) {
                        const statusData = await statusResponse.json();
                        updatedTicket.currentStatus = statusData.currentStatus;
                        updatedTicket.statusHistory = statusData.history;
                        console.debug('[updateTicket] Latest status data fetched and merged with ticket');
                    }
                }
            } catch (error) {
                console.error('[updateTicket] Error updating status:', error);
            }
        }

        return updatedTicket;
    } catch (error) {
        console.error('[updateTicket] Error:', error);
        throw error;
    }
}

// Delete ticket
async function deleteTicket(ticketId) {
    try {
        await authenticatedFetch(`${TICKET_API_URL}/${ticketId}`, {
            method: 'DELETE'
        });
        await fetchTickets(); // Refresh the tickets list
        showSuccess('Ticket deleted successfully');
    } catch (error) {
        console.error('Error deleting ticket:', error);
        showError('Failed to delete ticket');
    }
}

// Render tickets
function renderTickets(ticketsData) {
    console.log('[RENDER] Starting ticket rendering');

    // Ensure we have the container and we're on the tickets tab
    const container = document.getElementById('ticketList');
    const ticketsTab = document.getElementById('tickets-tab');
    
    if (!container) {
        console.error('[RENDER] Ticket list container not found');
        return;
    }

    if (!ticketsTab?.classList.contains('active')) {
        console.log('[RENDER] Tickets tab not active, skipping render');
        return;
    }

    console.log('[RENDER] Container found, proceeding with render');

    // Clear the container
    container.innerHTML = '';

    // Ensure tickets is an array
    const tickets = Array.isArray(ticketsData) ? ticketsData : [];

    // Apply status and priority filters
    const statusFilter = document.getElementById('statusFilter');
    const priorityFilter = document.getElementById('priorityFilter');
    
    let filteredTickets = [...tickets];
    
    // Apply status filter if it exists and isn't set to 'all'
    if (statusFilter && statusFilter.value !== 'all') {
        console.log(`[RENDER] Filtering by status: ${statusFilter.value}`);
        const statusValue = statusFilter.value.toLowerCase();
        filteredTickets = filteredTickets.filter(ticket => {
            const ticketStatus = (ticket.currentStatus || ticket.status || '').toLowerCase();
            // Handle special case for "in-progress" vs "in_progress"
            if (statusValue === 'in-progress' && ticketStatus === 'in_progress') {
                return true;
            }
            return ticketStatus === statusValue;
        });
    }
    
    // Apply priority filter if it exists and isn't set to 'all'
    if (priorityFilter && priorityFilter.value !== 'all') {
        console.log(`[RENDER] Filtering by priority: ${priorityFilter.value}`);
        filteredTickets = filteredTickets.filter(ticket => 
            (ticket.priority || '').toLowerCase() === priorityFilter.value.toLowerCase()
        );
    }
    
    console.log(`[RENDER] After filtering: ${filteredTickets.length} of ${tickets.length} tickets`);

    // Create tickets list container
    const ticketsListDiv = document.createElement('div');
    ticketsListDiv.className = 'tickets-list';

    // Add message if no tickets after filtering
    if (filteredTickets.length === 0) {
        ticketsListDiv.innerHTML = `
            <div class="alert alert-info" role="alert">
                ${tickets.length > 0 ? 'No tickets match the selected filters.' : 'No tickets found. Create a new ticket to get started.'}
            </div>`;
        container.appendChild(ticketsListDiv);
        return;
    }

    console.log(`[RENDER] Rendering ${filteredTickets.length} tickets`);
    
    // Add each ticket
    filteredTickets.forEach(ticket => {
        const ticketElement = document.createElement('div');
        ticketElement.className = 'card mb-3';
        ticketElement.innerHTML = `
            <div class="card-body">
                <div class="d-flex justify-content-between align-items-start mb-3">
                    <h5 class="card-title mb-0">${escapeHtml(ticket.title)}</h5>
                    <span class="badge ${getStatusBadgeClass(ticket.currentStatus || ticket.status)}">${ticket.currentStatus || ticket.status}</span>
                </div>
                <p class="card-text mb-3">${escapeHtml(ticket.description)}</p>
                <div class="d-flex justify-content-between align-items-center">
                    <div class="text-muted small">
                        <div>Priority: ${escapeHtml(ticket.priority)}</div>
                        <div>Created: ${formatDate(ticket.createdAt)}</div>
                    </div>
                    <div class="btn-group">
                        <button class="btn btn-sm btn-outline-secondary edit-btn" data-ticket-id="${ticket._id}">Edit</button>
                        <button class="btn btn-sm btn-outline-info history-btn" data-ticket-id="${ticket._id}">History</button>
                        <button class="btn btn-sm btn-outline-danger delete-btn" data-ticket-id="${ticket._id}">Delete</button>
                    </div>
                </div>
                <div class="status-history mt-3" id="status-history-${ticket._id}" style="display: none;"></div>
            </div>
        `;
        ticketsListDiv.appendChild(ticketElement);
    });

    // Add tickets list to container
    container.appendChild(ticketsListDiv);
    
    // Set up ticket action buttons
    console.log('[RENDER] Setting up ticket action buttons');
    
    // Set up edit buttons
    document.querySelectorAll('.edit-btn').forEach(button => {
        const ticketId = button.getAttribute('data-ticket-id');
        button.addEventListener('click', function() {
            console.log(`[RENDER] Edit button clicked for ticket ${ticketId}`);
            openEditModal(ticketId);
        });
    });
    
    // Set up history buttons
    document.querySelectorAll('.history-btn').forEach(button => {
        const ticketId = button.getAttribute('data-ticket-id');
        button.addEventListener('click', function() {
            console.log(`[RENDER] History button clicked for ticket ${ticketId}`);
            toggleStatusHistory(ticketId);
        });
    });
    
    // Set up delete buttons
    document.querySelectorAll('.delete-btn').forEach(button => {
        const ticketId = button.getAttribute('data-ticket-id');
        button.addEventListener('click', function() {
            console.log(`[RENDER] Delete button clicked for ticket ${ticketId}`);
            deleteTicket(ticketId);
        });
    });

    console.log('[RENDER] Render complete');
}

function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleString();
}

function getStatusBadge(status) {
    return `<span class="status-badge status-${status.toLowerCase()}">${status}</span>`;
}

function getStatusBadgeClass(status) {
    switch (status?.toLowerCase()) {
        case 'open':
            return 'bg-secondary';
        case 'in_progress':
        case 'in-progress':
            return 'bg-primary';
        case 'resolved':
            return 'bg-success';
        case 'closed':
            return 'bg-dark';
        default:
            return 'bg-secondary';
    }
}

function renderStatusHistory(history) {
    if (!history || history.length === 0) {
        return '<p>No status history available.</p>';
    }

    try {
        // Sort history by timestamp in descending order (newest first)
        const sortedHistory = [...history].sort((a, b) => {
            return new Date(b.timestamp) - new Date(a.timestamp);
        });
        
        return `
            <ul class="timeline">
                ${sortedHistory.map((item, index) => `
                    <li class="timeline-item">
                        <div class="timeline-dot"></div>
                        <div class="timeline-content">
                            <div class="timeline-time">${formatDate(item.timestamp)}</div>
                            <div class="timeline-status">
                                Status: ${getStatusBadge(item.status)}
                            </div>
                            <div class="timeline-user">Updated by: ${item.updatedBy || 'Unknown'}</div>
                            ${item.reason ? `<div class="timeline-reason">Reason: ${item.reason}</div>` : ''}
                        </div>
                    </li>
                `).join('')}
            </ul>
        `;
    } catch (error) {
        console.error('Error rendering status history:', error);
        return '<p>Error rendering status history.</p>';
    }
}

function renderTicket(ticket) {
    const hasHistory = ticket.statusHistory && ticket.statusHistory.length > 0;
    const historyButtonText = hasHistory 
        ? `Show Status History (${ticket.statusHistory.length})` 
        : 'No Status History';
    
    return `
        <div class="ticket priority-${ticket.priority}" data-id="${ticket._id}">
            <div class="ticket-header">
                <h3>${ticket.title}</h3>
                <div class="ticket-status">
                    ${getStatusBadge(ticket.currentStatus || ticket.status)}
                </div>
            </div>
            <div class="ticket-body">
                <p>${ticket.description}</p>
                <div class="ticket-details">
                    <span>Priority: ${ticket.priority}</span>
                    <span>Assigned to: ${ticket.assignedTo || 'Unassigned'}</span>
                    <span>Created by: ${ticket.createdBy || 'Unknown'}</span>
                    <span>Created: ${formatDate(ticket.createdAt)}</span>
                </div>
                <button class="btn btn-sm btn-outline-info toggle-history-btn" 
                        id="toggle-history-${ticket._id}"
                        onclick="toggleStatusHistory('${ticket._id}')">
                    ${historyButtonText}
                </button>
                <div class="status-history mt-3" 
                     id="status-history-${ticket._id}" 
                     style="display: none;">
                </div>
            </div>
            <div class="ticket-actions">
                <button onclick="editTicketHandler('${ticket._id}')">Edit</button>
                <button onclick="deleteTicket('${ticket._id}')">Delete</button>
            </div>
        </div>
    `;
}

// User Management Functions
async function fetchUsers() {
    try {
        const response = await authenticatedFetch(`${USER_API_URL}/users`);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        users = Array.isArray(data) ? data : [];
        renderUsers();
    } catch (error) {
        console.error('Error fetching users:', error);
        showError('Failed to load users. Please try again later.');
    }
}

async function createUser(data) {
    try {
        const url = `${USER_API_URL}/users`;
        console.log(`[createUser] Sending request to ${url}`, data);
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(data)
        });

        console.log(`[createUser] Response status: ${response.status}`);
        
        // Get the response text first
        const responseText = await response.text();
        console.log(`[createUser] Response text:`, responseText);
        
        let parsedResponse;
        
        // Try to parse the response as JSON
        try {
            parsedResponse = responseText ? JSON.parse(responseText) : {};
        } catch (parseError) {
            console.error('[createUser] Error parsing response as JSON:', parseError);
            throw new Error(`Server returned invalid JSON: ${responseText.substring(0, 100)}...`);
        }

        if (!response.ok) {
            throw new Error(parsedResponse.error || `Server error: ${response.status}`);
        }

        // Use the parsed response as the new user
        const newUser = parsedResponse;
        users = [...users, newUser];
        renderUsers();
        userForm.reset();
        showSuccess(`User created successfully! User ID: ${newUser.id}`);
    } catch (error) {
        console.error('Error creating user:', error);
        showError(error.message || 'Failed to create user. Please try again.');
    }
}

function renderUsers() {
    if (!Array.isArray(users)) {
        console.error('Users is not an array:', users);
        users = [];
    }

    const usersList = document.getElementById('usersList');
    if (!usersList) {
        console.error('Users list element not found');
        return;
    }

    if (users.length === 0) {
        usersList.innerHTML = '<p>No users found. Create a user to get started.</p>';
        return;
    }

    usersList.innerHTML = users.map(user => `
        <div class="user-card">
            <div class="user-id">ID: ${user.id || 'N/A'}</div>
            <h3>${user.name || 'Unnamed User'}</h3>
            ${user.email ? `<p>Email: ${user.email}</p>` : ''}
            <p>Role: ${user.role || 'User'}</p>
            <p>Created: ${user.createdAt ? formatDate(user.createdAt) : 'N/A'}</p>
        </div>
    `).join('');
}

// Function to toggle status history display
async function toggleStatusHistory(ticketId) {
    try {
        console.log(`[HISTORY DEBUG] Toggling history for ticket ${ticketId}`);
        const historyDiv = document.getElementById(`status-history-${ticketId}`);
        if (!historyDiv) {
            console.error(`[HISTORY DEBUG] Could not find history div for ticket ${ticketId}`);
        return;
    }
    
        const isHidden = historyDiv.style.display === 'none' || !historyDiv.style.display;
        
        if (isHidden) {
            console.log(`[HISTORY DEBUG] History is hidden, fetching and showing`);
            
            // Show loading indicator
            historyDiv.innerHTML = '<p class="text-center"><div class="spinner-border text-primary" role="status"><span class="visually-hidden">Loading...</span></div></p>';
            historyDiv.style.display = 'block';
            
            // Get the authentication token
            const authToken = localStorage.getItem('authToken');
            if (!authToken) {
                throw new Error('Authentication required');
            }
            
            console.log(`[HISTORY DEBUG] Fetching status history from: ${STATUS_API_URL}/status/${ticketId}/history`);
            
            try {
                // Fetch latest status history
                const response = await fetch(`${STATUS_API_URL}/status/${ticketId}/history`, {
                    method: 'GET',
                    headers: getAuthHeaders('status'),
                    credentials: 'include',
                    mode: 'cors'
                });
                
                const responseData = await response.json();
                console.log(`[HISTORY DEBUG] Response status: ${response.status}, Data:`, responseData);
                
                // Handle various response cases
                if (!response.ok) {
                    if (response.status === 404) {
                        console.log(`[HISTORY DEBUG] No history found for ticket ${ticketId}`);
                        historyDiv.innerHTML = `
                            <div class="alert alert-info">
                                No status history available for this ticket yet.
                            </div>
                            <button class="btn btn-sm btn-primary" onclick="createInitialStatus('${ticketId}')">
                                Create Initial Status History
                            </button>`;
                        return;
                } else {
                        throw new Error(`Failed to fetch status history: ${response.status}`);
                    }
                }
                
                // Check if response is an array (history) or an object with message (no history)
                if (Array.isArray(responseData)) {
                    if (responseData.length === 0) {
                        historyDiv.innerHTML = `
                            <div class="alert alert-info">
                                No status history available for this ticket yet.
                            </div>
                            <button class="btn btn-sm btn-primary" onclick="createInitialStatus('${ticketId}')">
                                Create Initial Status History
                            </button>`;
                } else {
                        historyDiv.innerHTML = renderStatusHistory(responseData);
                    }
                } else if (responseData.message && responseData.message.includes('No history found')) {
                    console.log(`[HISTORY DEBUG] No history message received for ticket ${ticketId}`);
                    historyDiv.innerHTML = `
                        <div class="alert alert-info">
                            No status history available for this ticket yet.
                                </div>
                        <button class="btn btn-sm btn-primary" onclick="createInitialStatus('${ticketId}')">
                            Create Initial Status History
                        </button>`;
                } else {
                    // Unknown response format
                    console.error(`[HISTORY DEBUG] Unexpected response format:`, responseData);
                    historyDiv.innerHTML = '<div class="alert alert-warning">Could not parse status history. Please try again later.</div>';
                }
            } catch (fetchError) {
                console.error(`[HISTORY DEBUG] Fetch error:`, fetchError);
                historyDiv.innerHTML = '<div class="alert alert-danger">Error loading status history. Please try again later.</div>';
            }
    } else {
            console.log(`[HISTORY DEBUG] History is visible, hiding`);
            historyDiv.style.display = 'none';
        }
    } catch (error) {
        console.error('[HISTORY DEBUG] Error:', error);
        showError('Failed to load status history. Please try again.');
    }
}

// Function to open edit modal
async function openEditModal(ticketId) {
    try {
        console.log(`[MODAL DEBUG] Opening edit modal for ticket ${ticketId}`);
        console.log(`[MODAL DEBUG] Bootstrap available: ${typeof bootstrap !== 'undefined'}`);
        
        if (typeof bootstrap === 'undefined') {
            console.error('[MODAL DEBUG] Bootstrap is not available - attempting to load it again');
            // Try to load it again
            const script = document.createElement('script');
            script.src = 'https://cdn.jsdelivr.net/npm/bootstrap@5.1.3/dist/js/bootstrap.bundle.min.js';
            script.integrity = 'sha384-ka7Sk0Gln4gmtz2MlQnikT1wXgYsOg+OMhuP+IlRH9sENBO0LRn5q+8nbTov4+1p';
            script.crossOrigin = 'anonymous';
            script.onload = function() {
                console.log('[MODAL DEBUG] Bootstrap loaded successfully through fallback');
                // Try opening the modal again after bootstrap loads
                setTimeout(() => openEditModal(ticketId), 100);
            };
            document.body.appendChild(script);
            return;
        }
        
        console.log(`[MODAL DEBUG] Fetching ticket data for ticket ${ticketId}`);
        const ticket = await refreshTicket(ticketId, false);
        if (!ticket) {
            console.error('[MODAL DEBUG] Failed to fetch ticket data');
            throw new Error('Failed to fetch ticket data');
        }
        
        console.log('[MODAL DEBUG] Ticket data fetched successfully', ticket);
        
        // Update form fields
        document.getElementById('editId').value = ticket._id;
        document.getElementById('editTitle').value = ticket.title;
        document.getElementById('editDescription').value = ticket.description;
        document.getElementById('editPriority').value = ticket.priority;
        document.getElementById('editAssignedTo').value = ticket.assignedTo || '';
        
        const statusSelect = document.getElementById('editStatus');
        const currentStatus = ticket.currentStatus || ticket.status;
        console.log(`[MODAL DEBUG] Setting status to ${currentStatus}`);
        statusSelect.value = currentStatus;
        statusSelect.setAttribute('data-original', currentStatus);
        
        // Reset reason field
        const reasonField = document.getElementById('editStatusReason');
        reasonField.value = '';
        
        // Set up the status change functionality
        const statusReasonDiv = document.getElementById('statusReasonDiv');
        
        // Initially hide the reason field until status changes
        statusReasonDiv.style.display = 'none';
        statusReasonDiv.classList.remove('visible');
        
        // Create status reason help text if it doesn't exist
        let reasonHelp = statusReasonDiv.querySelector('.status-reason-help');
        if (!reasonHelp) {
            reasonHelp = document.createElement('div');
            reasonHelp.className = 'status-reason-help form-text';
            reasonHelp.innerHTML = 'Please provide a reason for changing the status.';
            statusReasonDiv.appendChild(reasonHelp);
        }
        
        // Set up status change handler (defined immediately)
        statusSelect.onchange = function() {
            const originalStatus = this.getAttribute('data-original');
            const reasonDiv = document.getElementById('statusReasonDiv');
            
            // Show reason field if status has changed from original
            if (this.value !== originalStatus) {
                reasonDiv.style.display = 'block';
                reasonDiv.classList.add('visible');
                reasonField.setAttribute('required', 'required');
                reasonField.focus(); // Focus on the reason field when shown
                
                // Update help text to indicate it's required
                if (reasonHelp) {
                    reasonHelp.innerHTML = '<strong style="color: #dc3545">Required:</strong> Please provide a reason for changing the status.';
                }
            } else {
                reasonDiv.style.display = 'none';
                reasonDiv.classList.remove('visible');
                reasonField.removeAttribute('required');
                
                // Reset help text
                if (reasonHelp) {
                    reasonHelp.innerHTML = 'Please provide a reason for changing the status.';
                }
            }
        };
        
        // Trigger the change event if the status is already different (in case of reopening)
        if (statusSelect.value !== statusSelect.getAttribute('data-original')) {
            statusSelect.dispatchEvent(new Event('change'));
        }
        
        // Find the modal element
        const modalElement = document.getElementById('editModal');
        if (!modalElement) {
            console.error('[MODAL DEBUG] Modal element not found in the DOM');
            throw new Error('Edit modal element not found');
        }
        
        console.log('[MODAL DEBUG] Modal element found, cleaning up any existing modal structures');
        
        // IMPORTANT FIX: Always clean up the DOM first
        document.querySelectorAll('.modal-backdrop').forEach(el => {
            console.log('[MODAL DEBUG] Removing existing backdrop');
            el.remove();
        });
        
        document.body.classList.remove('modal-open');
        document.body.style.overflow = '';
        document.body.style.paddingRight = '';
        
        // Create a completely new modal instance (dispose any existing)
        console.log('[MODAL DEBUG] Creating new bootstrap modal instance');
        try {
            const existingModal = bootstrap.Modal.getInstance(modalElement);
            if (existingModal) {
                console.log('[MODAL DEBUG] Disposing existing modal instance');
                existingModal.dispose();
            }
            
            // Ensure the modal is properly set up in the DOM
            modalElement.classList.remove('show');
            modalElement.style.display = '';
            modalElement.removeAttribute('aria-modal');
            modalElement.setAttribute('aria-hidden', 'true');
            
            // Ensure proper z-index for modal - CRITICAL FIX
            modalElement.style.zIndex = '1050';
            const modalContent = modalElement.querySelector('.modal-content');
            if (modalContent) {
                modalContent.style.zIndex = '1060';
                modalContent.style.position = 'relative';
                modalContent.style.visibility = 'visible';
            }
            
            // Create a fresh modal instance
            console.log('[MODAL DEBUG] Creating fresh Bootstrap modal instance');
            const modal = new bootstrap.Modal(modalElement, {
                backdrop: 'static',  // This prevents closing when clicking outside
                keyboard: true,      // Allow ESC key to close
                focus: true          // Focus on the modal when shown
            });
            
            // Show the modal
            console.log('[MODAL DEBUG] Showing modal with show() method');
            modal.show();

            // Additional safeguard - if modal doesn't show properly, try direct DOM manipulation
            setTimeout(() => {
                if (!modalElement.classList.contains('show') || modalElement.style.display === 'none') {
                    console.log('[MODAL DEBUG] Modal not showing properly, trying direct DOM manipulation');
                    modalElement.classList.add('show');
                    modalElement.style.display = 'block';
                    modalElement.setAttribute('aria-modal', 'true');
                    modalElement.removeAttribute('aria-hidden');
                    modalElement.style.zIndex = '1050';
                    
                    // Create backdrop if missing
                    if (!document.querySelector('.modal-backdrop')) {
                        const backdrop = document.createElement('div');
                        backdrop.className = 'modal-backdrop fade show';
                        backdrop.style.zIndex = '1040';
                        document.body.appendChild(backdrop);
                    }
                    
                    // Ensure modal content is visible
                    const modalContent = modalElement.querySelector('.modal-content');
                    if (modalContent) {
                        modalContent.style.zIndex = '1060';
                        modalContent.style.position = 'relative';
                        modalContent.style.visibility = 'visible';
                        modalContent.style.display = 'block';
                    }
                    
                    document.body.classList.add('modal-open');
                }
                
                // Debug: Check modal content visibility
                const modalContent = modalElement.querySelector('.modal-content');
                if (modalContent) {
                    if (modalContent.offsetParent === null) {
                        console.warn('[MODAL DEBUG] Modal content is not visible (offsetParent is null)');
                        // Force visibility as last resort
                        modalContent.style.display = 'block';
                        modalContent.style.visibility = 'visible';
                        modalContent.style.opacity = '1';
                        modalContent.style.zIndex = '1060';
                        
                        // Also check if modal dialog is visible
                        const modalDialog = modalElement.querySelector('.modal-dialog');
                        if (modalDialog) {
                            modalDialog.style.display = 'block';
                            modalDialog.style.visibility = 'visible';
                            modalDialog.style.opacity = '1';
                            modalDialog.style.zIndex = '1055';
                        }
                    } else {
                        console.log('[MODAL DEBUG] Modal content is visible');
                    }
                    
                    // Add a red border for debugging
                    modalContent.style.border = '3px solid red';
                } else {
                    console.warn('[MODAL DEBUG] .modal-content not found inside modal');
                }
            }, 400);
            
            console.log('[MODAL DEBUG] Modal setup complete');
        } catch (bootstrapError) {
            console.error('[MODAL DEBUG] Bootstrap error:', bootstrapError);
            // Fallback to basic HTML/CSS modal if Bootstrap fails
            console.log('[MODAL DEBUG] Using fallback modal method');
            modalElement.style.display = 'block';
            modalElement.classList.add('show');
            document.body.classList.add('modal-open');
            
            const backdrop = document.createElement('div');
            backdrop.className = 'modal-backdrop fade show';
            document.body.appendChild(backdrop);
        }
    } catch (error) {
        console.error('[MODAL DEBUG] Fatal error in openEditModal:', error);
        alert('Error opening edit form: ' + error.message);
    }
}

function closeModalHandler() {
    try {
        console.log('[MODAL DEBUG] closeModalHandler called');
        
        // Get modal element
        const modalElement = document.getElementById('editModal');
        if (!modalElement) {
            console.error('[MODAL DEBUG] Modal element not found');
            return;
        }
        
        console.log('[MODAL DEBUG] Modal element found, starting cleanup');
        
        // Try Bootstrap way first if available
        if (typeof bootstrap !== 'undefined') {
            console.log('[MODAL DEBUG] Bootstrap is available, using it to hide modal');
            try {
                const modal = bootstrap.Modal.getInstance(modalElement);
                if (modal) {
                    console.log('[MODAL DEBUG] Bootstrap modal instance found, hiding it');
                    modal.hide();
                } else {
                    console.log('[MODAL DEBUG] No Bootstrap modal instance found, will use direct DOM manipulation');
                }
            } catch (bootstrapError) {
                console.error('[MODAL DEBUG] Error using Bootstrap to hide modal:', bootstrapError);
            }
        } else {
            console.log('[MODAL DEBUG] Bootstrap not available, using direct DOM manipulation');
        }
        
        // Always do direct DOM manipulation as a fallback
        console.log('[MODAL DEBUG] Performing thorough manual cleanup');
        
        // Clean up modal content and dialog
        const modalContent = modalElement.querySelector('.modal-content');
        if (modalContent) {
            modalContent.style.border = '';
            modalContent.style.zIndex = '';
            modalContent.style.visibility = '';
            modalContent.style.display = '';
            modalContent.style.position = '';
            modalContent.style.opacity = '';
        }
        
        const modalDialog = modalElement.querySelector('.modal-dialog');
        if (modalDialog) {
            modalDialog.style.display = '';
            modalDialog.style.visibility = '';
            modalDialog.style.opacity = '';
            modalDialog.style.zIndex = '';
        }
        
        // Hide the modal element
        modalElement.classList.remove('show');
        modalElement.style.display = 'none';
        modalElement.setAttribute('aria-hidden', 'true');
        modalElement.removeAttribute('aria-modal');
        modalElement.style.zIndex = '';
        
        // Remove all backdrops
        document.querySelectorAll('.modal-backdrop').forEach(backdrop => {
            console.log('[MODAL DEBUG] Removing backdrop element');
            backdrop.remove();
        });
        
        // Remove body modifications
        document.body.classList.remove('modal-open');
        document.body.style.overflow = '';
        document.body.style.paddingRight = '';
        
        // Reset the form
        const editForm = document.getElementById('editForm');
        if (editForm) {
            console.log('[MODAL DEBUG] Resetting form');
            editForm.reset();
        } else {
            console.log('[MODAL DEBUG] Edit form not found');
        }
        
        console.log('[MODAL DEBUG] Modal cleanup completed successfully');
    } catch (error) {
        console.error('[MODAL DEBUG] Error in closeModalHandler:', error);
        
        // Last resort manual cleanup
        try {
            console.log('[MODAL DEBUG] Attempting last resort cleanup');
            document.querySelectorAll('.modal-backdrop').forEach(el => el.remove());
            document.body.classList.remove('modal-open');
            document.body.style.overflow = '';
            document.body.style.paddingRight = '';
            
            const modalElement = document.getElementById('editModal');
            if (modalElement) {
                modalElement.style.display = 'none';
                modalElement.classList.remove('show');
                modalElement.style.zIndex = '';
                
                const modalContent = modalElement.querySelector('.modal-content');
                if (modalContent) {
                    modalContent.style.border = '';
                    modalContent.style.zIndex = '';
                    modalContent.style.visibility = '';
                    modalContent.style.display = '';
                    modalContent.style.position = '';
                    modalContent.style.opacity = '';
                }
                
                const modalDialog = modalElement.querySelector('.modal-dialog');
                if (modalDialog) {
                    modalDialog.style.display = '';
                    modalDialog.style.visibility = '';
                    modalDialog.style.opacity = '';
                    modalDialog.style.zIndex = '';
                }
            }
        } catch (finalError) {
            console.error('[MODAL DEBUG] Even last resort cleanup failed:', finalError);
        }
    }
}

// Helper functions
function showError(message) {
    // Create a Bootstrap alert
    const alertContainer = document.createElement('div');
    alertContainer.className = 'alert alert-danger alert-dismissible fade show';
    alertContainer.setAttribute('role', 'alert');
    alertContainer.innerHTML = `
        <strong>Error!</strong> ${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
    `;
    
    // Add to the page
    const container = document.querySelector('header');
    container.parentNode.insertBefore(alertContainer, container.nextSibling);
    
    // Auto remove after 5 seconds
    setTimeout(() => {
        const bsAlert = bootstrap.Alert.getOrCreateInstance(alertContainer);
        bsAlert.close();
    }, 5000);
}

function showSuccess(message) {
    // Check if the same message is already showing
    const existingAlerts = document.querySelectorAll('.alert.alert-success');
    for (const alert of existingAlerts) {
        if (alert.textContent.includes(message)) {
            return; // Skip creating duplicate alert
        }
    }

    // Create a Bootstrap alert
    const alertContainer = document.createElement('div');
    alertContainer.className = 'alert alert-success alert-dismissible fade show';
    alertContainer.setAttribute('role', 'alert');
    alertContainer.innerHTML = `
        <strong>Success!</strong> ${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
    `;
    
    // Add to the page
    const container = document.querySelector('header');
    container.parentNode.insertBefore(alertContainer, container.nextSibling);
    
    // Auto remove after 5 seconds
    setTimeout(() => {
        const bsAlert = bootstrap.Alert.getOrCreateInstance(alertContainer);
        bsAlert.close();
    }, 5000);
}

function escapeHtml(unsafe) {
    return unsafe
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

// Populate edit form
function populateEditForm(ticket) {
    document.getElementById('editId').value = ticket._id;
    document.getElementById('editTitle').value = ticket.title || '';
    document.getElementById('editDescription').value = ticket.description || '';
    
    // Save the original status for comparison
    const originalStatus = ticket.currentStatus || ticket.status || 'open';
    document.getElementById('editStatus').value = originalStatus;
    document.getElementById('editStatus').setAttribute('data-original', originalStatus);
    
    document.getElementById('editPriority').value = ticket.priority || 'medium';
    document.getElementById('editAssignedTo').value = ticket.assignedTo || '';
    document.getElementById('editStatusReason').value = '';
    
    // Add event listener for status changes
    const statusSelect = document.getElementById('editStatus');
    const reasonField = document.getElementById('editStatusReason');
    const reasonHelp = document.querySelector('.status-reason-help');
    
    // Remove previous event listener if it exists
    statusSelect.removeEventListener('change', handleStatusChange);
    
    // Add new event listener
    statusSelect.addEventListener('change', handleStatusChange);
    
    // Initial check
    checkStatusChanged();
    
    // Status change handler function
    function handleStatusChange() {
        checkStatusChanged();
    }
    
    // Function to check if status has changed and update UI accordingly
    function checkStatusChanged() {
        const originalValue = statusSelect.getAttribute('data-original');
        const currentValue = statusSelect.value;
        const hasChanged = originalValue !== currentValue;
        
        if (hasChanged) {
            reasonField.setAttribute('required', 'required');
            reasonField.style.borderColor = '#dc3545';
            if (reasonHelp) {
                reasonHelp.innerHTML = '<strong style="color: #dc3545">Required:</strong> Please provide a reason for changing the status.';
            }
        } else {
            reasonField.removeAttribute('required');
            reasonField.style.borderColor = '';
            if (reasonHelp) {
                reasonHelp.innerHTML = 'This reason will be recorded in the ticket\'s status history.';
                reasonHelp.style.color = '';
            }
        }
    }
}

// Make edit handler globally available (for onclick in HTML)
window.editTicketHandler = openEditModal;
window.deleteTicket = deleteTicket;
window.toggleStatusHistory = toggleStatusHistory;
window.createInitialStatus = createInitialStatus;
window.closeModalHandler = closeModalHandler;
window.submitEditForm = submitEditForm;

// Add function to global scope for use in HTML
window.refreshTicket = refreshTicket;

// Initialize the files tab
function initializeFilesTab() {
    const filesTab = document.querySelector('[data-tab="files"]');
    if (filesTab) {
        filesTab.addEventListener('click', () => {
            // Activate files tab
            document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
            filesTab.classList.add('active');
            const filesContent = document.getElementById('files-tab');
            if (filesContent) {
                filesContent.classList.add('active');
            }
            
            // Load files list when tab is clicked
            listFiles();
            
            // Make sure the file upload form is properly set up
            setupFileUploadForm();
        });
    }
    
    // Initial setup of file upload form
    setupFileUploadForm();
}

// Separate function to ensure the file upload form is properly set up
function setupFileUploadForm() {
    // Set up file upload form
    const fileUploadForm = document.getElementById('fileUploadForm');
    if (fileUploadForm) {
        // Remove any existing listeners to prevent duplicates
        fileUploadForm.removeEventListener('submit', uploadFile);
        
        // Add the event listener
        fileUploadForm.addEventListener('submit', uploadFile);
        console.log('File upload form listener attached');
    } else {
        console.error('File upload form not found in DOM');
    }
}

// Add these functions for file management
async function listFiles() {
    try {
        console.log('Fetching files list from:', `${DOWNLOADER_API_URL}/api/files/list`);
        console.log('FOR DEBUGGING: Please visit this URL to check your token: ' + 
                    `${DOWNLOADER_API_URL}/api/files/debug-token`);
        
        const response = await fetch(`${DOWNLOADER_API_URL}/api/files/list`, {
            headers: getAuthHeaders()
        });
        
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.message || 'Failed to fetch files');
        }
        
        const files = await response.json();
        console.log('Files fetched successfully:', files.length);
        renderFiles(files);
    } catch (error) {
        console.error('Error listing files:', error);
        showError('Failed to load files list. Please check console for debug info.');
    }
}

function renderFiles(files) {
    const filesContainer = document.getElementById('filesList');
    if (!filesContainer) {
        console.error('Files container element not found');
        return;
    }
    
    if (!files || files.length === 0) {
        filesContainer.innerHTML = '<p>No files found</p>';
        return;
    }

    filesContainer.innerHTML = files.map(file => `
        <div class="file-item" data-key="${file.key}">
            <div class="file-info">
                <span class="file-name">${file.key}</span>
                <span class="file-size">${formatFileSize(file.size)}</span>
            </div>
            <div class="file-actions">
                <button class="download-btn" onclick="downloadFile('${file.key}')">Download</button>
                <button class="delete-btn" onclick="deleteFile('${file.key}')">Delete</button>
            </div>
        </div>
    `).join('');
}

function formatFileSize(bytes) {
    if (!bytes) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Add debounce logic to prevent duplicate uploads
let uploadInProgress = false;

async function uploadFile(event) {
    // Prevent default form submission behavior - needs to be first
    event.preventDefault();
    event.stopPropagation();
    
    // Prevent duplicate upload requests
    if (uploadInProgress) {
        console.log('Upload already in progress, ignoring duplicate request');
        return;
    }
    
    const fileInput = document.getElementById('fileInput');
    if (!fileInput || !fileInput.files.length) {
        showError('Please select a file to upload');
        return;
    }
    
    // Create form data
    const formData = new FormData();
    formData.append('file', fileInput.files[0]);
    
    // Show upload status
    showSuccess(`Starting upload for file: ${fileInput.files[0].name}...`);
    
    try {
        // Set flag to prevent duplicate uploads
        uploadInProgress = true;
        
        // Get authentication headers
        const headers = getAuthHeaders();
        
        // Remove Content-Type so browser can set it with proper boundary
        delete headers['Content-Type'];
        
        const response = await fetch(`${DOWNLOADER_API_URL}/api/files/upload`, {
            method: 'POST',
            headers,
            body: formData,
            // Prevent automatic redirect which might cause issues
            redirect: 'manual'
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.message || 'Failed to upload file');
        }

        const result = await response.json();
        showSuccess(result.message || 'File uploaded successfully');
        fileInput.value = '';
        
        // Wait a moment before refreshing the list to give background processing time
        setTimeout(() => {
            listFiles();
        }, 2000);
    } catch (error) {
        console.error('Error uploading file:', error);
        showError(error.message || 'Failed to upload file');
    } finally {
        // Clear the flag to allow future uploads
        setTimeout(() => {
            uploadInProgress = false;
        }, 1000);
    }
}

async function deleteFile(key) {
    if (!confirm('Are you sure you want to delete this file?')) {
        return;
    }

    try {
        console.log('Deleting file:', key);
        
        const response = await fetch(`${DOWNLOADER_API_URL}/api/files/${encodeURIComponent(key)}`, {
            method: 'DELETE',
            headers: getAuthHeaders()
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.message || 'Failed to delete file');
        }

        showSuccess('File deleted successfully');
        listFiles(); // Refresh the files list
    } catch (error) {
        console.error('Error deleting file:', error);
        showError(error.message || 'Failed to delete file');
    }
}

// Track in-progress downloads to prevent duplicates
const activeDownloads = new Set();

async function downloadFile(key) {
    try {
        // Prevent duplicate downloads of the same file
        if (activeDownloads.has(key)) {
            console.log(`Download already in progress for ${key}, ignoring duplicate request`);
            return;
        }
        
        // Mark this file as being downloaded
        activeDownloads.add(key);
        
        // Get auth token
        const token = localStorage.getItem('authToken');
        if (!token) {
            showError('Authentication required to download files');
            activeDownloads.delete(key);
            return;
        }
        
        // Show a loading indicator
        const filename = key.split('/').pop();
        showSuccess(`Starting download for file: ${filename}`);
        
        // Create a unique download URL with requestId to prevent browser caching
        const requestId = Date.now();
        const downloadUrl = `${DOWNLOADER_API_URL}/api/files/download/${encodeURIComponent(key)}?token=${token}&requestId=${requestId}`;
        
        // Use a more reliable download approach with fetch + blob
        try {
            const response = await fetch(downloadUrl, {
                headers: {
                    'X-No-Queue': 'true' // Signal to not use message queue
                }
            });
            
            if (!response.ok) {
                throw new Error(`Download failed with status: ${response.status}`);
            }
            
            // Get the blob data
            const blob = await response.blob();
            
            // Create object URL and trigger download
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.style.display = 'none';
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            
            // Clean up
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
        } catch (error) {
            console.error('Error during fetch download:', error);
            showError(`Download failed: ${error.message}`);
        }
    } catch (error) {
        console.error('Error downloading file:', error);
        showError('Failed to download file');
    } finally {
        // Always remove from active downloads when finished
        setTimeout(() => {
            activeDownloads.delete(key);
        }, 2000);
    }
}

// Helper function to get auth headers
function getAuthHeaders() {
    const token = localStorage.getItem('authToken');
    
    // Log token for debugging (only partial, for security)
    if (token) {
        const firstChars = token.substring(0, 10);
        const lastChars = token.substring(token.length - 10);
        console.debug(`[getAuthHeaders] Using token: ${firstChars}...${lastChars}`);
    } else {
        console.warn('[getAuthHeaders] No authentication token available');
    }
    
    return {
        'Authorization': token ? `Bearer ${token}` : '',
        'Content-Type': 'application/json'
    };
}

// Initialize the application
document.addEventListener('DOMContentLoaded', () => {
    // Initialize the files tab
    initializeFilesTab();
});

// Expose file functions to global scope
window.listFiles = listFiles;
window.downloadFile = downloadFile;
window.deleteFile = deleteFile;
window.uploadFile = uploadFile;

// Add the missing createInitialStatus function
async function createInitialStatus(ticketId) {
    try {
        console.log(`[createInitialStatus] Creating initial status for ticket ${ticketId}`);
        const authToken = localStorage.getItem('authToken');
        if (!authToken) {
            throw new Error('Authentication required');
        }

        // First get the ticket details to use as initial status
        const ticketResponse = await fetch(`${TICKET_API_URL}/${ticketId}`, {
            headers: getAuthHeaders()
        });
        
        if (!ticketResponse.ok) {
            throw new Error(`Failed to fetch ticket: ${ticketResponse.status}`);
        }
        
        const ticketData = await ticketResponse.json();
        const initialStatus = ticketData.status || 'open';
        
        // Create initial status via status service
        const statusResponse = await fetch(`${STATUS_API_URL}/status/${ticketId}/update`, {
            method: 'POST',
            headers: getAuthHeaders('status'),
            body: JSON.stringify({
                status: initialStatus,
                updatedBy: currentUser?.email || 'system',
                reason: 'Initial status creation'
            })
        });
        
        if (!statusResponse.ok) {
            throw new Error(`Failed to create status: ${statusResponse.status}`);
        }
        
        showSuccess(`Initial status "${initialStatus}" created for ticket ${ticketId}`);
        
        // Refresh the status history display
        toggleStatusHistory(ticketId);
    } catch (error) {
        console.error(`[createInitialStatus] Error:`, error);
        showError(error.message || 'Failed to create initial status');
    }
} 