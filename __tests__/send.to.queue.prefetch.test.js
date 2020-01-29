import ServicesLib from '../src/';

const servicesLib = new ServicesLib({
  exchange: 'jest',
});
const servicesLibPrefetch = new ServicesLib({
  exchange: 'jest',
  prefetch: 5,
});

it('deve ser enviado 6 menssagens e o consumidor dois deve receber 5 pois vai ter um prefetch maior', async () => {

  jest.setTimeout(10000);

  const array1 = [];
  const array2 = [];

  servicesLib.consumeQueue('jest.queue.prefetch.test', async (msg) => {
    const jsonMessage = servicesLib.getJsonMessage(msg);
    await servicesLib.sleep(2000);
    array1.push(jsonMessage.number);
    servicesLib.aproveMessage(msg);
  });

  await servicesLib.sleep(1000);

  servicesLibPrefetch.consumeQueue('jest.queue.prefetch.test', async (msg) => {
    const jsonMessage = servicesLibPrefetch.getJsonMessage(msg);
    await servicesLibPrefetch.sleep(2000);
    array2.push(jsonMessage.number);
    servicesLibPrefetch.aproveMessage(msg);
  });

  servicesLib.sendToQueue({ queue: 'jest.queue.prefetch.test', messageBuffer: Buffer.from(JSON.stringify({ number: 1 })) });
  servicesLib.sendToQueue({ queue: 'jest.queue.prefetch.test', messageBuffer: Buffer.from(JSON.stringify({ number: 2 })) });
  servicesLib.sendToQueue({ queue: 'jest.queue.prefetch.test', messageBuffer: Buffer.from(JSON.stringify({ number: 3 })) });
  servicesLib.sendToQueue({ queue: 'jest.queue.prefetch.test', messageBuffer: Buffer.from(JSON.stringify({ number: 4 })) });
  servicesLib.sendToQueue({ queue: 'jest.queue.prefetch.test', messageBuffer: Buffer.from(JSON.stringify({ number: 5 })) });
  servicesLib.sendToQueue({ queue: 'jest.queue.prefetch.test', messageBuffer: Buffer.from(JSON.stringify({ number: 6 })) });

  await servicesLib.sleep(5000);
  await servicesLib.close();
  expect([array1.length, array2.length]).toStrictEqual([1, 5]);
});
