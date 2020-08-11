# Copyright 2020 Google LLC
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#      http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

# /usr/bin/env python
# pylint: disable=E1101
"""
Bot-in-a-box: Creates and runs setup for Dialogflow Integration bot
"""

import subprocess
import json
import os
import re
from time import sleep
import firebase_admin
import requests
from googleapiclient import discovery
from google.oauth2.service_account import Credentials
from firebase_admin import credentials
from firebase_admin import db

# APIs to enable:
# businesscommunications.googleapis.com
# businessmessages.googleapis.com
# dialogflow.googleapis.com
# firebase.googleapis.com

FIREBASE_CREDENTIALS_FILE_NAME = 'generated_firebase_credentials.json'
SERVICE_ACCOUNT_NAME = 'firebase-bm-df-bot'


def enable_apis():
    """Enable required APIs for project using gcloud command line"""

    print('Enabling APIs...')
    apis_to_enable = [
        'iam.googleapis.com', 'dialogflow.googleapis.com',
        'firebase.googleapis.com', 'cloudbuild.googleapis.com',
        "businessmessages.googleapis.com",
        "businesscommunications.googleapis.com"
    ]

    for api in apis_to_enable:
        print('\t' + api)
        subprocess.run(['gcloud', 'services', 'enable', api], check=True)


def set_region():
    """Get region for App Engine project to deploy in"""
    proc = subprocess.Popen('gcloud app describe',
                            stdout=subprocess.PIPE,
                            stderr=subprocess.PIPE,
                            shell=True)
    out, err = proc.communicate()

    if err:
        proc = subprocess.Popen('gcloud app regions list',
                                stdout=subprocess.PIPE,
                                stderr=subprocess.PIPE,
                                shell=True)
        out, err = proc.communicate()
        regions = out.decode('utf-8').split('\n')[1:-1]
        regions_list = list(map(lambda x: x.split()[0], regions))
        print('\nRegions:')
        print('\n'.join(regions_list))
        deploy_region = ''
        while deploy_region not in regions_list:
            deploy_region = input(
                'Choose a region for the App Engine project: ')
        subprocess.run(
            ['gcloud', 'app', 'create', f'--region={deploy_region}'],
            check=True)


def get_service_key(project_id):
    """Create new service account and get service key"""
    # create new service account
    print('Creating and saving service account...')
    # create service account key + save
    service_account_email = f'{SERVICE_ACCOUNT_NAME}@{project_id}.iam.gserviceaccount.com'
    try:
        subprocess.run([
            'gcloud', 'iam', 'service-accounts', 'create',
            SERVICE_ACCOUNT_NAME, '--description="Created by bot-in-a-box"',
            '--display-name="Firebase Service Account"'
        ],
                       check=True)
        subprocess.run([
            'gcloud', 'iam', 'service-accounts', 'keys', 'create',
            f'../resources/{FIREBASE_CREDENTIALS_FILE_NAME}', '--iam-account',
            service_account_email
        ],
                       check=True)
    except subprocess.CalledProcessError:
        print(
            'Service account already exists or unable to create service account. Continuing...'
        )
    try:
        # add service account to iam
        subprocess.run([
            'gcloud', 'projects', 'add-iam-policy-binding', project_id,
            f'--member=serviceAccount:{service_account_email}',
            '--role=roles/editor'
        ],
                       check=True)
    except subprocess.CalledProcessError:
        print('Failed to add editor roles to service account. Continuing...')


def get_access_token():
    """Get Firebase access token"""
    cred = firebase_admin.credentials.Certificate(
        f'../resources/{FIREBASE_CREDENTIALS_FILE_NAME}').get_access_token()
    return cred.access_token


def wait_for_operation(operation_name):
    """Wait for operation completion"""
    # load credentials and check operation for completion
    creds = Credentials.from_service_account_file(
        f'../resources/{FIREBASE_CREDENTIALS_FILE_NAME}')

    service = discovery.build('firebase', 'v1beta1', credentials=creds)

    # The name of the operation resource.
    name = operation_name

    request = service.operations().get(name=name)
    # check every second for operation completion
    print('Waiting for Firebase add operation to complete...')
    while True:
        result = request.execute()
        if 'error' in result:
            raise Exception(result['error'])
        if 'done' in result and result['done']:
            print('Add Firebase operation completed.')
            return
        sleep(1)


def initialize_firebase(project_id):
    """Initialize Firebase Realtime Database"""
    print('Initializing Firebase...')

    access_token = get_access_token()
    # call addFirebase endpoint
    uri = f'https://firebase.googleapis.com/v1beta1/projects/{project_id}:addFirebase'
    headers = {'Authorization': 'Bearer ' + access_token}
    req = requests.post(uri, headers=headers)
    request = req.json()
    # print(request)
    if 'error' in request and request['error']['code'] == 409:
        print('Firebase entity already exists')
    elif 'name' in request:
        print('Operation name:', request['name'])
        # wait for addFirebase completion
        wait_for_operation(request['name'])

        # initialize Realtime Database
        creds = credentials.Certificate(
            f'../resources/{FIREBASE_CREDENTIALS_FILE_NAME}')
        firebase_admin.initialize_app(
            creds, {'databaseURL': f'https://{project_id}.firebaseio.com'})
        ref = db.reference('setup/')
        ref.set({'completed': True})


def create_config(project_id, partner_key):
    """Create config.json file"""
    print('Creating configuration file...')
    config = {}
    config['use_firebase_for_credentials'] = True
    config['firebase_service_account'] = FIREBASE_CREDENTIALS_FILE_NAME
    config['verification_token'] = partner_key
    config['firebase_database_url'] = f'https://{project_id}.firebaseio.com'
    with open('../resources/config.json', 'w') as file:
        json.dump(config, file)


def deploy():
    """Deploy to GCloud App Engine + return App Engine URL"""
    print('Deploying. This may take several minutes...')
    # create pipe to deploy GCloud App Engine
    process = subprocess.Popen('gcloud app deploy --quiet',
                               cwd=os.getcwd() + '/../',
                               stdout=subprocess.PIPE,
                               stderr=subprocess.PIPE,
                               shell=True)
    _, err = process.communicate()
    deploy_log = err.decode('utf-8')
    print(deploy_log)
    # match URL with regex
    url_regex = r'Deployed service \[default\] to \[(.+)\]'
    deploy_url = re.search(url_regex, deploy_log)
    return deploy_url[1]


def main():
    """Initialize project, enable APIs and setup Firebase"""
    # prompt for project id + partner key until filled
    project_id = ''
    while not project_id:
        project_id = input(
            'Google Cloud Project ID (not necessarily project name): ')
    partner_key = ''
    while not partner_key:
        partner_key = input('Partner key from Google: ')
    # set active project to specified project id
    print('Setting Active Project ID to:', project_id)
    subprocess.run(['gcloud', 'config', 'set', 'project', project_id],
                   check=True)
    set_region()
    enable_apis()
    get_service_key(project_id)
    initialize_firebase(project_id)
    create_config(project_id, partner_key)
    deployed_url = deploy()
    print('\n\n\n---')
    print(f"""
    Link to Administration console: {deployed_url}/admin.
    Link to Firebase Rules: https://console.firebase.google.com/project/{project_id}/database/{project_id}/rules
    Please follow the instructions in the README of the parent directory.
    """)


if __name__ == "__main__":
    main()
