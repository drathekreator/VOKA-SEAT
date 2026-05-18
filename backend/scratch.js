const mqtt = require('mqtt');
const client = mqtt.connect('mqtt://test.mosquitto.org');

client.on('connect', () => {
  console.log('Connected to broker. Sending mock telemetry...');
  
  // Seat 5 Occupied
  client.publish('vokafe/iot/telemetry', JSON.stringify({ id_kursi: 5, status: 1 }));
  
  // Seat 14 Occupied
  setTimeout(() => {
    client.publish('vokafe/iot/telemetry', JSON.stringify({ id_kursi: 14, status: 1 }));
  }, 1000);

  // Seat 24 Occupied
  setTimeout(() => {
    client.publish('vokafe/iot/telemetry', JSON.stringify({ id_kursi: 24, status: 1 }));
    client.end();
  }, 2000);
});
