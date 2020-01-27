import ServicesLib from '../src/';

const servicesLib = new ServicesLib({
  exchange: 'jest',
});

test('deve ser enviado uma menssagem feito um requeue dela e aceitala na segunda vez', async () => {

  let result;
  let requeued = false;
  let countConsumer = 0;

  await servicesLib.sendToQueue({
    queue: 'jest.queue.requeue.test',
    messageBuffer: Buffer.from(JSON.stringify({ jestTest: true })),
  });

  await servicesLib.consumeQueue('jest.queue.requeue.test', async (msg) => {
    countConsumer++;
    if (!requeued) {
      requeued = true;
      servicesLib.reQueueMessage(msg, 1000);
      return;
    }

    const jsonMessage = servicesLib.getJsonMessage(msg);
    result = jsonMessage.jestTest;
    servicesLib.aproveMessage(msg);
  });

  await servicesLib.sleep(3000);
  await servicesLib.close();
  expect([result, requeued, countConsumer]).toStrictEqual([true, true, 2]);
});
