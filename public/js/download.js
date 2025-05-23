// Download Service Integration with RabbitMQ Support
(() => {
    // Base API URL from config
    const DOWNLOADER_API_URL = config ? config.services.downloader || 'http://localhost:3004' : 'http://localhost:3004';
    
    // Check upload status interval (in ms)
    const STATUS_CHECK_INTERVAL = 2000;
    
    // File upload status tracking
    const uploadStatus = new Map();
    
    // Initialize the downloader client
    function initDownloaderClient() {
        console.log('Initializing downloader client with endpoint:', DOWNLOADER_API_URL);
        
        // Attach event listeners
        const fileUploadForm = document.getElementById('fileUploadForm');
        if (fileUploadForm) {
            fileUploadForm.addEventListener('submit', handleFileUpload);
        }
        
        // Initialize download buttons for existing files
        initializeDownloadButtons();
    }
    
    // Handle file upload
    async function handleFileUpload(event) {
        event.preventDefault();
        
        try {
            const fileInput = document.getElementById('fileInput');
            if (!fileInput.files.length) {
                showError('Please select a file to upload');
                return;
            }
            
            const file = fileInput.files[0];
            console.log('Uploading file:', file.name);
            
            // Create form data
            const formData = new FormData();
            formData.append('file', file);
            
            // Get authentication headers
            const headers = getAuthHeaders();
            
            // Remove Content-Type so browser can set it with proper boundary
            delete headers['Content-Type'];
            
            // Send upload request
            const response = await fetch(`${DOWNLOADER_API_URL}/api/files/upload`, {
                method: 'POST',
                headers,
                body: formData
            });
            
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Failed to upload file');
            }
            
            const result = await response.json();
            console.log('Upload response:', result);
            
            // Track upload if it's processing
            if (result.status === 'processing') {
                // Show processing indicator
                showSuccess(`File "${result.fileName}" queued for processing`);
                
                // Add to tracking map
                uploadStatus.set(result.fileName, {
                    status: 'processing',
                    timeSubmitted: new Date(),
                    checkCount: 0
                });
                
                // Start polling for status
                setTimeout(() => checkUploadStatus(result.fileName), STATUS_CHECK_INTERVAL);
            } else {
                showSuccess('File uploaded successfully');
                // Refresh file list
                listFiles();
            }
            
            // Reset form
            fileInput.value = '';
        } catch (error) {
            console.error('Error uploading file:', error);
            showError(error.message || 'Failed to upload file');
        }
    }
    
    // Check upload status
    async function checkUploadStatus(fileName) {
        try {
            const status = uploadStatus.get(fileName);
            if (!status) return;
            
            // Increment check count
            status.checkCount++;
            
            // After 10 checks (20 seconds), just refresh file list and stop checking
            if (status.checkCount > 10) {
                console.log(`Giving up on status check for "${fileName}" after ${status.checkCount} attempts`);
                uploadStatus.delete(fileName);
                listFiles();
                return;
            }
            
            // Hard refresh the file list which will show the file if it's been processed
            await listFiles();
            
            // Check if the file appears in the list
            const filesList = document.getElementById('filesList');
            const fileItems = filesList.querySelectorAll('.file-item');
            let found = false;
            
            for (const item of fileItems) {
                // Check if filename contains our upload name
                const fileNameElement = item.querySelector('.file-name');
                if (fileNameElement && fileNameElement.textContent.includes(fileName)) {
                    found = true;
                    break;
                }
            }
            
            if (found) {
                console.log(`File "${fileName}" upload complete`);
                uploadStatus.delete(fileName);
                showSuccess(`File "${fileName}" uploaded successfully`);
            } else {
                console.log(`File "${fileName}" still processing, check #${status.checkCount}`);
                // Continue checking
                setTimeout(() => checkUploadStatus(fileName), STATUS_CHECK_INTERVAL);
            }
        } catch (error) {
            console.error('Error checking upload status:', error);
            // Continue checking despite error
            setTimeout(() => checkUploadStatus(fileName), STATUS_CHECK_INTERVAL);
        }
    }
    
    // Initialize download buttons
    function initializeDownloadButtons() {
        document.addEventListener('click', function(event) {
            // Check if clicked element is a download button
            if (event.target.classList.contains('download-btn')) {
                const key = event.target.closest('.file-item').dataset.key;
                if (key) {
                    downloadFile(key);
                }
            }
            
            // Check if clicked element is a delete button
            if (event.target.classList.contains('delete-btn')) {
                const key = event.target.closest('.file-item').dataset.key;
                if (key) {
                    deleteFile(key);
                }
            }
        });
    }
    
    // Download file
    async function downloadFile(key) {
        try {
            console.log('Downloading file:', key);
            showSuccess(`Starting download for file: ${key}`);
            
            // Create a hidden iframe for download
            const iframe = document.createElement('iframe');
            iframe.style.display = 'none';
            document.body.appendChild(iframe);
            
            // Get auth token
            const token = localStorage.getItem('authToken');
            
            // Set iframe source with auth token in URL
            iframe.src = `${DOWNLOADER_API_URL}/api/files/download/${key}?token=${token}`;
            
            // Clean up iframe after download starts
            setTimeout(() => {
                document.body.removeChild(iframe);
            }, 5000);
        } catch (error) {
            console.error('Error downloading file:', error);
            showError(error.message || 'Failed to download file');
        }
    }
    
    // Delete file
    async function deleteFile(key) {
        try {
            if (!confirm('Are you sure you want to delete this file?')) {
                return;
            }
            
            console.log('Deleting file:', key);
            
            const response = await fetch(`${DOWNLOADER_API_URL}/api/files/${key}`, {
                method: 'DELETE',
                headers: getAuthHeaders()
            });
            
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Failed to delete file');
            }
            
            showSuccess('File deleted successfully');
            listFiles(); // Refresh the files list
        } catch (error) {
            console.error('Error deleting file:', error);
            showError(error.message || 'Failed to delete file');
        }
    }
    
    // List files
    async function listFiles() {
        try {
            console.log('Fetching files list');
            
            const response = await fetch(`${DOWNLOADER_API_URL}/api/files/list`, {
                headers: getAuthHeaders()
            });
            
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Failed to list files');
            }
            
            const files = await response.json();
            console.log('Files fetched:', files.length);
            
            renderFiles(files);
        } catch (error) {
            console.error('Error listing files:', error);
            showError('Failed to load files list');
        }
    }
    
    // Initialize when document is loaded
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initDownloaderClient);
    } else {
        initDownloaderClient();
    }
    
    // Expose functions to global scope
    window.downloadFile = downloadFile;
    window.deleteFile = deleteFile;
    window.listFiles = listFiles;
})(); 