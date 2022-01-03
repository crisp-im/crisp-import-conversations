# Crisp Import Conversations

Import all your conversations from your previous provider to Crisp. Wrapper around the [Crisp Node API](https://github.com/crisp-im/node-crisp-api)

Copyright 2021 Crisp IM SARL. See LICENSE for copying information.

* **📝 Implements**: [node-crisp-api](https://github.com/crisp-im/node-crisp-api) at revision: 5.0.3
* **😘 Maintainers**: [@baptistejamin](https://github.com/baptistejamin)

## Quickstart

1. Create an account on https://marketplace.crisp.chat/
2. Create your first plugin
3. Add the following scopes:
  * `website:conversation:initiate` (write)
  * `website:conversation:session` (write)
  * `website:conversation:messages` (write)
  * `website:conversation:states` (write)

4. Request for production tokens
5. Publish your plugin as `private`

**Note: You can temporary use development tokens for testing, however, you will be rate-limited.**

## Import Conversations

* `git clone https://github.com/crisp-im/crisp-import-conversations.git`
* `cd crisp-import-conversations`
* Open `config.json` and update the following:
  * Update WEBSITE_ID (https://help.crisp.chat/en/article/how-to-find-the-website-id-1ylqx1s/)
  * Update API_KEY and API_IDENTIFIER using your production tokens
* Edit the json file in `res/conversations.json`
* Run `node index.js`