/**
 * This module implements responding to postMessage events.
 * 
 * @example
 * 
 * In the main app:
 * 
 * ```js
 * import { postMessageExpectReply, awaitReply } from 'php-wasm-browser';
 * const iframeWindow = iframe.contentWindow;
 * const messageId = postMessageExpectReply(iframeWindow, {
 *    type: "get_php_version"
 * });
 * const response = await awaitReply(iframeWindow, messageId);
 * console.log(response);
 * // "8.0.24"
 * ```
 * 
 * In the iframe:
 * 
 * ```js
 * import { responseTo } from 'php-wasm-browser';
 * window.addEventListener('message', (event) => {
 *    let result = '8.0.24';
 *    if(event.data.type === 'get_php_version') {
 *       result = '8.0.24';
 *    } else {
 *       throw new Error(`Unexpected message type: ${event.data.type}`);
 *    }
 * 
 *    // When `messageId` is present, the other thread expects a response:
 *    if (event.data.messageId) {
 *       const response = responseTo(event.data.messageId, result);
 *       window.parent.postMessage(response, event.origin);
 *    }
 * });
 * ```
 */

export const DEFAULT_REPLY_TIMEOUT = 25000;

let lastMessageId = 0;
/**
 * Posts the message to the target window and returns a unique `messageId`
 * that can be used to await a reply.
 * 
 * @param {Object} messageTarget An object that has a `postMessage` method.
 * @param {Object.<string, any>} message A key-value object that can be serialized to JSON.
 * @param  {...any} postMessageArgs Optional. Additional arguments to pass to `postMessage`.
 * @returns {number} The message ID for awaitReply().
 */
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

/**
 * Awaits a reply to the message with the given ID.
 * 
 * @throws {Error} If the reply is not received within the timeout.
 * @param {Object} messageTarget EventEmitter emitting `message` events, e.g. `window`
 *                               or a `Worker` instance.
 * @param {Number} messageId The message ID returned by postMessageExpectReply().
 * @param {Number} timeout Optional. The number of milliseconds to wait for a reply before
 *                         throwing an error.
 * @returns {Promise<any>} The reply from the messageTarget.
 */
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

/**
 * Creates a response message to the given message ID.
 * 
 * @param {Number} messageId The message ID sent from the other thread by 
 *                           `postMessageExpectReply` in the `message` event.
 * @param {Object} result The result to send back to the messageTarget.
 * @returns {Object} A message object that can be sent back to the other thread.
 */
export function responseTo(messageId, result) {
  return {
    type: "response",
    messageId,
    result,
  };
}
