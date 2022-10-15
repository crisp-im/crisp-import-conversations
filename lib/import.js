var Crisp       = require("crisp-api");
var fs          = require("fs");
var Writable    = require('stream').Writable;
var StreamArray = require("stream-json/streamers/StreamArray");

var runSerial = require("./utils").runSerial;

var BACKPRESSURE = 500; // 500 milliseconds

/**
 * Import
 * @class
 * @param {object} config
 */
class Import {
  /**
   * Constructor
   */
  constructor(config) {
    if (!config.websiteId || !config.urn || !config.identifier || !config.key) {
      throw new Error(
        "Configuration incomplete. Please provide `websiteId`, `urn`, " +
          "`identifier` & `key`."
      );
    }

    this.config = config;

    // Authenticate against API
    this.client = new Crisp();
    this.client.authenticateTier(
      "plugin",

      this.config.identifier,
      this.config.key
    );
  }

  /**
   * Imports conversations from a file
   * @public
   * @param  {string} path
   * @return {object} Promise object
   */
  importFromFile(path) {
    let _imported = 0;

    let _importStream = new Writable({
      write: (data, _, callback) => {
        this.importConversation(data.value)
          .then(() => {
            setTimeout(() => {
              _imported++;

              console.log(`${_imported} conversation imported.`)

              return callback();
            }, BACKPRESSURE);
          })
          .catch(() => {
            return callback(false);
          });
      },

      objectMode: true
    });

    return new Promise((resolve, reject) => {
      let _pipeline = fs.createReadStream(path)
        .pipe(StreamArray.withParser())
        .pipe(_importStream);

      _pipeline.on("end", () => {
        return resolve({
          count: _imported
        })
      });

      _pipeline.on("close", () => {
        return resolve({
          count: _imported
        })
      });
    });
  }

  /**
   * Imports a conversation
   * @public
   * @param  {object} conversation
   * @return {object} Promise object
   */
  importConversation(conversation) {
    let _sessionId, _firstMessage, _lastMessage;

    return this.client.website.createNewConversation(this.config.websiteId)
      .then((result) => {
        _sessionId = result.session_id;

        let _meta = {};

        if ((conversation.user || {}).email) {
          _meta.email = (conversation.user || {}).email;
        }

        if ((conversation.user || {}).name) {
          _meta.nickname = (conversation.user || {}).name;
        }

        return this.client.website.updateConversationMetas(
          this.config.websiteId,
          _sessionId,

          _meta
        );
      })
      .then(() => {
        let _sortedMessages = conversation.messages.sort((a, b) => {
          return a.date > b.date;
        });

        _firstMessage = _sortedMessages[0];
        _lastMessage  = _sortedMessages[_sortedMessages.length - 1];

        return this.__sendMessage({
          message : {
            note       : `Import started at: ${(new Date).toUTCString()}`,
            from       : "operator",
            date       : _firstMessage.date - 60000,
            session_id : _sessionId
          },

          user    : {
            name : this.config.name || "Import"
          }
        });
      })
      .then(() => {
        let _tasks = [];

        conversation.messages.forEach((message) => {
          message.session_id = _sessionId;

          _tasks.push({
            fn: this.__sendMessage.bind(this),
            arg: { message : message, user : conversation.user }
          });
        });

        return runSerial(_tasks);
      })
      .then(() => {
        return this.client.website.markMessagesReadInConversation(
          this.config.websiteId,
          _sessionId,

          {
            from   : "user",
            origin : "chat"
          }
        );
      })
      .then(() => {
        return this.__sendMessage({
          message : {
            note       : `Import ended at: ${(new Date).toUTCString()}`,
            from       : "operator",
            date       : _lastMessage.date + 60000,
            session_id : _sessionId
          },

          user    : {
            name : this.config.name || "Import"
          }
        });
      })
      .then(() => {
        return this.client.website.changeConversationState(
          this.config.websiteId,
          _sessionId,

          "resolved"
        );
      })
      .catch((error) => {
        console.error("Error creating conversation:", error);
      });
  }

  /**
   * Sends a message
   * @private
   * @param  {object} message
   * @param  {object} [user]
   * @return {object} Promise object
   */
  __sendMessage({ message, user = {} }) {
    let _type = "text";
    let _text = message.text || message.note;
    let _from = message.from;
    let _timestamp = Date.now();
    let _stealth = false;

    if (message.date) {
      _timestamp = message.date;
    }

    if (message.note) {
      _type = "note";
    }

    if (_from !== "user" && _from !== "operator") {
      _from = "operator";
    }

    // Important: enable stealth for messages to user, otherwise they'll end \
    //   up in his mailbox.
    if (_from === "operator" && _type !== "note") {
      _stealth = true;
    }

    return this.client.website.sendMessageInConversation(
      this.config.websiteId, message.session_id,

      {
        type      : _type,
        content   : _text.substring(0, 2000),

        from      : _from,
        origin    : this.config.urn,
        user      : {
          nickname : user.name
        },

        stealth   : _stealth,
        timestamp : _timestamp
      }
    )
      .then(() => {
        return Promise.resolve();
      })
      .catch((error) => {
        console.warn("Failed sending message because:", error);

        return Promise.resolve();
      });
  }
}

module.exports = Import;
