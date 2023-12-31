import express from 'express';

import amqp, { Channel } from 'amqplib';

import axios from 'axios';

if (!process.env.PORT) {
  throw new Error(
    'Please specify the port number for the HTTP server with the environment variable PORT.',
  );
}

if (!process.env.RABBIT) {
  throw new Error(
    'Please specify the name of the RabbitMQ host using environment variable RABBIT',
  );
}

const { PORT } = process.env;
const { RABBIT } = process.env;

//
// Application entry point.
//
async function main() {
  const connection = await amqp.connect(RABBIT); // Connects to the RabbitMQ server.

  const messageChannel = await connection.createChannel(); // Creates a RabbitMQ messaging channel.

  await messageChannel.assertExchange('viewed', 'fanout'); // Asserts that we have a "viewed" exchange.

  //
  // Broadcasts the "viewed" message to other microservices.
  //
  function broadcastViewedMessage(channel: Channel, videoId: string) {
    console.log(`Publishing message on "viewed" exchange!`);

    const msg = { video: { id: videoId } };
    const jsonMsg = JSON.stringify(msg);
    channel.publish('viewed', '', Buffer.from(jsonMsg)); // Publishes message to the "viewed" exchange.
  }

  const app = express();

  app.get('/video', async (req, res) => {
    // Route for streaming video.

    const videoId = req.query.id as string;
    const response = await axios({
      // Forwards the request to the video-storage microservice.
      method: 'GET',
      url: `http://video-storage/video?id=${videoId}`,
      data: req,
      responseType: 'stream',
    });
    response.data.pipe(res);

    broadcastViewedMessage(messageChannel, videoId); // Sends the "viewed" message to indicate this video has been watched.
  });

  app.listen(PORT, () => {
    // Starts the HTTP server.
    console.log(`Microservice online.....    ${PORT}`);
  });
}

main().catch((err) => {
  console.error('Microservice failed to start.');
  console.error((err && err.stack) || err);
});
