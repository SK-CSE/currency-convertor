const express = require('express');
const path = require('path');
const axios = require('axios');
const redis = require('redis');
const bluebird = require("bluebird");
const app = express();

// connect to Redis
const REDIS_URL = process.env.REDIS_URL;
const client = redis.createClient(REDIS_URL,{
  no_ready_check: true,
  auth_pass: process.env.REDIS_PASS
});

// make node_redis promise compatible
bluebird.promisifyAll(redis.RedisClient.prototype);
bluebird.promisifyAll(redis.Multi.prototype);

client.on('connect', () => {
    console.log(`connected to redis`);
});
client.on('error', err => {
    console.log(`Error: ${err}`);
});

const API_URL = 'http://data.fixer.io/api';

app.get('/', (req, res) => {
  res.sendFile('index.html', {
    root: path.join(__dirname, 'views')
  });
});

app.get('/rate/:date', (req, res) => {
  const date = req.params.date;
  const url = `${API_URL}/${date}?access_key=${process.env.ACCESS_KEY}`;

  const countKey = `EUR:${date}:count`;
  const ratesKey = `EUR:${date}:rates`;

  let count;
  client
    .incrAsync(countKey)
    .then(result => {
      count = result;
      return count;
    })
    .then(() => client.hgetallAsync(ratesKey))
    .then(rates => {
      if (rates) {
        return res.json({ rates, count });
      }

      axios.get(url).then(response => {
        client
          .hmsetAsync(ratesKey, response.data.rates)
          .catch(e => {
            console.log(e)
          });

        return res.json({ 
          count, 
          rates: response.data.rates
        });
      }).catch(error => res.json(error.response.data))

    })
    .catch(e => {
      console.log(e)
    });

});

const port = process.env.PORT || 5000;

app.listen(port, () => {
  console.log(`App listening on port ${port}!`)
});