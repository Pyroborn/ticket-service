const Ticket = require('../models/ticket');
const services = require('../services/serviceContainer');
const axios = require('axios');

// User service integration
const USER_SERVICE_URL = process.env.USER_SERVICE_URL || 'http://localhost:3003';

// Helper to validate user existence
const validateUser = async (userId) => {
    try {
        if (!userId) return null;
        const response = await axios.get(`${USER_SERVICE_URL}/users/${userId}`);
        return response.data;
    } catch (error) {
        return null;
    }
};

// Create a new ticket
exports.createTicket = async (req, res) => {
    try {
        const userIdHeader = req.header('X-User-Id');
        let userId = userIdHeader || req.body.createdBy;
        
        if (userId) {
            const user = await validateUser(userId);
            if (user) {
                req.body.createdBy = user.name || userId;
            }
        }
        
        const ticket = new Ticket(req.body);
        const savedTicket = await ticket.save();

        try {
            await services.statusService.updateStatus(
                savedTicket._id.toString(),
                'open',
                savedTicket.createdBy,
                'Ticket created'
            );
        } catch (error) {
            // Continue even if status creation fails
        }

        await services.messageQueue.publishTicketCreated(savedTicket);
        res.status(201).json(savedTicket);
    } catch (error) {
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
        const userIdHeader = req.header('X-User-Id');
        let updatedBy = userIdHeader || req.body.updatedBy;
        
        if (updatedBy) {
            const user = await validateUser(updatedBy);
            if (user) {
                req.body.updatedBy = user.name || updatedBy;
            }
        } else {
            req.body.updatedBy = 'Unknown User';
        }
        
        const ticket = await Ticket.findById(req.params.id);
        if (!ticket) {
            return res.status(404).json({ message: 'Ticket not found' });
        }
        
        const previousStatus = ticket.status;
        const newStatus = req.body.status;

        if (newStatus && newStatus !== previousStatus) {
            const isValidTransition = await services.statusService.validateStatusTransition(
                ticket._id.toString(),
                newStatus
            );

            if (!isValidTransition) {
                return res.status(400).json({ 
                    message: `Invalid status transition from ${previousStatus} to ${newStatus}` 
                });
            }
        }

        // Update ticket
        Object.assign(ticket, req.body);
        await ticket.save();

        // Publish event if status changed
        if (previousStatus !== ticket.status) {
            await services.messageQueue.publishTicketUpdated(ticket, previousStatus);
        }
        
        res.status(200).json(ticket);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

// Delete a ticket
exports.deleteTicket = async (req, res) => {
    try {
        const ticket = await Ticket.findByIdAndDelete(req.params.id);
        if (!ticket) {
            return res.status(404).json({ message: 'Ticket not found' });
        }

        await services.messageQueue.publishTicketDeleted(ticket._id.toString());
        res.status(200).json({ message: 'Ticket deleted successfully' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
}; 