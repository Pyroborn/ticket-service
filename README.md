# Ticket Service Microservice

A modern, responsive ticket management system built with Node.js, Express, and MongoDB. This microservice provides a complete CRUD interface for managing tickets with a clean and intuitive web interface.

## Features

- Create, read, update, and delete tickets
- Filter tickets by status and priority
- Responsive design that works on both desktop and mobile
- Real-time UI updates
- Status tracking (open, in-progress, resolved, closed)
- Priority levels (low, medium, high, urgent)
- Assignment capability
- Modern, clean interface

## Tech Stack

- **Backend**: Node.js with Express
- **Database**: MongoDB
- **Frontend**: Vanilla JavaScript, HTML5, CSS3
- **Container**: Docker support

## Prerequisites

- Node.js (v14 or higher)
- MongoDB
- Docker (optional)

## Installation

### Local Development

1. Clone the repository:
   ```bash
   git clone <repository-url>
   cd ticket-service
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Create a `.env` file in the root directory:
   ```
   PORT=4000
   MONGODB_URI=mongodb://localhost:27017/ticket-service
   ```

4. Start MongoDB service (if not already running)

5. Start the application:
   ```bash
   npm start
   ```

### Docker Deployment

1. Build the Docker image:
   ```bash
   docker build -t ticket-service .
   ```

2. Run the container:
   ```bash
   docker run -p 4000:4000 -e MONGODB_URI=<your-mongodb-uri> ticket-service
   ```

## API Endpoints

### Tickets

- `GET /api/tickets` - Get all tickets
- `POST /api/tickets` - Create a new ticket
- `GET /api/tickets/:id` - Get a specific ticket
- `PUT /api/tickets/:id` - Update a ticket
- `DELETE /api/tickets/:id` - Delete a ticket

### Health Check

- `GET /health` - Service health check

## Ticket Schema

```javascript
{
  title: String,        // required
  description: String,  // required
  status: String,      // enum: ['open', 'in-progress', 'resolved', 'closed']
  priority: String,    // enum: ['low', 'medium', 'high', 'urgent']
  assignedTo: String,  // optional
  createdBy: String,   // required
  timestamps: true     // includes createdAt and updatedAt
}
```

## Future Enhancements

- Integration with notification service (Kafka/RabbitMQ)
- Monitoring service integration
- Status service integration
- User authentication and authorization
- Ticket comments and history
- File attachments
- Email notifications

## Development

To contribute to this project:

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details 