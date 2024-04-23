/**
 * Creates Tidio conversations from Tidio messages
 * @public
 * @param  {object} messages
 * @return {object} Promise object
 */
var adapt_conversations = (messages) => {
  // Group messages by conversation id
  let _messages = {};

  messages.forEach(message => {
    let _id = message.CONVERSATION_ID;

    if (_messages[_id]) {
      _messages[_id].push(message);
    } else {
      _messages[_id] = [message];
    }
  });

  // Add messages to their respective conversation
  let _conversations = Object.keys(_messages).map((conversation_id) => {
    return {
      id : conversation_id,
      messages : _messages[conversation_id] || []
    };
  });

  return Promise.resolve(
    _conversations
  );
};

/**
 * Adapts Tidio conversation to Crisp conversation
 * @public
 * @param  {object} conversation
 * @return {object} Promise object
 */
var adapt_conversation = (conversation) => {
  let _first_name, _last_name, _name, _email, _phone, _channel;

  // Adapt Tidio conversation messages to Crisp conversation messages
  conversation.messages = (conversation.messages || [])
    .map((message) => {
      // Extract conversation information
      if (!_first_name && message.SENDER === "visitor" && message.FIRST_NAME) {
        _first_name = message.FIRST_NAME;
      }

      if (!_last_name && message.SENDER === "visitor" && message.LAST_NAME) {
        _last_name = message.LAST_NAME;
      }

      if (!_name && message.SENDER === "visitor" && message.NAME) {
        _name = message.NAME;
      }

      if (!_email && message.SENDER === "visitor" && message.EMAIL) {
        _email = message.EMAIL;
      }

      if (!_phone && message.SENDER === "visitor" && message.PHONE) {
        _phone = message.PHONE;
      }

      let _message = {
        from   : message.SENDER === "visitor" ? "user" : "operator",

        date   : Date.parse(message.TIME_SENT),

        text   : message.MESSAGE_CONTENT,

        origin : message.CHANNEL

        // Important: do not set any fingerprint here, as `message.id` is in \
        //   fact the conversation identifier (i.e. the same for all messages)
      };

      return _message;
    });

  // Build final name if possible
  let _final_name;

  if (_first_name && _last_name) {
    _final_name = _first_name + " " + _last_name;
  } else if (_first_name) {
    _final_name = _first_name;
  } else if (_last_name) {
    _final_name = _last_name;
  } else if (_name) {
    _final_name = _name;
  }

  // Adapt Tidio conversation information to Crisp meta
  conversation.user = {
    name  : _final_name || "",
    email : _email || "",
    phone : _phone || "",
  };

  if (_channel) {
    conversation.segments = [_channel];
  }

  conversation.state = "resolved";

  return Promise.resolve(conversation);
};

module.exports = { adapt_conversations, adapt_conversation };
