# Use Node.js LTS version
FROM node:18-alpine

# Create app directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install --omit=dev

# Bundle app source
COPY . .

# Create volume mount point for static files
VOLUME /app/public

# Expose API port
EXPOSE 3002

# Start command
CMD ["node", "app.js"] 

FROM nginx:alpine
   
# Copy your configuration
COPY nginx.conf /etc/nginx/templates/default.conf.template

# Copy your static files
COPY ./public /usr/share/nginx/html

# Set default environment variables
ENV USER_SERVICE_URL=http://user-service:3003
ENV STATUS_SERVICE_URL=http://status-service:4001
ENV DOWNLOADER_SERVICE_URL=http://downloader-service:3004