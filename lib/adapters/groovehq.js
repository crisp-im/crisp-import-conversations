var TurndownService = require("turndown");
var turndownService = new TurndownService();

/**
 * Adapts GrooveHQ ticket to Crisp conversation
 * @public
 * @param  {object} ticket
 * @return {object} Promise object
 */
var adapt_conversation = (ticket) => {
  // Adapt GrooveHQ ticket information to Crisp meta
  let _customer = ticket.customer.customer;

  ticket.user = {
    name   : `${_customer.first_name} ${_customer.last_name}`,
    email  : _customer.email,
    avatar : _customer.avatar_url
  };

  if (ticket.title) {
    ticket.subject = ticket.title;
  }

  ticket.segments = ticket.tags;

  if (ticket.type) {
    ticket.segments.push(ticket.type);
  }

  let _cc = [], _attachments = [];

  // Adapt GrooveHQ ticket actions to Crisp conversation messages
  ticket.messages = (ticket.actions || [])
    .filter((action) => {
      return action.change.type.toLowerCase() === "message";
    })
    .map((action) => {
      let _content = turndownService.turndown(action.change.body || "");

      let _message = {
        from        : (
          action.actor.type.toLowerCase() === "customer"
             ? "user"
             : "operator"
        ),

        user        : {
          name   : action.actor.name,
          email  : action.actor.email
        },

        date        : Date.parse(action.created_at),

        text        : _content,

        // Always embed original, as GrooveHQ uses HTML to format messages
        original    : {
          type    : "text/html",
          content : action.change.body
        },

        origin      : (
          action.change.message_type.toLowerCase() === "email"
            ? "email"
            : "chat"
        ),

        fingerprint : parseInt(action.id)
      };

      if (action.change.note === true) {
        _message.note = _content;
      }

      if ((action.change.cc || []).length > 0) {
        _cc = [].concat(_cc, action.change.cc);
      }

      if ((action.change.attachments || []).length > 0) {
        action.change.attachments = action.change.attachments
          .map(attachment => {
            // Embed extra properties
            attachment.actor        = action.actor;
            attachment.created_at   = action.created_at;
            attachment.message_type = action.change.message_type;

            return attachment;
          })

        _attachments = [].concat(_attachments, action.change.attachments);
      }

      return _message;
    });

  // Adapt GrooveHQ messages CCs to Crisp participants
  if (_cc.length > 0) {
    ticket.participants = _cc
      .filter((cc, index, self) => {
        // Remove duplicates
        let _index = self.findIndex(element => {
          return cc.id === element.id;
        });

        return _index === index;
      })
      .map(cc => {
        return cc.email;
      });
  }

  // Adapt GrooveHQ messages attachments to Crisp file messages
  if (_attachments.length > 0) {
    let _fileMessages = _attachments
      .map(attachment => {
        return {
          from        : (
            attachment.actor.type.toLowerCase() === "customer"
              ? "user"
              : "operator"
          ),

          user        : {
            name   : attachment.actor.name,
            email  : attachment.actor.email
          },

          date        : Date.parse(attachment.created_at),

          file        : {
            url  : attachment.url,
            name : attachment.file_name,
            type : attachment.file_type
          },

          origin      : (
            attachment.message_type.toLowerCase() === "email"
              ? "email"
              : "chat"
          ),

          fingerprint : parseInt(attachment.id)
        };
      });

    ticket.messages = [].concat(ticket.messages, _fileMessages);
  }

  // Adapt GrooveHQ ticket status to Crisp conversation state
  let _lastAction = ticket.actions[ticket.actions.length - 1];

  if ((_lastAction || {}).change.type.toLowerCase() === "state") {
    switch (ticket.status) {
      case "unread" :
      case "pending" : {
        ticket.state = "pending";

        break;
      }

      case "opened" : {
        ticket.state = "unresolved";

        break;
      }

      case "spam" :
      case "closed" : {
        ticket.state = "resolved";

        break;
      }

      default : {
        ticket.state = "unresolved"

        break;
      }
    }
  } else {
    ticket.state = "unresolved"
  }

  return Promise.resolve(ticket);
};

module.exports = { adapt_conversation };
