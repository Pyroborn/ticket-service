const Ticket = require('../models/ticket');
const services = require('../services/serviceContainer');

// Create a new ticket
exports.createTicket = async (req, res) => {
    try {
        // Use authenticated user information from JWT token
        const { userId, name, email } = req.user;
        
        // Set the creator information
        const ticketData = {
            ...req.body,
            // If userId is provided in request body, use it; otherwise use from JWT
            userId: req.body.userId || userId,
            // Add createdBy if not provided
            createdBy: req.body.createdBy || name || email
        };
        
        const ticket = new Ticket(ticketData);
        const savedTicket = await ticket.save();

        try {
            // Create initial status for the ticket
            await services.statusService.updateStatus(
                savedTicket._id.toString(),
                'open',
                ticketData.createdBy,
                'Ticket created'
            );
            
            console.log(`Created status for ticket ${savedTicket._id}`);
        } catch (error) {
            console.error('Error updating ticket status:', error);
            // Continue even if status creation fails
        }

        // Publish ticket created event
        await services.messageQueue.publishTicketCreated(savedTicket);
        
        // If ticket has an assignee, publish assigned event
        if (savedTicket.assignedTo) {
            try {
                await services.messageQueue.publishTicketAssigned(
                    savedTicket,
                    ticketData.createdBy,
                    null // No previous assignee
                );
            } catch (error) {
                console.error('Error publishing assignment event:', error);
                // Continue even if event publishing fails
            }
        }
        
        res.status(201).json(savedTicket);
    } catch (error) {
        console.error('Error creating ticket:', error);
        res.status(400).json({ 
            message: error.message,
            details: error.errors ? Object.values(error.errors).map(err => err.message) : []
        });
    }
};

// Get all tickets
exports.getAllTickets = async (req, res) => {
    try {
        const tickets = await Ticket.find();
        
        const enhancedTickets = await Promise.all(tickets.map(async (ticket) => {
            try {
                const status = await services.statusService.getStatus(ticket._id.toString());
                return {
                    ...ticket.toObject(),
                    currentStatus: status.status
                };
            } catch (error) {
                return ticket;
            }
        }));

        res.status(200).json(enhancedTickets);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// Get a single ticket by ID
exports.getTicketById = async (req, res) => {
    try {
        const ticket = await Ticket.findById(req.params.id);
        if (!ticket) {
            return res.status(404).json({ message: 'Ticket not found' });
        }

        const ticketId = ticket._id.toString();
        try {
            const status = await services.statusService.getStatus(ticketId);
            const statusHistory = await services.statusService.getStatusHistory(ticketId);
            
            const enhancedTicket = {
                ...ticket.toObject(),
                currentStatus: status?.currentStatus || 'unknown',
                statusHistory: statusHistory || []
            };
            
            return res.status(200).json(enhancedTicket);
        } catch (error) {
            res.status(200).json({
                ...ticket.toObject(),
                currentStatus: 'unknown',
                statusHistory: []
            });
        }
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// Update a ticket
exports.updateTicket = async (req, res) => {
    try {
        const { name, email } = req.user;
        req.body.updatedBy = name || email;
        
        const ticket = await Ticket.findById(req.params.id);
        if (!ticket) {
            return res.status(404).json({ message: 'Ticket not found' });
        }
        
        const previousStatus = ticket.status;
        const previousAssignee = ticket.assignedTo;
        const newStatus = req.body.status;
        const newAssignee = req.body.assignedTo;

        // If status is being updated, validate the transition
        if (newStatus && newStatus !== previousStatus) {
            try {
                const isValidTransition = await services.statusService.validateStatusTransition(
                    ticket._id.toString(),
                    newStatus
                );

                if (!isValidTransition) {
                    return res.status(400).json({ 
                        message: `Invalid status transition from ${previousStatus} to ${newStatus}`,
                        code: 'INVALID_STATUS_TRANSITION'
                    });
                }

                // Update status in the status service
                await services.statusService.updateStatus(
                    ticket._id.toString(),
                    newStatus,
                    req.body.updatedBy,
                    req.body.reason || `Status changed from ${previousStatus} to ${newStatus}`
                );
                
                // Publish status change event
                await services.messageQueue.publishTicketStatusChanged(
                    ticket._id.toString(),
                    previousStatus,
                    newStatus,
                    req.body.updatedBy,
                    req.body.reason || `Status changed from ${previousStatus} to ${newStatus}`
                );
                
                // If status is resolved, publish resolved event
                if (newStatus === 'resolved') {
                    await services.messageQueue.publishTicketResolved(
                        ticket,
                        req.body.updatedBy,
                        req.body.reason || 'Ticket resolved'
                    );
                }
            } catch (error) {
                console.error('Error validating/updating status:', error);
                return res.status(400).json({ 
                    message: error.message,
                    code: 'STATUS_UPDATE_ERROR'
                });
            }
        }
        
        // If assignee is being updated, publish assigned event
        if (newAssignee && newAssignee !== previousAssignee) {
            try {
                await services.messageQueue.publishTicketAssigned(
                    ticket,
                    req.body.updatedBy,
                    previousAssignee
                );
            } catch (error) {
                console.error('Error publishing assignment event:', error);
                // Continue with update even if event publishing fails
            }
        }

        // Update ticket fields
        Object.assign(ticket, req.body);
        await ticket.save();

        // Get the latest status information
        let statusInfo = { currentStatus: ticket.status, history: [] };
        try {
            const status = await services.statusService.getStatus(ticket._id.toString());
            const statusHistory = await services.statusService.getStatusHistory(ticket._id.toString());
            statusInfo = {
                currentStatus: status?.currentStatus || ticket.status,
                history: statusHistory || []
            };
        } catch (error) {
            console.error('Error fetching status info:', error);
        }

        // Combine ticket data with status info
        const ticketResponse = {
            ...ticket.toObject(),
            currentStatus: statusInfo.currentStatus,
            statusHistory: statusInfo.history
        };

        // Publish ticket updated event
        await services.messageQueue.publishTicketUpdated(
            ticket, 
            previousStatus,
            req.body.reason || 'General update'
        );
        
        res.status(200).json(ticketResponse);
    } catch (error) {
        console.error('Error updating ticket:', error);
        res.status(400).json({ 
            message: error.message,
            code: 'UPDATE_ERROR'
        });
    }
};

// Delete a ticket
exports.deleteTicket = async (req, res) => {
    try {
        const ticket = await Ticket.findById(req.params.id);
        if (!ticket) {
            return res.status(404).json({ message: 'Ticket not found' });
        }

        // Check if user is admin or ticket creator
        if (req.user.role !== 'admin' && ticket.userId !== req.user.userId) {
            return res.status(403).json({ message: 'Not authorized to delete this ticket' });
        }

        // Save ticket ID and details before deletion for event publishing
        const ticketId = ticket._id.toString();
        const deletedBy = req.user.name || req.user.email;
        
        // Delete the ticket
        await Ticket.findByIdAndDelete(req.params.id);
        
        // Publish ticket deleted event
        await services.messageQueue.publishTicketDeleted(ticketId);
        
        // Log the deletion
        console.log(`Ticket ${ticketId} deleted by ${deletedBy}`);
        
        res.status(200).json({ 
            message: 'Ticket deleted successfully',
            ticketId: ticketId
        });
    } catch (error) {
        console.error('Error deleting ticket:', error);
        res.status(500).json({ message: error.message });
    }
}; 