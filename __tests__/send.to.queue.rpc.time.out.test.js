import ServicesLib from '../src/';

const servicesLib = new ServicesLib({
  exchange: 'jest',
});

test('deve ser enviado uma menssagem e nao ser respondida', async () => {

  jest.setTimeout(10000);

  try {
    await servicesLib.sendToQueue({
      queue: 'jest.queue.rpc.time.out.test',
      messageBuffer: Buffer.from(JSON.stringify({})),
      awaitResponse: true,
      timeOut: 5000,
    });
    await servicesLib.close();
    expect(true).toBe(false);
  } catch (e) {
    console.error(e.message);
    await servicesLib.close();
    expect(true).toBe(true);
  }
});
