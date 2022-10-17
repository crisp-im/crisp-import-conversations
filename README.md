# Crisp Import Conversations

Import all your conversations from your previous provider to Crisp. Wrapper around the [Crisp Node API](https://github.com/crisp-im/node-crisp-api)

Copyright 2021 Crisp IM SARL. See LICENSE for copying information.

* **📝 Implements**: [node-crisp-api](https://github.com/crisp-im/node-crisp-api) at revision: 6.3.2
* **😘 Maintainers**: [@baptistejamin](https://github.com/baptistejamin), [@eliottvincent](https://github.com/eliottvincent)

## Quickstart

1. Create an account on https://marketplace.crisp.chat/
2. Create your first plugin
3. Add the following scopes:
  * `website:conversation:initiate` (write)
  * `website:conversation:session` (write)
  * `website:conversation:messages` (write)
  * `website:conversation:states` (write)

4. Request your production token
5. Publish your plugin as `private`

**Note: You can temporarily use a development token for testing, however, you will be rate-limited at some point.**

## Usage

* `git clone https://github.com/crisp-im/crisp-import-conversations.git`
* `cd crisp-import-conversations`
* Open `config.json` and update the following:
  * Update `WEBSITE_ID` (https://help.crisp.chat/en/article/how-to-find-the-website-id-1ylqx1s/)
  * Update `PLUGIN_URN`, `PLUGIN_NAME` (optional)
  * Update `PLUGIN_TOKEN_IDENTIFIER` and `PLUGIN_TOKEN_key` using your production tokens
* Edit the json file in `res/conversations.json`
* Run `node index.js`

## API

### Import conversations from file

`importFromFile(path)` imports conversations from a JSON file:
* `path` must be a string representing the path to the JSON file

```js
Import.importFromFile("./res/conversations.json").then((result) => {
  console.log(`Import is done. ${result.count} conversations imported.`)
  // Import is done. 2 conversations imported.
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

Import.importConversation(conversation).then(() => {
  console.log(`Import is done. Conversation imported.`)
  // Import is done. Conversation imported.
});
```
