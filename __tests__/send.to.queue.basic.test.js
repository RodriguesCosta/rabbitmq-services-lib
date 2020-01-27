import ServicesLib from '../src/';

const servicesLib = new ServicesLib({
  exchange: 'jest',
});

test('deve ser enviado uma menssagem e ser recebida pelo consulmidor', async () => {
  let result;

  servicesLib.consumeQueue('jest.queue', async (msg) => {
    const jsonMessage = servicesLib.getJsonMessage(msg);
    result = jsonMessage.jestTest;
    servicesLib.aproveMessage(msg);
  });

  servicesLib.sendToQueue({
    queue: 'jest.queue',
    messageBuffer: Buffer.from(JSON.stringify({ jestTest: true })),
  });

  await servicesLib.sleep(2000);
  await servicesLib.close();
  expect(result).toBe(true);
});
