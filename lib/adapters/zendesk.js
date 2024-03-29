/**
 * Adapts Zendesk ticket to Crisp conversation
 * @public
 * @param  {object} ticket
 * @return {object} Promise object
 */
var adapt_conversation = (ticket) => {
  // Adapt Zendesk ticket information to Crisp meta
  ticket.user = {
    name  : ticket.requester.name,
    email : ticket.requester.email,
    phone : ticket.requester.phone
  };

  ticket.segments = ticket.tags;

  if (ticket.subject) {
    ticket.subject = ticket.subject.replace(/\n/g, " ");
  }

  if (ticket.requester.locale) {
    ticket.user.locales = [ticket.requester.locale];
  }

  if ((ticket.requester.photo || {}).content_url) {
    ticket.user.avatar = ticket.requester.photo.content_url;
  }

  let _userMessages = (ticket.comments || [])
    .filter((comment) => {
      return comment.author_id === ticket.requester.id
    });

  let _system = (((_userMessages[0] || {}).metadata) || {}).system;

  if (_system) {
    if (_system.latitude && _system.longitude) {
      ticket.user.cooordinates = {
        latitude  : _system.latitude,
        longitude : _system.longitude
      };
    }
  }

  // Adapt Zendesk ticket comments to Crisp conversation messages
  ticket.messages = (ticket.comments || []).map((comment) => {
    let _message = {
      from        : (
        comment.author_id === ticket.requester.id ? "user" : "operator"
      ),

      date        : Date.parse(comment.created_at),

      text        : comment.body,

      origin      : comment.via.channel === "email" ? "email" : "chat",

      fingerprint : comment.id
    };

    if (comment.via.channel === "email") {
      _message.original = {
        type    : "text/html",
        content : comment.html_body
      };
    }

    if (comment.public === false) {
      _message.note = comment.body;
    }

    // Attempt to map operator information to ticket assignee information
    // Notice: this is the only way to get sender information for operator \
    //   messages
    if (
      _message.from === "operator" &&
      ticket.assignee &&
      comment.author_id === ticket.assignee.id
    ) {
      _message.user = {
        name : ticket.assignee.name
      };

      if ((ticket.assignee.photo || {}).content_url) {
        _message.user.avatar = ticket.assignee.photo.content_url;
      }
    }

    return _message;
  });

  // Adapt Zendesk ticket status to Crisp conversation state
  switch (ticket.status) {
    case "pending" : {
      ticket.state = "pending";

      break;
    }

    case "open" : {
      ticket.state = "unresolved";

      break;
    }

    case "solved" :
    case "closed" : {
      ticket.state = "resolved";

      break;
    }

    default : {
      ticket.state = "unresolved"

      break;
    }
  }

  return Promise.resolve(ticket);
};

module.exports = { adapt_conversation };
