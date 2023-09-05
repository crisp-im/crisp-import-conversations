var Crisp       = require("crisp-api");
var fs          = require("fs");
var Writable    = require("stream").Writable;
var StreamArray = require("stream-json/streamers/StreamArray");

var { runSerial, temporize } = require("./helpers/utilities");
var { csvToJson }            = require("./helpers/csv");
var { xmlToJson }            = require("./helpers/xml");

var MESSAGE_CONTENT_MAX  = 2000; // 2000 characters
var INLINED_IMAGE_MAX    = 100000; // 100000 characters
var BACK_PRESSURE        = 500; // 500 milliseconds

var INLINED_IMAGE_REGEX  = /src="(data:image\/[^;]+;base64[^"]+)"/gm;

var RESUME_SKIPPED_ERROR = "RESUME_SKIPPED_ERROR";

var PLAN_LIMITS          = {
  basic     : {
    name         : "basic",
    participants : 1,
    note         : false
  },
  pro       : {
    name         : "pro",
    participants : 3,
    note         : true
  },
  unlimited : {
    name         : "unlimited",
    participants : 10,
    note         : true
  }
};

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

    this.adapter = null;
    this.status  = null;

    // Acquire plan limits
    this.planLimits = PLAN_LIMITS[
      (this.config.websitePlan || "unlimited").toLowerCase()
    ];

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
   * @param  {string} conversations_path
   * @param  {string} [messages_path]
   * @return {object} Promise object
   */
  importFromFile(conversations_path, messages_path = "") {
    // Convert CSV file first
    if (conversations_path.endsWith(".csv")) {
      return Promise.resolve()
        .then(() => {
          // Convert to JSON and merge messages with conversations (if needed)
          return csvToJson(
            conversations_path,
            messages_path,

            this.options
          );
        })
        .then(() => {
          return this.importFromFile(
            conversations_path.replace(".csv", ".json")
          );
        });
    }

    // Convert XML file first
    if (conversations_path.endsWith(".xml")) {
      return Promise.resolve()
        .then(() => {
          // Convert to JSON and merge messages with conversations (if needed)
          return xmlToJson(
            conversations_path,
            messages_path,

            this.options
          );
        })
        .then(() => {
          return this.importFromFile(
            conversations_path.replace(".xml", ".json")
          );
        });
    }

    let _processed = 0;

    this.__readStatusFile();

    let _importStream = new Writable({
      write: (data, _, callback) => {
        this.importConversation(data.value)
          .then(() => {
            setTimeout(() => {
              _processed++;

              console.log(`✅ ${_processed} conversations processed.`)

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
      let _pipeline = fs.createReadStream(conversations_path)
        .on("error", error => {
          return reject(new Error("Couldn't open your file, is the path valid?"));
        })
        .pipe(StreamArray.withParser())
        .on("error", (error) => {
          return reject(new Error(
            "Couldn't parse your file, is the format valid?\n" +
            `The format must be:
            [
              // Conversation 1
              {
                ...
              },


              // Conversation 2
              {
                ...
              },


              // More conversations
              ...
            ]`
          ));
        })
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

        console.log(`\nℹ️  Importing conversation: ${_conversation.id}`);

        if (this.options.resume === true && this.status[_conversation.id] === true) {
          // Conversation already imported, skip it
          return Promise.reject(RESUME_SKIPPED_ERROR);
        }

        if ((_conversation.messages || []).length === 0) {
          console.warn("⚠️  No messages to import");

          // Abort here
          return Promise.reject();
        }

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
          _meta.nickname = _conversation.user.name || this.config.defaultNickname;
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
          // Make sure to only submit valid segments
          _meta.segments = _conversation.segments.filter((segment) => {
            return segment;
          });
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
        )
          .catch((error) => {
            console.warn(
              `⚠️  Couldn't update conversation metas because:\n`, error
            );
            console.warn(`⚠️  Metas:\n`, meta_params);

            // Abort here
            return Promise.reject();
          });
      })
      .then(() => {
        if ((conversation.participants || []).length > 0) {
          let _participants = conversation.participants.map((participant) => {
            return {
              type   : "email",
              target : participant
            }
          });

          let _limit = this.planLimits.participants,
            _skipped = _participants.length - _limit;

          // Skip some participants?
          if (_limit && _skipped > 0) {
            console.warn(
              `⚠️  Skipping ${_skipped} participant${(_skipped > 1 ? "s" : "")} because plan is ${this.planLimits.name}`
            );

            _participants = _participants.slice(0, _limit);
          }

          if (_participants.length) {
            return this.client.website.saveConversationParticipants(
              this.config.websiteId,
              _sessionId,

              {
                participants : _participants
              }
            )
              .catch((error) => {
                console.warn(
                  `⚠️  Couldn't create ${_participants.length} participants because:\n`, error
                );

                // Ignore
                return Promise.resolve();
              });
          }
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

        (_conversation.messages || []).forEach((message) => {
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
        // Mark all messages sent by user as read by operator
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
        // Mark all messages sent by operator as read by user
        return this.client.website.markMessagesReadInConversation(
          this.config.websiteId,
          _sessionId,

          {
            from   : "operator",
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
      .then(() => {
        // Mark as imported
        this.status[_conversation.id] = true;

        this.__writeStatusFile();
      })
      .catch((error) => {
        if (error === RESUME_SKIPPED_ERROR) {
          // Conversation skipped (resume mode), ignore
          console.warn(
            "⚠️  Conversation already imported, skipping it"
          );

          return Promise.resolve();
        }

        // Mark as not imported
        this.status[_conversation.id] = false;

        this.__writeStatusFile();

        console.error(
          `⚠️  Error creating conversation${error ? ": " : ""}`, error ? error : ""
        );

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
    let _message_params;

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

        if (message.file) {
          _type = "file";
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

        let _content;

        if (_type === "text" || _type === "note") {
          _content = (
            (message.text || message.note).substring(0, MESSAGE_CONTENT_MAX)
          );
        }

        if (_type === "file") {
          _content = message.file;
        }

        let _message = {
          type      : _type,
          content   : _content,

          from      : _from,
          origin    : _origin,
          user      : {
            nickname : user.name || this.config.defaultNickname,
            avatar   : user.avatar
          },

          stealth   : _stealth,
          timestamp : _timestamp
        };

        if (message.original && message.original.content) {
          // Remove large inlined images, that could overflow the maximum \
          //   allowed size of the request body
          message.original.content = message.original.content
            .replace(INLINED_IMAGE_REGEX, (match) => {
              if (match.length > INLINED_IMAGE_MAX) {
                return "";
              }

              return match;
            });

          _message.original = message.original;
        }

        if (message.fingerprint) {
          _message.fingerprint = message.fingerprint;
        }

        return Promise.resolve(_message);
      })
      .then((message_params) => {
        _message_params = message_params;

        // Skip note message?
        if (_message_params.type === "note" && this.planLimits.note === false) {
          console.warn(
            `⚠️  Skipping note message because plan is ${this.planLimits.name}`
          );

          return Promise.resolve();
        }

        return this.client.website.sendMessageInConversation(
          this.config.websiteId, message.session_id,

          _message_params
        );
      })
      .catch((error) => {
        console.error(
          `⚠️  Couldn't send ${(_message_params || {}).type} message because:\n`, error
        );

        return Promise.reject();
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
        if (this.adapter === null) {
          return fs.promises.stat(`./lib/adapters/${this.options.adapter}.js`);
        }

        // Adapter already loaded
        return Promise.resolve();
      })
      .catch(() => {
        // Adapter file doesn't exist
        return Promise.reject();
      })
      .then(() => {
        if (this.adapter === null) {
          return require(`./adapters/${this.options.adapter}.js`);
        }

        // Adapter already loaded
        return Promise.resolve();
      })
      .then((adapter) => {
        // Store adapter
        if (adapter && this.adapter === null) {
          this.adapter = adapter;
        }

        if (typeof this.adapter.adapt_conversation === "function") {
          return this.adapter.adapt_conversation(conversation);
        }

        // Adapter is not valid
        return Promise.reject();
      })
      .catch((error) => {
        if (!error) {
          console.error(
            "⚠️  Error applying the adapter: " +
              `Please make sure the '${this.options.adapter}' adapter exists and ` +
              "provides a valid `adapt_conversation()` method"
          );

          process.exit(1);
        }

        return Promise.reject(error);
      });
  }

  /**
   * Reads status file
   * @private
   * @return {undefined}
   */
  __readStatusFile() {
    let _status_path = "./res/status.json";

    try {
      fs.statSync(_status_path);
    } catch {
      fs.writeFileSync(_status_path, "{}");
    }

    let _status = fs.readFileSync(_status_path);

    _status = _status.toString("utf-8");
    _status = JSON.parse(_status);

    this.status = _status;
  }

  /**
   * Writes status file
   * @private
   * @return {undefined}
   */
  __writeStatusFile() {
    let _status_path = "./res/status.json";

    fs.writeFileSync(
      _status_path,

      JSON.stringify(this.status, null, 2)
    );
  }
}

module.exports = Import;
