def customImage // Declare globally so all stages can access it

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
            steps {
                sh 'npm install'
            }
        }

        stage('Testing') {
            steps {
                sh 'npm test'
            }
        }

        stage('Building Image') {
            steps {
                script {
                    echo "building docker image"
                    customImage = docker.build("pyroborn/ticket-service:latest")
                }
            }
        }

        stage('Push Docker Image') {
            steps {
                script {
                    withEnv(["DOCKER_CONFIG=${env.WORKSPACE}/.docker"]) {
                        docker.withRegistry('https://index.docker.io/v1/', 'dockerhub-credentials') {
                            customImage.push()
                        }
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