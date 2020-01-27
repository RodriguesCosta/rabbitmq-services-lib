import ServicesLib from '../src/';

const servicesLib = new ServicesLib({
  exchange: 'jest',
});

it('deve ser enviado 2 menssagens e a segunda deve ser processada primeiro pois ela nao vai ter delay e a primeira vai ter', async () => {

  jest.setTimeout(12000);

  const arrayDelaySend = [12, 17];
  const arrayDelayCompare = [];

  servicesLib.consumeQueue('jest.queue.delay.test', async (msg) => {
    const jsonMessage = servicesLib.getJsonMessage(msg);
    servicesLib.aproveMessage(msg);
    arrayDelayCompare.push(jsonMessage.number);
  });

  await servicesLib.sendToQueue({
    queue: 'jest.queue.delay.test',
    messageBuffer: Buffer.from(JSON.stringify({ number: arrayDelaySend[1] })),
    delay: 2000,
  });
  await servicesLib.sendToQueue({
    queue: 'jest.queue.delay.test',
    messageBuffer: Buffer.from(JSON.stringify({ number: arrayDelaySend[0] })),
  });

  await servicesLib.sleep(7000);
  await servicesLib.close();
  expect(arrayDelayCompare).toStrictEqual(arrayDelaySend);
});
