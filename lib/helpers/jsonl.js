var fs = require("fs");

/**
 * Converts a JSONL file to a JSON file
 * @public
 * @param  {string} conversations_path
 * @param  {string} [messages_path]
 * @param  {object} [options]
 * @return {undefined}
 */
var jsonlToJson = (conversations_path, messages_path = "", options = {}) => {
  let _content,
    _path = conversations_path.replace(".jsonl", ".json");

  return new Promise((resolve, reject) => {
    let _stream_read = fs.createReadStream(conversations_path),
      _stream_write = fs.createWriteStream(_path);

    let _rl = require("readline").createInterface({
      input: _stream_read,
      crlfDelay: Infinity
    });

    let _first = true;

    _stream_write.write("[\n");

    _rl.on("line", (_line) => {
      if (_line.trim()) {
        if (!_first) {
          _stream_write.write(",\n");
        }

        _stream_write.write(_line);
        _first = false;
      }
    });

    _rl.on("close", () => {
      _stream_write.write("\n]");
      _stream_write.end();
    });

    _stream_write.on("finish", () => {
      resolve(_path);
    });

    _stream_write.on("error", reject);
    _stream_read.on("error", reject);
  });
};

module.exports = { jsonlToJson };
