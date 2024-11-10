const express = require('express');  // Biblioteca para criar a API
const fetch = require('node-fetch'); // Importando a biblioteca node-fetch
const tf = require('@tensorflow/tfjs-node'); // TensorFlow.js para Node.js

const app = express();
const port = 3000;  // Porta onde a API irá rodar

const baseUrl = 'https://data-api.cryptocompare.com/index/cc/v1/historical/days';
const params = {
    market: "cadli",
    instrument: "BTC-BRL",
    limit: 365,  // Obter os últimos 365 dias
    aggregate: 1,
    fill: "true",
    apply_mapping: "true",
    response_format: "JSON",
    api_key: "831a9a92cc46895c362ffba0b56449fe60851e73ac05b17d3fc7a967416dbd09"
};

const url = new URL(baseUrl);
url.search = new URLSearchParams(params).toString();

const options = {
    method: 'GET',
    headers: { "Content-type": "application/json; charset=UTF-8" },
};

// Função para buscar os dados históricos
async function fetchHistoricalData() {
    try {
        const response = await fetch(url, options);
        const data = await response.json();

        // Verificar se a resposta contém dados
        if (data.Data && data.Data.length > 0) {
            return data.Data.map(item => ({
                timestamp: item.TIMESTAMP,
                close: item.CLOSE
            }));
        } else {
            throw new Error('Dados históricos não encontrados ou inválidos.');
        }
    } catch (error) {
        console.error('Erro ao obter dados históricos:', error);
        return [];
    }
}

// Função para treinar o modelo usando TensorFlow.js
async function trainModel(data) {
    // Normalizando os timestamps
    const timestamps = data.map(item => item.timestamp);
    const maxTimestamp = Math.max(...timestamps);
    const normalizedTimestamps = timestamps.map(ts => ts / maxTimestamp);

    const prices = data.map(item => item.close);
    const maxPrice = Math.max(...prices);
    const normalizedPrices = prices.map(price => price / maxPrice);

    const xs = tf.tensor2d(normalizedTimestamps, [normalizedTimestamps.length, 1]);
    const ys = tf.tensor2d(normalizedPrices, [normalizedPrices.length, 1]);

    // Criando um modelo sequencial com uma camada densa (regressão linear simples)
    const model = tf.sequential();
    model.add(tf.layers.dense({ units: 1, inputShape: [1] }));
    model.compile({ optimizer: 'sgd', loss: 'meanSquaredError' });

    // Treinando o modelo
    await model.fit(xs, ys, { epochs: 500 });

    return { model, maxTimestamp, maxPrice };
}

// Função para prever os próximos preços
async function predictNextPrices(trainedModel, lastTimestamp, numPredictions = 24) {
    const { model, maxTimestamp, maxPrice } = trainedModel;
    const predictions = [];

    for (let i = 1; i <= numPredictions; i++) {
        const nextTimestamp = (lastTimestamp + i * 3600) / maxTimestamp; // Normalizando

        const inputTensor = tf.tensor2d([nextTimestamp], [1, 1]);
        const predictedPriceTensor = model.predict(inputTensor);
        const predictedPriceNormalized = (await predictedPriceTensor.data())[0];

        const predictedPrice = predictedPriceNormalized * maxPrice; // Revertendo a normalização

        const predictedDate = new Date((lastTimestamp + i * 3600) * 1000);
        const predictedDay = predictedDate.toLocaleDateString('pt-BR');
        const predictedHour = predictedDate.toLocaleTimeString('pt-BR', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: false
        });

        predictions.push({
            predictedDate,
            predictedHour,
            predictedPrice
        });
    }

    return predictions;
}

// Rota para obter as previsões das próximas 24 horas
app.get('/predict', async (req, res) => {
    const historicalData = await fetchHistoricalData();

    if (historicalData.length === 0) {
        return res.status(400).json({ message: 'Sem dados históricos válidos para treinar o modelo.' });
    }

    const trainedModel = await trainModel(historicalData);
    const lastTimestamp = historicalData[historicalData.length - 1].timestamp;
    const predictions = await predictNextPrices(trainedModel, lastTimestamp, 24);  // Alterado para 24 horas

    return res.json({
        message: 'Previsões para as próximas 24 horas',
        predictions
    });
});

// Rodar o servidor na porta 3000
app.listen(port, () => {
    console.log(`API rodando em http://localhost:${port}`);
});
