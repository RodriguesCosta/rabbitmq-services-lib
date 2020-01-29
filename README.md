# rabbitmq-services-lib
## Library that abstracts communication between Node.JS services

Use environment variables to configure.

- RABBITMQ_PROTOCOL=amqp ou amqps
- RABBITMQ_HOST=self explanatory
- RABBITMQ_PORT=self explanatory
- RABBITMQ_USER=self explanatory
- RABBITMQ_PASS=self explanatory
- RABBITMQ_CERT=base64 certificate string, required if using 'amqps' in RABBITMQ_PROTOCOL

# ATTENTION!
### Version <= 1.1.8: Up to version 1.1.8 this library was made to be used together with the plugin [rabbitmq_delayed_message_exchange](https://github.com/rabbitmq/rabbitmq-delayed-message-exchange), if you have difficulty configuring, use my docker image, [rabbitmq-management-delayed-message-exchange](https://github.com/RodriguesCosta/rabbitmq-management-delayed-message-exchange).

### Version >= 1.1.9: From this version the delay option no longer uses the plugin[rabbitmq_delayed_message_exchange](https://github.com/rabbitmq/rabbitmq-delayed-message-exchange) for delay control, this was changed due to some limitations, we now use a native 'x-dead-letter-routing-key' approach.

# Installation

### To install the library you can use one of the following commands below.

```bash
# INSTALL USING YARN
yarn add rabbitmq-services-lib

# INSTALL USING NPM
npm install rabbitmq-services-lib --save
```

# To use

```javascript
// library import
import ServicesLib from 'rabbitmq-services-lib';

const servicesLib = new ServicesLib({
  exchange: 'exchange-name',
  prefetch: 5, // (optional) this number defines how many events this connection can take at a time
});

// the prefetch parameter is defined in the construction of the class so all consumers who use that instance of the class will share this number of prefetch

// be careful when using the prefetch parameter greater than 1, make sure that the action the worker is performing is not sensitive, for example a transfer between accounts

/*
Imagine that you create a consumer that will transfer amounts between accounts and a user requests 2 transfers of 10
dollars using some brute force script.

The user only has 10 dollars in the account, so the first must pass and the second must be rejected due to lack of balance, however
if the prefetch of the consumer who performs this action is 5, that is, he will receive the 2 transfers at the same time and will execute the 2 because as they checked the balance at the same time one did not see that the other would perform the action.

The prefetch greater than 1 (default value) should be used in situations where something like the example above cannot happen, for example, extract query or registration query.
there are many other situations where you can use a prefetch greater than 1 use logic and do tests 😉
*/

// sending a message to a queue
servicesLib.sendToQueue({
  queue: 'sample.queue',
  messageBuffer: servicesLib.getBufferJson({
    content1: 'here you can send any json',
    content2: 'for the queue to access',
  }),
});

// you can send any buffer does not necessarily have to be a json
servicesLib.sendToQueue({
  queue: 'sample.queue',
  messageBuffer: Buffer.from('Any string or even a file buffer'),
});

// processing a queue
servicesLib.consumeQueue('sample.queue', async (msg) => {
  // to access the message json you can use the method below
  const msgJson = servicesLib.getJsonMessage(msg);

  // obs. not always the message will be a json
  const msgContent = Buffer.from(msg.content);

  // if the queue fails you have 2 options

  // first option to return the message in the queue informing a delay that by default is 5 minutes
  // the delay time must be reported in milliseconds
  await servicesLib.reQueueMessage(msg, 300000);

  // second option reject the message from the queue and it will not be processed again
  await servicesLib.rejectMessage(msg);

  // if all goes well you must approve the message
  await servicesLib.aproveMessage(msg);

  // obs. you should only use one of the 3 options above
  // use reQueueMessage or rejectMessage or aproveMessage
  // you should not use more than one option, that is, if you use a stop code execution with a return so that the code stops being executed
});


// sending a message to a queue waiting for a response
servicesLib.sendToQueue({
  queue: 'sample.queue.rpc',
  messageBuffer: servicesLib.getBufferJson({
    n1: 10,
    n2: 7,
  }),
  awaitResponse: true,
}).then((response) => {
  console.log(servicesLib.getJsonMessage(response))
  // this 'response' object will be a buffer, in this case in specific it will be a json buffer with an attribute called result
  // this result will be equal to the sum of the numbers sent in n1 and n2 of the json sent which in the example above is equal to 17
});

// processing a queue waiting for a response
servicesLib.consumeQueue('sample.queue.rpc', async (msg) => {
  // to access the message json you can use the method below
  const msgJson = servicesLib.getJsonMessage(msg);

  // here i am approving the message so it will not be processed again after
  servicesLib.aproveMessage(msg);

  // here I check if there is someone waiting for a reply using the 'replyTo' property of the message
  // remembering that the properties of a message are different from its received content using the function 'servicesLib.getJsonMessage(msg)'
  if (msg.properties.replyTo) {
    // to send a response I use the function 'servicesLib.sendToQueueRPC' which receives as a parameter the queue to which it must respond and also receives a json with the response
    await servicesLib.sendToQueueRPC(msg.properties.replyTo, servicesLib.getJsonMessage({
      result: (msgJson.n1 + msgJson.n2)
    }));
  }
});
// not necessarily the answer must contain the result field, it varies according to the implementation

```
