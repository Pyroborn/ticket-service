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
                        set -e

                        export DOCKER_CONFIG=/tmp/docker-config
                        mkdir -p "$DOCKER_CONFIG"

                        # Disable credential storage entirely by setting credsStore to an empty string
                        echo '{ "credsStore": "" }' > "$DOCKER_CONFIG/config.json"

                        # Ensure that Docker doesn't try to save credentials, avoid issues related to graphical environment (D-Bus)
                        echo "$DOCKER_PASS" | docker login docker.io -u "$DOCKER_USER" --password-stdin --no-include-email

                        docker push ${DOCKER_REGISTRY}/ticket-service:latest

                        # Clean up
                        rm -rf "$DOCKER_CONFIG"
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