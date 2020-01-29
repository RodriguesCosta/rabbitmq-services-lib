# rabbitmq-services-lib
## Biblioteca que abstrai comunicação entre serviços Node.JS

Deve ser adicionada as seguintes variaveis de ambiente.

- RABBITMQ_PROTOCOL=amqp ou amqps
- RABBITMQ_HOST=auto explicativo
- RABBITMQ_PORT=auto explicativo
- RABBITMQ_USER=auto explicativo
- RABBITMQ_PASS=auto explicativo
- RABBITMQ_CERT=string base64 do certificado do serviço obrigatorio caso use 'amqps' no RABBITMQ_PROTOCOL

#### ATENÇÃO! Até a versão 1.1.8 essa biblioteca foi feita para ser usada juntamente com o plugin [rabbitmq_delayed_message_exchange](https://github.com/rabbitmq/rabbitmq-delayed-message-exchange), caso tenha dificuldades em configurar, use minha imagem docker, [rabbitmq-management-delayed-message-exchange](https://github.com/RodriguesCosta/rabbitmq-management-delayed-message-exchange).

#### Versão >= 1.1.9 Apartir dessa versão a opção de delay não usa mais o plugin [rabbitmq_delayed_message_exchange](https://github.com/rabbitmq/rabbitmq-delayed-message-exchange) para controle do delay, isso foi alterado devido algumas limitações do mesmo, agora usamos uma abordagem nativa 'x-dead-letter-routing-key'.

## Instalação

### Para instalar essa biblioteca você pode usar um dos seguintes comando abaixo.

```bash
# INSTALAR USANDO YARN RECOMENDADO
yarn add rabbitmq-services-lib

# INSTALAR USANDO NPM
npm install rabbitmq-services-lib --save
```

## Uso

```javascript
// importação da biblioteca
import ServicesLib from 'rabbitmq-services-lib';

const servicesLib = new ServicesLib({
  exchange: 'nome-da-exchange',
  prefetch: 5, // (opcional) esse numero define quantos eventos essa conexão pode pegar por vez
});

// o parametro prefetch e definido na construção da classe logo todos os consumidores que usarem aquela instancia da classe vai compartilhar desse numero de prefetch

// cuidado ao usar o parametro prefetch maior que 1, tenha certeza que a ação que o trabalhador esta executando não e sensivel, por exemplo uma transferencia entre contas

/*
imagine que vc cria um consumidor que vai transferir valores entre contas e um usuario solicita 2 transferencias de 10 reais seguindas usando algum script de força bruta.
ai o usuario so tem 10 reais na conta de saldo, logo a primeira deve passar e a segunda ser rejeitada por falta de saldo, porem
caso o prefetch do consumidor que realiza essa ação e 5 ou seja ele vai receber as 2 transferencias ao mesmo tempo e vai execultar as 2 pois como elas verificaram o saldo ao mesmo tempo uma nao viu que a outra iria realizar a ação.

o prefetch maior que 1 (valor padrão) deve ser usado em situações em que algo como o exemplificado acima nao possa ocorrer, exemplo consulta de extrato ou consulta de cadastro.
existem muitas outras situações que pode-se usar um prefetch maior que 1 use a logica e faça testes 😉
*/

// envio de uma mensagem para uma fila
// a partir da versao v1.1.0 vc deve enviar um objeto de configuração
// alem do conteudo ser um buffer e nao um json
servicesLib.sendToQueue({
  queue: 'fila.para.enviar',
  messageBuffer: Buffer.from(JSON.stringify({
    content1: 'aqui vc pode mandar qualquer json',
    content2: 'para a fila acessar',
  })),
});

// processamento de uma fila
servicesLib.consumeQueue('fila.para.enviar', async (msg) => {
  // para acessar o json da mensagem pode usar o metodo abaixo
  const msgJson = servicesLib.getJsonMessage(msg);
  // obs. nem sempre a menssagem vai ser um json, em sua maioria sim, mas existe algumas poucas possibilidades onde vc vai ter que manipular o buffer de maneira diferente

  // caso a fila falhe você tem 2 opções

  // primeira opção re colocar a menssagem na fila informando um delay que por padrão e de 5 minutos
  // o tempo de delay deve ser informado em milisegundos
  await servicesLib.reQueueMessage(msg, 300000);

  // segunda opção rejeitar a mensagem da fila e ela nao vai ser processada novamente
  await servicesLib.rejectMessage(msg);

  // se der tudo certo você deve aprovar a mensagem
  await servicesLib.aproveMessage(msg);

  // obs. você so deve usar uma das 3 opções acima
  // use reQueueMessage ou rejectMessage ou aproveMessage
  // você não deve usar mais de uma opção, ou seja caso use uma mate a execução do codigo com um return
  // para que o codigo pare de ser execultado
});


// agora na versão 1.0.12 tag #v1.0.12
// você pode enviar uma menssagem para um microserviço e aguardar uma resposta que o consumidor deve implementar
// segue exemplo abaixo

// envio de uma mensagem para uma fila aguardando uma resposta
servicesLib.sendToQueue({
  queue: 'fila.para.enviar.soma',
  messageBuffer: Buffer.from(JSON.stringify({
    n1: 10,
    n2: 7,
  })),
  awaitResponse: true,
}).then((response) => {
  console.log(servicesLib.getJsonMessage(response))
  // esse objeto 'response' vai ser um buffer nesse caso em especifico vai ser um buffer de um json com um atributo chamado result
  // esse result vai ser igual a soma dos numeros enviados em n1 e n2 do json enviado que no exemplo acima e igual a 17
});

// processamento de uma fila que aguarda uma resposta
servicesLib.consumeQueue('fila.para.enviar.soma', async (msg) => {
  // para acessar o json da mensagem pode usar o metodo abaixo
  const msgJson = servicesLib.getJsonMessage(msg);

  // aqui estou aprovando a mensagem para ela nao ser processada novamente depois
  servicesLib.aproveMessage(msg);

  // aqui verifico se existe alguem esperando por uma resposta usando o propriedade 'replyTo' da mensagem
  // lembrando que as propriedades de uma mensagem são coisas diferentes do seu conteudo recebido usando a função 'servicesLib.getJsonMessage(msg)'
  if (msg.properties.replyTo) {
    // para enviar uma resposta eu uso a função 'servicesLib.sendToQueueRPC' que recebe como parametro a fila para qual ele deve responder
    // e tambem recebe um json com a resposta
    await servicesLib.sendToQueueRPC(msg.properties.replyTo, { result: (msgJson.n1 + msgJson.n2), });
  }
});
// não necessariamente a resposta deve conter o campo result, isso varia de acordo com a implementação do microserviço

```
