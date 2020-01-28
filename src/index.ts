import { connect, Connection, Channel, Options, ConsumeMessage } from 'amqplib';
import uuidv4 from 'uuid/v4';

interface SendToQueueInterface {
  queue: string;
  messageBuffer: Buffer;
  delay?: number;
  awaitResponse?: boolean;
  extraData?: string;
  timeOut?: number;
}

type onMessageType = (msg: ConsumeMessage) => any

class ServicesLib {

  //configurações de conexão com o servidor rabbitmq.
  private connectUri: Options.Connect = {
    protocol: process.env.RABBITMQ_PROTOCOL || undefined,
    hostname: process.env.RABBITMQ_HOST || undefined,
    port: process.env.RABBITMQ_PORT ? Number(process.env.RABBITMQ_PORT) : undefined,
    username: process.env.RABBITMQ_USER || undefined,
    password: process.env.RABBITMQ_PASS || undefined,
  }

  //configurações do certificado caso seja protocolo seguro no caso 'amqps'.
  private connectOptions = this.connectUri.protocol == 'amqps' ? {
    ca: process.env.RABBITMQ_CERT ? [Buffer.from(process.env.RABBITMQ_CERT, 'base64')] : undefined,
  } : {}

  private connection: Connection = null
  private channel: Channel = null
  private exchange: string
  private prefetch = 1
  private firstInit = true
  private defaultTimeOut = 30000
  private consumes: { [queue: string]: onMessageType; } = {}

  public constructor({ exchange, prefetch = 1 }: { exchange: string; prefetch?: number }) {
    this.exchange = exchange;
    this.prefetch = prefetch;
    this.init();
  }

  /**
   * Aguarda a quantidade de milisegundos para continuar as funções
   * @param ms
   */
  public sleep(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Salva uma função consumidora para ser usada em caso de desconexão temporaria com o servidor rabbitmq.
   * @param queue
   * @param onMessage
   */
  private saveConsume(queue: string, onMessage: onMessageType) {
    this.consumes[queue] = onMessage;
  }

  private async init() {
    try {
      //Tenta se conectar cria um canal e uma exchange
      this.connection = await connect(this.connectUri, this.connectOptions);
      this.channel = await this.connection.createChannel();
      await this.channel.assertExchange(this.exchange, 'x-delayed-message', {
        durable: true,
        arguments: {
          'x-delayed-type': 'topic',
        },
      });

      //seta o numero de evento que as filas dessa conexão podem pegar
      await this.channel.prefetch(this.prefetch);

      //so consome a fila caso não seja a primeira inicialização
      //caso não tenha isso ele cria 2 consumidores
      if (Object.keys(this.consumes).length > 0 && !this.firstInit)
        for (let queue in this.consumes)
          this.consumeQueue(queue, this.consumes[queue]);

      //define o serviço como já conectado uma vez
      this.firstInit = false;

      //log de conexão
      console.log('RABBITMQ Conectado.');

      //Evento de desconexão
      this.connection.on('close', () => {
        //log de desconexão
        console.log('Error RABBITMQ Desconectado.');
        this.connection = null;
        this.channel = null;

        //tenta se reconectar depois de 1 segundo caso a conexão falhe
        setTimeout(() => {
          //log de tentativa
          console.log('Tentando conectar ao RABBITMQ...');
          this.init();
        }, 1000);
      });
    } catch (err) {
      console.log('Error ao tentar conectar no RABBITMQ.');

      this.connection = null;
      this.channel = null;

      //tenta se reconectar depois de 1 segundo caso a conexão falhe
      setTimeout(() => {
        //log de tentativa
        console.log('Tentando conectar ao RABBITMQ...');
        this.init();
      }, 1000);
    }
  }

  /**
   * Registra uma função para ficar consumindo uma fila.
   * @param queue
   * @param onMessage
   */
  public async consumeQueue(queue: string, onMessage: onMessageType): Promise<any> {
    //salva o consumidor
    this.saveConsume(queue, onMessage);

    //caso o canal não exista ele tenta registrar o consumidor da fila depois de 1 segundo
    //para caso a conexão for estabelecida o consumidor seja registrado
    if (!this.channel) {
      console.log('Erro RABBITMQ canal não existe (consumeQueue) tentando novamente em 1 segundo...');
      await this.sleep(1000);
      return this.consumeQueue(queue, onMessage);
    }

    try {
      //registra a fila no servidor caso não exista
      const q = await this.channel.assertQueue(queue, { durable: true });

      //faz a ligação com a fila
      await this.channel.bindQueue(q.queue, this.exchange, queue);

      //registra de fato o consumidor
      await this.channel.consume(q.queue, onMessage);
    } catch (error) {
      console.log('Erro ao conectar na fila tentando novamente em 1 segundo...');
      //caso aconteça algum erro ele tenta registrar o consumidor da fila depois de 1 segundo
      await this.sleep(1000);
      return this.consumeQueue(queue, onMessage);
    }
  }

  /**
   * Consome fila de resposta baseado no replyTo
   * @param replyTo
   * @param timeOut
   */
  private async consumeQueueRPC(replyTo: string, timeOut: number): Promise<any> {
    if (timeOut <= 0) {
      throw new Error('Time out...');
    }

    if (!this.channel) {
      console.log('Erro RABBITMQ canal não existe tentando novamente em 1 segundo...');
      await this.sleep(1000);
      return this.consumeQueueRPC(replyTo, timeOut - 1000);
    }

    try {
      //registra a fila no servidor caso não exista
      const q = await this.channel.assertQueue(replyTo, { durable: false, autoDelete: true, expires: 300000 });

      //faz a ligação com a fila
      await this.channel.bindQueue(q.queue, this.exchange, replyTo);

      //consome a fila e retorna o json uma unica vez
      const response = await this.channel.get(q.queue);

      //caso ainda não tenha nenhuma menssagem aguarda 100ms para tentar buscar de novo
      if (!response) {
        await this.sleep(100);
        return this.consumeQueueRPC(replyTo, timeOut - 100);
      }

      //deleta a fila temporaria de maneira assincrona (sem um await)
      //pois nao necessariamente precisa que ela seja deletada já que existe um tempo de expiração
      this.channel.deleteQueue(q.queue).catch(() => {
        console.log('Erro ao deletar fila temporaria.');
      });

      return response;
    } catch (error) {
      console.log('Erro ao conectar na fila tentando novamente em 1 segundo...');
      //caso aconteça algum erro ele tenta registrar o consumidor da fila depois de 1 segundo
      await this.sleep(1000);
      return this.consumeQueueRPC(replyTo, timeOut - 1000);
    }
  }

  /**
   * Retorna o JSON de uma mensagem.
   * @param msg
   */
  public getJsonMessage(msg: ConsumeMessage) {
    return JSON.parse(msg.content.toString());
  }

  /**
   * Retorna o Buffer de um JSON.
   * @param json
   */
  public getBufferJson(json: any) {
    return Buffer.from(JSON.stringify(json));
  }

  /**
   * Aprova mensagem indicando que a ação dela ja foi concluida.
   * @param msg
   */
  public aproveMessage(msg: ConsumeMessage) {
    this.channel.ack(msg);
  }

  /**
   * Reenvia a mensagem para a fila para tentar processar ela novamente,
   * pode ser informado um delay que por padrão e de 5 minutos em milisegundos (300.000).
   * @param msg
   */
  public async reQueueMessage(msg: ConsumeMessage, delay: number = 300000) {
    this.rejectMessage(msg);
    await this.sendToQueue({
      queue: msg.fields.routingKey,
      messageBuffer: msg.content,
      delay: delay,
    });
  }

  /**
   * Rejeita a mensagem para que ela nem volte para a fila.
   * @param msg
   */
  public rejectMessage(msg: ConsumeMessage) {
    this.channel.nack(msg, null, false);
  }

  /**
   * Fecha a conexão com o servidor
   */
  public async close() {
    await this.connection.close();
  }

  /**
   * Envia uma mensagem para uma fila especifica.
   * Pode ser informado um delay em milisegundos que por padrão e 0.
   * @param queue
   * @param message
   */
  public async sendToQueue(options: SendToQueueInterface): Promise<any> {
    //caso o canal não exista ele tenta registrar a mensagem na fila depois de 1 segundo
    //para caso a conexão for estabelecida a mensagem seja registrada
    if (!this.channel) {
      console.log('Erro RABBITMQ canal não existe (sendToQueue) tentando novamente em 1 segundo...');
      await this.sleep(1000);
      return this.sendToQueue(options);
    }

    let msgHeaders: any = {};

    const optionsPub: Options.Publish = {};
    if (options.delay && options.delay > 0) {
      msgHeaders['x-delay'] = options.delay;
    }

    let awaitResponse;
    if (options.awaitResponse) {
      optionsPub.replyTo = uuidv4();
      awaitResponse = this.consumeQueueRPC(optionsPub.replyTo, options.timeOut ? options.timeOut : this.defaultTimeOut);
    }

    if (options.extraData) {
      msgHeaders['extraData'] = options.extraData;
    }

    optionsPub.headers = msgHeaders;

    try {
      //registra a fila no servidor caso não exista
      const q = await this.channel.assertQueue(options.queue, { durable: true });

      //faz a ligação com a fila
      await this.channel.bindQueue(q.queue, this.exchange, options.queue);

      //publica de fato a mensagem na fila, obrigatoriamente a mensagem deve ser enviada como um buffer
      await this.channel.publish(this.exchange, options.queue, options.messageBuffer, optionsPub);
    } catch (error) {
      console.log('Erro ao enviar para a fila tentando novamente em 1 segundo...');
      //caso aconteça algum erro ele tenta registrar a mensagem na fila depois de 1 segundo
      await this.sleep(1000);
      return this.sendToQueue(options);
    }

    if (options.awaitResponse) {
      return await awaitResponse;
    }
  }

  public async sendToQueueRPC(replyTo: string, message: Buffer): Promise<any> {
    //caso o canal não exista ele tenta registrar a mensagem na fila depois de 1 segundo
    //para caso a conexão for estabelecida a mensagem seja registrada
    if (!this.channel) {
      console.log('Erro RABBITMQ canal não existe tentando novamente em 1 segundo...');
      await this.sleep(1000);
      return this.sendToQueueRPC(replyTo, message);
    }

    try {
      //registra a fila no servidor caso não exista
      const q = await this.channel.assertQueue(replyTo, { durable: false, autoDelete: true, expires: 300000 });

      //faz a ligação com a fila
      await this.channel.bindQueue(q.queue, this.exchange, replyTo);

      //publica de fato a mensagem na fila, obrigatoriamente a mensagem deve ser enviada como um buffer
      await this.channel.publish(this.exchange, replyTo, message);
    } catch (error) {
      console.log('Erro ao enviar para a fila tentando novamente em 1 segundo...');
      //caso aconteça algum erro ele tenta registrar a mensagem na fila depois de 1 segundo
      await this.sleep(1000);
      return this.sendToQueueRPC(replyTo, message);
    }
  }
}

export default ServicesLib;
