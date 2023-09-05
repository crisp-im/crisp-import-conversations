var fs        = require("fs");
var { parse } = require("papaparse");

var CSV_TO_JSON_OPTIONS = {
  header: true,
  skipEmptyLines: true
};

/**
 * Cleans a JSON after CSV conversion
 * @private
 * @param  {object} obj
 * @param  {string} property
 * @return {undefined}
 */
var __clean = (obj, property) => {
  if (obj[property].startsWith("{")) {
    try {
      obj[property] = JSON.parse(obj[property]);
    } catch {
      // Ignore
    }
  }
};

/**
 * Traverses an array
 * @private
 * @param  {object} arr
 * @return {undefined}
 */
var __traverse = (arr) => {
  arr.forEach((obj) => {
    for (var property in obj) {
      if (obj.hasOwnProperty(property)) {
        if (typeof obj[property] === "string") {
          __clean(obj, property);
        }
      }
    }
  });
};

/**
 * Runs adapter over conversations (if needed)
 * @private
 * @param  {object} conversations
 * @param  {object} [messages]
 * @param  {object} [options]
 * @return {object} Promise object
 */
var __runAdapter = (conversations, messages = [], options = {}) => {
  return Promise.resolve()
    .then(() => {
      return fs.promises.stat(`./lib/adapters/${options.adapter}.js`);
    })
    .catch(() => {
      // Adapter file doesn't exist
      return Promise.reject();
    })
    .then(() => {
      return require(`./../adapters/${options.adapter}.js`);
    })
    .then((adapter) => {
      if (typeof adapter.adapt_conversations === "function") {
        // Notice: for some providers, it is needed to adapt conversations \
        //   before continuing further (e.g. Gorgias provides a list of \
        //   conversations with no messages, and a list of messages without \
        //   any conversations structure!)
        return adapter.adapt_conversations(conversations, messages);
      }

      // Adapter doesn't provide a valid `adapt_conversations`, ignore \
      //   (probably not needed)
      return Promise.resolve();
    })
    .catch((error) => {
      if (!error) {
        console.error(
          "⚠️  Error applying the adapter: " +
            `Please make sure the '${options.adapter}' adapter exists`
        );
      } else {
        console.error(
          "⚠️  Error applying the adapter: ", error
        );
      }

      process.exit(1);
    });
};

/**
 * Converts a CSV file to a JSON file
 * @private
 * @param  {string} path
 * @return {object} Promise object
 */
var __csvToJson = (path) => {
  let _content;

  return Promise.resolve()
    .then(() => {
      return fs.promises.readFile(path);
    })
    .then((content) => {
      _content = content.toString("utf-8");

      // Parse
      return Promise.resolve(
        parse(_content, CSV_TO_JSON_OPTIONS)
      );
    })
    .then((content) => {
      _content = content;

      // Traverse and clean
      __traverse(_content.data);

      return Promise.resolve();
    })
    .then(() => {
      return Promise.resolve(_content.data);
    });
};

/**
 * Converts a CSV file to a JSON file
 * @public
 * @param  {string} conversations_path
 * @param  {string} [messages_path]
 * @param  {object} [options]
 * @return {object} Promise object
 */
var csvToJson = (conversations_path, messages_path = "", options = {}) => {
  let _conversations, _messages;

  return Promise.resolve()
    .then(() => {
      return __csvToJson(conversations_path);
    })
    .then((conversations) => {
      _conversations = conversations;

      if (messages_path) {
        return __csvToJson(messages_path);
      }

      return Promise.resolve();
    })
    .then((messages) => {
      if (messages) {
        _messages = messages;
      }

      // Run adapter?
      if (options.adapter) {
        return __runAdapter(_conversations, _messages, options);
      }

      return Promise.resolve(_conversations);
    })
    .then((conversations) => {
      _conversations = conversations;

      // Write final file
      fs.writeFileSync(
        conversations_path.replace(".csv", ".json"),

        JSON.stringify(_conversations, null, 2)
      );
    });
};

module.exports = { csvToJson };
