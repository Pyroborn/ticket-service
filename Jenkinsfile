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
                script {
                echo "building docker image"
                 // #sh 'docker build -t ${DOCKER_REGISTRY}/ticket-service:latest .'
                def customImage = docker.build("ticket-service:latest")
                }
            }
        }
        
        stage('Push Docker Image') {
            steps {
                script {
                    docker.withRegistry('https://hub.docker.com/r/pyroborn/micro-service', 'dockerhub-credentials') {
                        customImage.push()
                    }
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