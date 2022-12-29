var Crisp       = require("crisp-api");
var fs          = require("fs");
var Writable    = require("stream").Writable;
var StreamArray = require("stream-json/streamers/StreamArray");

var { runSerial, temporize} = require("./utils");

var BACK_PRESSURE = 500; // 500 milliseconds

/**
 * Import
 * @class
 * @param {object} config
 * @param {object} [options]
 */
class Import {
  /**
   * Constructor
   */
  constructor(config, options = {}) {
    if (!config.websiteId || !config.urn || !config.identifier || !config.key) {
      throw new Error(
        "Configuration incomplete. Please provide `websiteId`, `urn`, " +
          "`identifier` & `key`."
      );
    }

    this.config  = config;
    this.options = options;

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
            }, BACK_PRESSURE);
          })
          .catch(() => {
            return callback(false);
          });
      },

      objectMode : true
    });

    return new Promise((resolve, reject) => {
      let _pipeline = fs.createReadStream(path)
        .pipe(StreamArray.withParser())
        .pipe(_importStream);

      _pipeline.on("end", () => {
        return resolve({
          count : _imported
        })
      });

      _pipeline.on("close", () => {
        return resolve({
          count : _imported
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
    let _conversation, _sessionId,
      _firstMessage, _lastMessage;

    return Promise.resolve()
      .then(() => {
        if (this.options.adapter) {
          return this.__runAdapter(conversation);
        }

        return Promise.resolve(conversation);
      })
      .then((conversation) => {
        _conversation = conversation;

        return this.client.website.createNewConversation(this.config.websiteId);
      })
      .then((result) => {
        _sessionId = result.session_id;

        let _meta = {
          device : {}
        };

        _meta.email = (_conversation.user || {}).email || this.config.defaultEmail;

        if ((_conversation.user || {}).phone) {
          _meta.phone = _conversation.user.phone;
        }

        if ((_conversation.user || {}).name) {
          _meta.nickname = _conversation.user.name;
        }

        if ((_conversation.user || {}).avatar) {
          _meta.avatar = _conversation.user.avatar;
        }

        if (((_conversation.user || {}).locales || []).length > 0) {
          _meta.device.locales = _conversation.user.locales;
        }

        if (((_conversation.user || {}).country || []).length > 0) {
          _meta.device.geolocation = {
            country     : _conversation.user.country,
            coordinates : {
              latitude  : 0,
              longitude : 0
            }
          };
        }

        if (_conversation.subject) {
          _meta.subject = _conversation.subject;
        }

        if ((_conversation.segments || []).length > 0) {
          _meta.segments = _conversation.segments;
        }

        if (Object.keys((_conversation.data || [])).length > 0) {
          _meta.data = _conversation.data;
        }

        if (Object.keys(_meta.device).length === 0) {
          delete _meta.device;
        }

        return Promise.resolve(_meta);
      })
      .then((meta_params) => {
        return this.client.website.updateConversationMetas(
          this.config.websiteId,
          _sessionId,

          meta_params
        );
      })
      .then(() => {
        if ((conversation.participants || []).length > 0) {
          let _participants = conversation.participants.map((participant) => {
            return {
              type: "email",
              target: participant
            }
          });

          return this.client.website.saveConversationParticipants(
            this.config.websiteId,
            _sessionId,

            {
              participants : _participants
            }
          );
        }

        return Promise.resolve();
      })
      .then(() => {
        let _sortedMessages = (_conversation.messages || []).sort((a, b) => {
          return a.date - b.date;
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

        _conversation.messages.forEach((message) => {
          message.session_id = _sessionId;

          _tasks.push({
            fn   : this.__sendMessage.bind(this),
            args : {
              message : message,
              user    : message.user || _conversation.user
            }
          });
        });

        return runSerial(_tasks);
      })
      .then(temporize)
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
      .then(temporize)
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
      .then(temporize)
      .then(() => {
        return this.client.website.changeConversationState(
          this.config.websiteId,
          _sessionId,

          conversation.state || "resolved"
        );
      })
      .catch((error) => {
        console.error("Error creating conversation:", error);

        return Promise.reject(error);
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
    return Promise.resolve()
      .then(() => {
        let _timestamp = Date.now();
        let _type = "text";
        let _from = message.from;
        let _origin = this.config.urn;
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

        if (message.origin) {
          _origin = message.origin;
        }

        // Important: enable stealth for messages to user, otherwise they'll \
        //   end up in his mailbox.
        if (_from === "operator" && _type !== "note") {
          _stealth = true;
        }

        let _message = {
          type      : _type,
          content   : (message.text || message.note).substring(0, 2000),

          from      : _from,
          origin    : _origin,
          user      : {
            nickname : user.name,
            avatar   : user.avatar
          },

          stealth   : _stealth,
          timestamp : _timestamp
        };

        if (message.original) {
          _message.original = message.original;
        }

        if (message.fingerprint) {
          _message.fingerprint = message.fingerprint;
        }

        return Promise.resolve(_message);
      })
      .then((message_params) => {
        return this.client.website.sendMessageInConversation(
          this.config.websiteId, message.session_id,

          message_params
        )
      })
      .catch((error) => {
        console.warn("Failed sending message because:", error);

        return Promise.resolve();
      });
  }

  /**
   * Runs adapter over a conversation
   * @private
   * @param  {object} conversation
   * @return {object} Promise object
   */
  __runAdapter(conversation) {
    return Promise.resolve()
      .then(() => {
        return require(`./adapters/${this.options.adapter}.js`);
      })
      .then((adapter) => {
        if (typeof adapter.adapt === "function") {
          return adapter.adapt(conversation);
        }

        return Promise.reject();
      })
      .catch(() => {
        return Promise.reject(
          `Please make sure the '${this.options.adapter}' adapter exists and ` +
            "provides a valid `adapt()` method"
        );
      })
  }
}

module.exports = Import;
