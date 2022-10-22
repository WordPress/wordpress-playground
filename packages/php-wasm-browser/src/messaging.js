export const DEFAULT_REPLY_TIMEOUT = 25000;

let lastMessageId = 0;
export function postMessageExpectReply(
  messageTarget,
  message,
  ...postMessageArgs
) {
  const messageId = ++lastMessageId;
  messageTarget.postMessage(
    {
      ...message,
      messageId,
    },
    ...postMessageArgs
  );
  return messageId;
}

export async function awaitReply(
  messageTarget,
  messageId,
  timeout = DEFAULT_REPLY_TIMEOUT
) {
  return new Promise((resolve, reject) => {
    const responseHandler = (event) => {
      if (
        event.data.type === "response" &&
        event.data.messageId === messageId
      ) {
        messageTarget.removeEventListener("message", responseHandler);
        clearTimeout(failOntimeout);
        resolve(event.data.result);
      }
    };
    const failOntimeout = setTimeout(() => {
      reject(new Error("Request timed out"));
      messageTarget.removeEventListener("message", responseHandler);
    }, timeout);
    messageTarget.addEventListener("message", responseHandler);
  });
}

export function responseTo(messageId, result) {
  return {
    type: "response",
    messageId,
    result,
  };
}

export function messageHandler(handler) {
  return async function(event, respond) {
    const result = await handler(event.data);
  
    // When `messageId` is present, the main thread expects a response:
    if (event.data.messageId) {
      respond(responseTo(event.data.messageId, result));
    }
  }
}