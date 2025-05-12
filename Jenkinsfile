pipeline {
    agent any

    environment {
                NODE_VERSION = '18'
                DOCKERHUB_CREDENTIALS = credentials('dockerhub-credentials')
                DOCKER_REGISTRY = 'docker.io/pyroborn'
    }

    stages {
        stage('clean workspace & CSM') {
            steps {
                cleanWs()
                checkout scm
            }
        }

        stage('installing dependencies') {
            steps{
                sh 'npm install'
            }
        }

        stage('Testing') {
            steps{
            sh 'npm test'
            }
        }

        stage('Building Image') {
            steps {
                echo "building docker image"
                sh 'docker build -t ${DOCKER_REGISTRY}/ticket-service:latest .'
            }
        }
        
        stage('Push Docker Image') {
            steps {
                echo "pushing image to registry"
                withCredentials([usernamePassword(credentialsId: 'dockerhub-credentials', usernameVariable: 'DOCKER_USER', passwordVariable: 'DOCKER_PASS')]) {
                    sh '''
                        mkdir -p /tmp/docker-login
                        echo "$DOCKER_PASS" | docker login docker.io -u "$DOCKER_USER" --password-stdin --config /tmp/docker-login
                        docker --config /tmp/docker-login push ${DOCKER_REGISTRY}/ticket-service:latest
                        rm -rf /tmp/docker-login
                    '''
                }

                }
                }
    }
    post {
    always {
        cleanWs()
    }
    success {
        echo 'Pipeline completed successfully!'
    }
    failure {
        echo 'Pipeline failed!'
    }
    }
}