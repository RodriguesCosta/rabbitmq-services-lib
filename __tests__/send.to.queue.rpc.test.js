import ServicesLib from '../src/';

const servicesLib = new ServicesLib({
  exchange: 'jest',
});

const sleep = (ms) => {
  return new Promise(resolve => setTimeout(resolve, ms));
};

test('deve ser enviado uma menssagem e ser recebida pelo consumidor e o consumidor deve enviar uma resposta', async () => {

  const jsonSend = { n1: 10, n2: 7 };

  servicesLib.consumeQueue('jest.queue.rpc.test', async (msg) => {
    const jsonMessage = servicesLib.getJsonMessage(msg);
    servicesLib.aproveMessage(msg);

    if (msg.properties.replyTo) {
      await sleep(3000);
      await servicesLib.sendToQueueRPC(msg.properties.replyTo, Buffer.from(JSON.stringify({ response: (jsonMessage.n1 + jsonMessage.n2) })));
    }
  });

  let response = await servicesLib.sendToQueue({
    queue: 'jest.queue.rpc.test',
    messageBuffer: Buffer.from(JSON.stringify(jsonSend)),
    awaitResponse: true,
  });

  response = servicesLib.getJsonMessage(response);
  await servicesLib.close();
  expect(response.response).toBe((jsonSend.n1 + jsonSend.n2));
});
