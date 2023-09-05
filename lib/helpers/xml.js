var fs           = require("fs");
var { xml2json } = require("xml-js");

var XML_TO_JSON_OPTIONS = {
  compact: true,
  spaces: 2,
  nativeType: true,
  nativeTypeAttributes: true,
  ignoreDeclaration: true
};

/**
 * Cleans a JSON after XML conversion
 * @private
 * @param  {object} obj
 * @param  {string} property
 * @return {undefined}
 */
var __clean = (obj, property) => {
  if (Object.keys(obj[property]).includes("_attributes")) {
    // Simple value?
    if (
      [
        "datetime", "integer", "boolean", "text"
      ].includes(obj[property]._attributes.type)
    ) {
      // Replace attribute with underlying value
      obj[property] = (
        obj[property]._attributes.nil === true
          ? null
          : obj[property]._text
        );
    }

    // Nil value?
    else if (
      Object.keys(obj[property]).length === 1
        && obj[property]._attributes.nil === true
    ) {
      obj[property] = null;
    }

    // Array?
    else if (obj[property]._attributes.type === "array") {
      if (Object.keys(obj[property]).length === 1) {
        // Replace attribute with empty array
        obj[property] = [];
      } else if (Object.keys(obj[property]).length === 2) {
        let _keys = Object.keys(obj[property])
          .filter(key => {
            return key !== "_attributes"
          });

        let _value = obj[property][_keys[0]];

        if (!Array.isArray(_value)) {
          _value = [_value];
        }

        // Replace attribute with underlying array
        obj[property] = _value;

        // Clean it
        __traverse(obj[property]);
      }
    }
  } else if (
    obj[property].hasOwnProperty("_text")
      && Object.keys(obj[property]).length === 1
  ) {
    // Replace property with underlying _text property
    obj[property] = obj[property]._text;
  } else {
    __traverse(obj[property]);
  }
};

/**
 * Traverses an object
 * @private
 * @param  {object} obj
 * @return {undefined}
 */
var __traverse = (obj) => {
  for (var property in obj) {
    if (obj.hasOwnProperty(property)) {
      if (typeof obj[property] === "object") {
        __clean(obj, property);
      }
    }
  }
};

/**
 * Converts an XML file to a JSON file
 * @public
 * @param  {string} conversations_path
 * @param  {string} [messages_path]
 * @param  {object} [options]
 * @return {undefined}
 */
var xmlToJson = (conversations_path, messages_path = "", options = {}) => {
  let _content;

  return Promise.resolve()
    .then(() => {
      return fs.promises.readFile(conversations_path);
    })
    .then((content) => {
      _content = content.toString("utf-8");

      // Parse
      return Promise.resolve(
        xml2json(content, XML_TO_JSON_OPTIONS)
      );
    })
    .then((content) => {
      _content = JSON.parse(content);

      // Traverse and clean
      __traverse(_content);

      return Promise.resolve();
    })
    .then(() => {
      // Write final file
      fs.writeFileSync(
        conversations_path.replace(".xml", ".json"),

        JSON.stringify(_content, null, 2)
      );
    });
};

module.exports = { xmlToJson };
