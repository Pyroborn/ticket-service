// Fix for closeModalHandler to properly handle the try-catch block
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

// Fix for submitEditForm to prevent default form submission
function submitEditForm() {
    console.log('[FORM DEBUG] Submit edit form called');
    const form = document.getElementById('editForm');
    if (form) {
        // Create a submit event with cancelable property set to true
        const event = new Event('submit', { bubbles: true, cancelable: true });
        form.dispatchEvent(event);
    } else {
        console.error('[FORM DEBUG] Edit form not found');
    }
}

// Replace original functions with fixed versions
window.closeModalHandler = closeModalHandler;
window.submitEditForm = submitEditForm; 