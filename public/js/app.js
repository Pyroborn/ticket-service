// DOM Elements
const ticketForm = document.getElementById('ticketForm');
const ticketsList = document.getElementById('ticketsList');
const userForm = document.getElementById('userForm');
const usersList = document.getElementById('usersList');
const modal = document.getElementById('modal');
const editForm = document.getElementById('editForm');
const closeModal = document.querySelector('.close');
const statusFilter = document.getElementById('statusFilter');
const priorityFilter = document.getElementById('priorityFilter');
const navTabs = document.querySelectorAll('.nav-tab');
const tabContents = document.querySelectorAll('.tab-content');

// API endpoints
const TICKET_API_URL = '/api/tickets';
const USER_API_URL = 'http://localhost:3003/users';
const DOWNLOADER_API_URL = 'http://localhost:3004/api/files';

// State
let tickets = [];
let users = [];

// Tab navigation
document.querySelectorAll('.nav-tab').forEach(tab => {
    tab.addEventListener('click', () => {
        // Remove active class from all tabs and content
        document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
        
        // Add active class to clicked tab
        tab.classList.add('active');
        
        // Show corresponding content
        const tabId = `${tab.dataset.tab}-tab`;
        document.getElementById(tabId).classList.add('active');

        // Load content based on tab
        if (tabId === 'users-tab') {
            fetchUsers();
        } else if (tabId === 'tickets-tab') {
            fetchTickets();
        } else if (tabId === 'files-tab') {
            listFiles();
        }
    });
});

// Fetch all tickets
async function fetchTickets() {
    try {
        const response = await fetch(TICKET_API_URL);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        
        tickets = Array.isArray(data) ? data : [];
        renderTickets();
    } catch (error) {
        console.error('Error fetching tickets:', error);
        showError('Failed to load tickets. Please try again later.');
    }
}

// Create ticket
async function createTicket(data) {
    try {
        const response = await fetch(TICKET_API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(data)
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || 'Failed to create ticket');
        }

        const newTicket = await response.json();
        if (newTicket && newTicket._id) {
            tickets = Array.isArray(tickets) ? [...tickets, newTicket] : [newTicket];
            renderTickets();
            ticketForm.reset();
            showSuccess('Ticket created successfully!');
        } else {
            throw new Error('Invalid ticket data received');
        }
    } catch (error) {
        console.error('Error creating ticket:', error.message);
        showError(error.message || 'Failed to create ticket. Please try again.');
    }
}

// Update ticket
async function updateTicket(id, data) {
    try {
        // Get the original ticket to determine if status is changing
        const originalTicket = tickets.find(t => t._id === id);
        const isStatusChanging = originalTicket && 
            originalTicket.status !== data.status && 
            originalTicket.currentStatus !== data.status;
            
        // Make sure we include reason if status is changing
        if (isStatusChanging && !data.reason) {
            data.reason = `Status changed to ${data.status}`;
        }
            
        const response = await fetch(`${TICKET_API_URL}/${id}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                ...data,
                updatedBy: 'User', // In a real app, this would come from authentication
            })
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || 'Failed to update ticket');
        }

        const updatedTicket = await response.json();
        
        // Update the tickets array with the latest data
        tickets = tickets.map(ticket => 
            ticket._id === id ? updatedTicket : ticket
        );
        
        // Fetch the updated tickets but avoid re-rendering the entire list which can cause UI flicker
        setTimeout(() => {
            fetchTickets();
        }, 500);
        
        closeModalHandler();
        showSuccess('Ticket updated successfully!');
    } catch (error) {
        console.error('Error updating ticket:', error);
        showError(error.message || 'Failed to update ticket. Please try again.');
    }
}

// Delete ticket
async function deleteTicket(id) {
    if (!confirm('Are you sure you want to delete this ticket?')) return;
    
    try {
        const response = await fetch(`${TICKET_API_URL}/${id}`, {
            method: 'DELETE'
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || 'Failed to delete ticket');
        }

        tickets = tickets.filter(ticket => ticket._id !== id);
        renderTickets();
        showSuccess('Ticket deleted successfully!');
    } catch (error) {
        console.error('Error deleting ticket:', error);
        showError(error.message || 'Failed to delete ticket. Please try again.');
    }
}

// Render tickets
function renderTickets() {
    const statusValue = statusFilter.value;
    const priorityValue = priorityFilter.value;
    
    if (!Array.isArray(tickets)) {
        console.error('Tickets is not an array:', tickets);
        tickets = [];
    }
    
    let filteredTickets = tickets;
    
    if (statusValue) {
        filteredTickets = filteredTickets.filter(ticket => 
            (ticket.currentStatus === statusValue) || (ticket.status === statusValue)
        );
    }
    if (priorityValue) {
        filteredTickets = filteredTickets.filter(ticket => ticket.priority === priorityValue);
    }
    
    // Store which history elements are currently visible before re-rendering
    const visibleHistoryIds = [];
    document.querySelectorAll('.status-history').forEach(el => {
        if (el.id && el.style.display !== 'none') {
            visibleHistoryIds.push(el.id.replace('history-', ''));
        }
    });
    
    // Render the tickets
    ticketsList.innerHTML = filteredTickets.map(ticket => renderTicket(ticket)).join('') || '<p>No tickets found</p>';
    
    // Restore visibility of history elements
    visibleHistoryIds.forEach(id => {
        const historyElement = document.getElementById(`history-${id}`);
        const ticket = tickets.find(t => t._id === id);
        if (historyElement && ticket) {
            historyElement.style.display = 'block';
            const toggleButton = historyElement.previousElementSibling;
            if (toggleButton) {
                toggleButton.textContent = `Hide Status History (${ticket.statusHistory?.length || 0})`;
            }
        }
    });
}

function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleString();
}

function getStatusBadge(status) {
    return `<span class="status-badge status-${status.toLowerCase()}">${status}</span>`;
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
                <div class="status-history-toggle" onclick="toggleStatusHistory('${ticket._id}')">
                    ${historyButtonText}
                </div>
                <div class="status-history" id="history-${ticket._id}" style="display: none;">
                    <h4>Status History</h4>
                    ${renderStatusHistory(ticket.statusHistory)}
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
        const response = await fetch(USER_API_URL);
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
        const response = await fetch(USER_API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(data)
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to create user');
        }

        const newUser = await response.json();
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
            <p>Role: ${user.role || 'User'}</p>
            <p>Created: ${user.createdAt ? formatDate(user.createdAt) : 'N/A'}</p>
        </div>
    `).join('');
}

function toggleStatusHistory(ticketId) {
    const historyElement = document.getElementById(`history-${ticketId}`);
    
    if (!historyElement) {
        console.error(`Could not find history element for ticket ${ticketId}`);
        return;
    }
    
    const toggleButton = historyElement.previousElementSibling;
    
    // Check if the history element is visible
    if (historyElement.style.display === 'none') {
        // Show loading indicator
        historyElement.style.display = 'block';
        historyElement.innerHTML = `
            <h4>Status History</h4>
            <div class="loading-indicator">
                <p>Loading status history...</p>
            </div>
        `;
        toggleButton.textContent = 'Loading...';
        
        // Refresh the ticket data to get the latest status history
        refreshTicket(ticketId, false) // Pass false to not re-render all tickets
            .then(updatedTicket => {
                // Update toggle button text
                toggleButton.textContent = `Hide Status History (${updatedTicket.statusHistory?.length || 0})`;
                
                // If there's no history, show a message
                if (!updatedTicket.statusHistory || updatedTicket.statusHistory.length === 0) {
                    historyElement.innerHTML = `
                        <h4>Status History</h4>
                        <p class="empty-history">No status history is available for this ticket.</p>
                    `;
                    return;
                }
                
                // Update the history content
                historyElement.innerHTML = `
                    <h4>Status History</h4>
                    ${renderStatusHistory(updatedTicket.statusHistory)}
                `;
                
                // Scroll to the history section
                historyElement.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }).catch(error => {
                // Handle error
                historyElement.innerHTML = `
                    <h4>Status History</h4>
                    <p class="error-message">Error loading status history: ${error.message}</p>
                `;
                toggleButton.textContent = `Show Status History`;
            });
    } else {
        historyElement.style.display = 'none';
        const ticket = tickets.find(t => t._id === ticketId);
        const historyCount = ticket.statusHistory?.length || 0;
        toggleButton.textContent = `Show Status History (${historyCount})`;
    }
}

// Modal handlers
async function openEditModal(id) {
    try {
        // Fetch the latest ticket data to ensure we have current status and history
        const response = await fetch(`${TICKET_API_URL}/${id}`);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const ticket = await response.json();
        
        // Update the tickets array with this latest data
        tickets = tickets.map(t => t._id === id ? ticket : t);
        
        populateEditForm(ticket);
        modal.style.display = 'block';
    } catch (error) {
        console.error('Error fetching ticket for edit:', error.message);
        showError('Failed to load ticket data. Please try again later.');
    }
}

function closeModalHandler() {
    modal.style.display = 'none';
    editForm.reset();
}

// Helper functions
function showError(message) {
    alert(`Error: ${message}`);
}

function showSuccess(message) {
    alert(message);
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

// Event Listeners
ticketForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const formData = new FormData(ticketForm);
    const data = Object.fromEntries(formData);
    
    // Get user ID from input or use default
    const userId = document.getElementById('userId').value;
    if (userId) {
        try {
            // Validate user with user-service
            const userResponse = await fetch(`${USER_API_URL}/${userId}`);
            if (!userResponse.ok) {
                showError('Invalid user ID. Please provide a valid user ID.');
                return;
            }
            const userData = await userResponse.json();
            data.createdBy = userData.name || userId;
        } catch (error) {
            console.error('Error validating user:', error);
            showError('Failed to validate user. Creating ticket with default user.');
            data.createdBy = userId || 'Anonymous';
        }
    } else {
        data.createdBy = 'Anonymous';
    }
    
    createTicket(data);
});

editForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const id = document.getElementById('editId').value;
    const formData = new FormData(editForm);
    const data = Object.fromEntries(formData);
    
    // Check if status has changed and reason is required
    const statusSelect = document.getElementById('editStatus');
    const originalStatus = statusSelect.getAttribute('data-original');
    const newStatus = statusSelect.value;
    const reasonField = document.getElementById('editStatusReason');
    
    if (originalStatus !== newStatus && (!data.reason || data.reason.trim() === '')) {
        // Status changed but no reason provided
        reasonField.style.borderColor = '#dc3545';
        showError('Please provide a reason for the status change');
        return;
    }
    
    // All validations pass, proceed with update
    updateTicket(id, data);
});

userForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const formData = new FormData(userForm);
    const data = Object.fromEntries(formData);
    
    // Remove id if it's empty
    if (!data.id) {
        delete data.id;
    }
    
    await createUser(data);
});

closeModal.addEventListener('click', closeModalHandler);

statusFilter.addEventListener('change', renderTickets);
priorityFilter.addEventListener('change', renderTickets);

// Make edit handler globally available (for onclick in HTML)
window.editTicketHandler = openEditModal;
window.deleteTicket = deleteTicket;
window.toggleStatusHistory = toggleStatusHistory;

// Function to refresh a ticket's data
async function refreshTicket(ticketId, shouldRender = true) {
    try {
        const response = await fetch(`${TICKET_API_URL}/${ticketId}`);
        
        if (!response.ok) {
            throw new Error(`Failed to fetch ticket: ${response.status}`);
        }
        
        const updatedTicket = await response.json();
        
        // Update the ticket in our local collection
        tickets = tickets.map(t => t._id === ticketId ? updatedTicket : t);
        
        // Re-render the tickets to show updated data (optional)
        if (shouldRender) {
            renderTickets();
        }
        
        return updatedTicket;
    } catch (error) {
        console.error(`Error refreshing ticket: ${error.message}`);
        throw error; // Re-throw to be caught by caller
    }
}

// Add function to global scope for use in HTML
window.refreshTicket = refreshTicket;

// Initial load
document.addEventListener('DOMContentLoaded', () => {
    // Load initial tab content
    const activeTab = document.querySelector('.nav-tab.active');
    if (activeTab) {
        const tabId = `${activeTab.dataset.tab}-tab`;
        if (tabId === 'users-tab') {
            fetchUsers();
        } else if (tabId === 'tickets-tab') {
            fetchTickets();
        } else if (tabId === 'files-tab') {
            listFiles();
        }
    }

    // Add file upload form listener
    const fileUploadForm = document.getElementById('fileUploadForm');
    if (fileUploadForm) {
        fileUploadForm.addEventListener('submit', uploadFile);
    }
});

// Add these functions for file management
async function listFiles() {
    try {
        const response = await fetch(`${DOWNLOADER_API_URL}/list`);
        if (!response.ok) {
            throw new Error('Failed to fetch files');
        }
        const files = await response.json();
        renderFiles(files);
    } catch (error) {
        console.error('Error listing files:', error);
        showError('Failed to load files list');
    }
}

function renderFiles(files) {
    const filesContainer = document.getElementById('filesList');
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
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

async function uploadFile(event) {
    event.preventDefault();
    const formData = new FormData(event.target);
    const fileInput = document.getElementById('fileInput');
    
    if (!fileInput.files.length) {
        showError('Please select a file to upload');
        return;
    }

    try {
        const response = await fetch(`${DOWNLOADER_API_URL}/upload`, {
            method: 'POST',
            body: formData
        });

        if (!response.ok) {
            throw new Error('Failed to upload file');
        }

        const result = await response.json();
        showSuccess('File uploaded successfully');
        fileInput.value = '';
        listFiles(); // Refresh the files list
    } catch (error) {
        console.error('Error uploading file:', error);
        showError('Failed to upload file');
    }
}

async function downloadFile(key) {
    try {
        const response = await fetch(`${DOWNLOADER_API_URL}/download/${key}`);
        if (!response.ok) {
            throw new Error('Failed to download file');
        }

        // Create a blob from the response
        const blob = await response.blob();
        
        // Create a temporary link to trigger the download
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = key;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
    } catch (error) {
        console.error('Error downloading file:', error);
        showError('Failed to download file');
    }
}

async function deleteFile(key) {
    if (!confirm('Are you sure you want to delete this file?')) {
        return;
    }

    try {
        const response = await fetch(`${DOWNLOADER_API_URL}/${key}`, {
            method: 'DELETE'
        });

        if (!response.ok) {
            throw new Error('Failed to delete file');
        }

        showSuccess('File deleted successfully');
        listFiles(); // Refresh the files list
    } catch (error) {
        console.error('Error deleting file:', error);
        showError('Failed to delete file');
    }
} 