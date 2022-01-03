var Crisp = require("crisp-api");
var runSerial = require("./utils").runSerial;
var fs = require("fs");
var Writable = require('stream').Writable;
var StreamArray = require("stream-json/streamers/StreamArray");

var BACKPRESSURE = 500; // 500 ms

class Import {
  constructor(options) {
    this.websiteId = options.websiteId;
    this.client = new Crisp();

    this.client.authenticateTier("plugin", options.identifier, options.key);
  }

  importFromFile(file) {
    let _imported = 0;

    let _importStream = new Writable({
      write: (data, encoding, callback) => {
        this.importConversation(data.value)
          .then(() => {
            setTimeout(() => {
              _imported++;

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
      let _pipeline = fs.createReadStream(file)
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

  sendMessage(message) {
    let _text = message.text || message.note;
    let _from = message.from;
    let _type = "text";
    let _timestamp = Date.now();

    if (message.date) {
      _timestamp = message.date
    }

    if (message.note) {
      _type = "note";
    }

    if (_from != "user" && _from != "operator") {
      _from = "operator";
    }

    return this.client.website.sendMessageInConversation(
      this.websiteId, message.session_id,

      {
        type      : _type,
        content   : _text.substring(0, 2000),
        from      : _from,
        origin    : "urn:crisp.im:import:0",
        stealth   : true,
        timestamp : _timestamp
      }
    )
    .then(() => {
      return Promise.resolve();
    })
    .catch((reason) => {
      console.warn("Failed sending message because", reason);

      return Promise.resolve();
    })
  }

  importConversation(conversationSource) {
    let _sessionId = "";

    return this.client.website.createNewConversation(this.websiteId)
      .then((conversation) => {
        _sessionId = conversation.session_id;

        let update = {};

        if ((conversationSource.user || {}).email) {
          update.email = (conversationSource.user || {}).email;
        }

        if ((conversationSource.user || {}).name) {
          update.nickname = (conversationSource.user || {}).name;
        }

        return this.client.website.updateConversationMetas(
          this.websiteId,
          _sessionId,
          update
        );
      })
      .then(() => {
        let tasks = [];

        conversationSource.messages.forEach((message) => {
          message.session_id = _sessionId;

          tasks.push({
            fn: this.sendMessage.bind(this),
            arg: message
          })
        });

        return runSerial(tasks);
      })
      .then(() => {
        return this.client.website.markMessagesReadInConversation(
          this.websiteId,
          _sessionId,
          {
            from : "user",
            origin : "chat"
          }
        );
      })
      .then(() => {
        return this.client.website.changeConversationState(
          this.websiteId,
          _sessionId,
          "resolved"
        );
      })
      .then(() => {
        return Promise.resolve();
      })
      .catch(function(error) {
        console.error("Error creating conversation:", error);
      });
  }
}

module.exports = Import;