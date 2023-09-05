# Crisp Import Conversations

Import all your conversations from your previous provider to Crisp. Wrapper around the [Crisp Node API](https://github.com/crisp-im/node-crisp-api)

Copyright 2021 Crisp IM SAS. See LICENSE for copying information.

* **📝 Implements**: [node-crisp-api](https://github.com/crisp-im/node-crisp-api) at revision: 6.3.2
* **😘 Maintainers**: [@baptistejamin](https://github.com/baptistejamin), [@eliottvincent](https://github.com/eliottvincent)

## Quickstart

1. Create an account on https://marketplace.crisp.chat/
2. Create your first plugin
3. Ask a production token with the following scopes:
  * `website:conversation:initiate` (write)
  * `website:conversation:sessions` (write)
  * `website:conversation:messages` (write)
  * `website:conversation:states` (write)
  * `website:conversation:participants` (write)
5. Request a higher production quota, following this formula: $(n \times 5)+(n \times m)$ (`n` being the number of conversations, `m` being the average number of message per conversation)
6. Activate your plugin as `private`

**Note: You can temporarily use a development token for testing, however, you will be rate-limited at some point.**

## Usage

* `git clone https://github.com/crisp-im/crisp-import-conversations.git`
* `cd crisp-import-conversations`
* `npm install`
* Open `config.json` and update the following:
  * Update `WEBSITE_ID` (https://help.crisp.chat/en/article/how-to-find-the-website-id-1ylqx1s/)
  * Update `WEBSITE_PLAN` (see [Plans Limits](#plans-limits))
  * Update `PLUGIN_URN`, `PLUGIN_NAME` (optional)
  * Update `PLUGIN_TOKEN_IDENTIFIER` and `PLUGIN_TOKEN_key` using your production tokens
* Edit the json file in `res/conversations.json` with your own data
* Run `node index.js`

⚠️ __Before starting the import, you should contact [our support](https://crisp.chat), as we will need to temporarily block outgoing emails for your Crisp website (in order to avoid unwanted emails being sent during the import).__

## API

### Create a new import context

`CrispImport(config, options)` creates a new import context:
* `config` must be an object representing the configuration of the import
* `options` must be an object representing the options to use during the import

```js
var CrispImport = require("../lib/import");

var Import = new CrispImport(
  {
    websiteId: "WEBSITE_ID",
    urn: "PLUGIN_URN",
    name: "PLUGIN_NAME",
    identifier: "PLUGIN_TOKEN_IDENTIFIER",
    key: "PLUGIN_TOKEN_KEY"
  },

  {
    adapter: "zendesk"
  }
);
```

### Import conversations from file

`importFromFile(conversations_path, messages_path)` imports conversations from a JSON / CSV / XML file:
* `conversations_path`: a string representing the path to the conversations file
* `messages_path` (optional): a string representing the path to the messages file (in case conversations and messages are in two different files, e.g. for Gorgias)

```js
Import.importFromFile("./res/conversations.json")
  .then((result) => {
    console.log(`Import is done. ${result.count} conversations imported.`)
    // Import is done. 2 conversations imported.
  })
  .catch((error) => {
    console.log("Import failed.");
    console.log(error);
  });
```

### Import a single conversation

`importConversation(conversation)` imports a single conversation:
* `conversation` must be an object representing the conversation itself

```js
let conversation = {
  user : {
    name : "John Doe",
    email: "john.doe@gmail.com",
    country: "US"
  },
  messages : [{
    text: "Message 1",
    date: Date.parse('01 Jan 2020 00:00:00 GMT'),
    from: "user"
  }, {
    note: "Private note X",
    date: Date.parse('01 Jan 2020 02:00:00 GMT'),
    from: "operator"
  }, {
    text: "Reply from user",
    date: Date.parse('01 Jan 2020 03:00:00 GMT'),
    from: "user"
  }]
};

Import.importConversation(conversation)
  .then(() => {
    console.log(`Import is done. Conversation imported.`)
    // Import is done. Conversation imported.
  });
```

## Adapters

Adapters allow you to convert conversations from the format of your current provider to the format Crisp expects. It will run before the actual import.

The adapter to use (if any) must be specified via the `CrispImport` constructor:

```js
var Import = new CrispImport(
  {
    ...
  },

  {
    adapter: "zendesk"
  }
);
```
Supported adapters are: `gorgias`, `groovehq`, `helpscout`, `whmcs`, `zendesk`.

To write a new adapter, simply create a new file `/adapters` and take inspiration from the existing adapters.

⚠️ Provided adapters may break anytime! We're open to PRs.

## Plans Limits

You can use this import script with any of Crisp plans: **Basic**, **Pro** or **Unlimited**.

Some limits are however to consider:
* **Basic**: no message of type `note`, max. 1 extra participant
* **Pro**: max. 3 extra participants
* **Unlimited**: max. 10 extra participants

It is recommended that you specify the `WEBSITE_PLAN` configuration variable with either `basic`, `pro` or `unlimited` as a value.
This way, the script will not proceed to useless API requests (e.g. creating more participants than allowed, or sending a `note` message while being on Basic plan).
