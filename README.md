# BUSINESS MESSAGES : DIALOGFLOW INTEGRATION

To integrate smart chat-bot features (such as natural language processing) into conversational agents, Google offers Dialogflow: a natural language understanding platform that understands user intent. This sample demonstrates how to the Business Messages platform in combination with Dialogflow to understand and respond to user messages.

The sample supports:

* Sending text, rich cards, and suggestions to consumers
* Routing logic between bot (Dialogflow) and human answers
* Customer satisfaction surveys
* Administration console with live agent prototype
* Quick setup of prerequisites and deployment to App Engine on behalf of the user

This runs on the Google App Engine. See the [Google App Engine](https://cloud.google.com/appengine/docs/nodejs/) standard environment documentation for detailed instructions.

## PREREQUISITES

You must have the following software installed on your development machine:
* [Google Cloud SDK](https://cloud.google.com/sdk) (aka gcloud)
* [Node.js](https://nodejs.org/en/) - version 10 or above
* [Python](https://www.python.org/) - version 3.7.0 or above
* [Pip](https://pip.pypa.io/en/stable/installing/) (Python package manager)

## SETUP

### Register with Business Messages

Open [Google Cloud Console](https://console.cloud.google.com) with your Business Messages Google account and create a new project for your agent. Note the **Project ID** and **Project number** values. Use https://***PROJECT ID***.appspot.com/callback as the webhook URL.

1. [Register your project](https://developers.google.com/business-communications/business-messages/guides/set-up/register) with Business Messages. You may have to wait for a response from Google before continuing.
2. Save the "Partner Key" provided by Google.

### Setup billing

1. Go to the [API Console](https://console.developers.google.com/) to view a list of existing projects.
2. From the projects list, select a project or create a new one.
3. Open the console left navigation menu and select **Billing**.
4. Click **Enable billing** (if billing is already enabled then this option isn't available).
5. If you don't have a billing account, create one.
6. Select your location, fill out the form, and click **Submit and enable billing**.

### Run project setup script

This script handles enabling APIs, saving service accounts, enabling Firebase, and deploying to App Engine.

1. Clone the Github repository:

```bash
$ git clone https://github.com/google-business-communications/bm-nodejs-dialogflow-integration
```

2. Run `gcloud init`, authorize your account, and choose the Google Cloud project created previously.
3. Run `cd biab && pip install -r requirements.txt`.
4. Run `python start.py <partner_key>`, where \<partner_key\> is the token saved earlier during the “Register with Business Messages” step.

### Follow-up configuration

Once the project setup script is finished and the app is deployed, it prints out

    * Administration Console URL
    * Firebase rule URL
Save these URLs for the next step.

If the administration console URL's domain is different from https://***PROJECT ID***.appspot.com/, then please contact Google to update your webhook URL.

### Setup the Dialogflow project

1. Go to the [Dialogflow console](http://dialogflow.cloud.google.com) and create a new agent for your bot to send messages to.
2. Click the settings icon next to the agent name (in the top left). Note the Project ID.
3. On the same page, click the email next to **Service Account** to visit the GCP project.
4. Next to this service account, click the 3-dot menu button and select **Create key**. Select **JSON**, and download the file.

### Setup the agent using the Administration Console

1. Visit the Administration Console URL (printed in the setup script output). In the top right, click **Create Brand** and give it a name. You should see it in the **List of Brands** table.
2. For the brand you just created, click **See Agents**, then click **Create Agent** in the top right and follow the instructions.
3. Submit the agent creation request. The agent appears in the **List of Agents** table.
4. Click the newly created agent. Visit the **Bot Connector** Tab. Copy and paste the exact contents of the file you just downloaded into the **DialogFlow Service Account Key** field.
5. Type the Dialogflow Project ID in the corresponding field.
6. Click save.

### Enable Firebase read/write permissions

Visit the Firebase rules link printed after running the setup script and set your appropriate security rules.

    * For testing, the following rules are suggested (open read/write to all):
```json
{
  "rules":{
    ".read":true,
    ".write":true
  }
}
```

## Design your Dialogflow bot

To start creating behavior for your Dialogflow bot, you must define intents ([learn more](https://cloud.google.com/dialogflow/docs/intents-overview)).

1. Go to the [Dialogflow console](https://dialogflow.cloud.google.com), and select the previously created project in the top left.
2. Click **Intents,** and then select **Create Intent** in the top right.
3. In the **Training Phrases** section, add phrases that should lead to this intent. For example, a “store hours” intent may have such training phrases as:
    * “When are you open?”
    * “What time do you close?”
    * “What are your hours of operation?”
    * “Hours”
4. Filling the **Actions and Parameters** section is optional: to store parameters from the input (for example, “can I order $parameter?”), [follow the instructions here](https://cloud.google.com/dialogflow/docs/intents-actions-parameters).
5. This sample supports text responses, custom payloads (for cards, suggestions, etc.), or both. Filling the **Responses** section:
    * To add a simple “text” or chat response, fill out the text response.
    * Otherwise, click **Add Response** and then click **Custom Payload.** Follow the JSON schema available in the [Business Messages API](https://developers.google.com/business-communications/business-messages/reference/rest/v1/conversations.messages). Samples are available in the `examples/` folder.
    * Leave the `messageId` field, as shown in the example JSON.
    * If the text response is empty and there is a custom payload, click the garbage can icon to delete the empty response (Dialogflow doesn't send messages with an empty text response).
    * `postbackData` is treated the same way as message content in this sample. To handle suggestions, create `postbackData` messages with similar content to what users would send. See an example in `examples/suggestion.json`.
6. Create a “live agent” request:
    a. Create training phrases such as “live agent” and “can I speak to a person?”
    b. Delete the text response.
    c. Create a Custom Payload response, and paste the `examples/live_agent.json` file into the custom payload field.
7. Once you create your intent, click **Save** and test it in the sidebar to the right.

## Running your agent

1. In the Admin Console (link found in output of the setup script) within the new agent you created, visit the **Agent Info** tab.
2. Add the following fields:
    * Agent Name
    * Logo
    * Welcome Message (this will be shown when a user first starts messaging your business)
    * Privacy Policy
    * Conversation Starters (optional -- these will be shown along with the Welcome Message)
3. Click **Submit**.
4. Open the **Agent test URL** on your iOS or Android device and test your agent.
5. If the user requests a live agent, you can visit the **Live Agent Chat** tab to chat with the user.
