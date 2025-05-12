# Use Node.js LTS version
FROM node:18-alpine

# Create app directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install --production

# Bundle app source
COPY . .

# Create volume mount point for static files
VOLUME /app/public

# Expose API port
EXPOSE 3000

# Start command
CMD ["npm", "start"] 