const express = require('express');
const fetch = require('node-fetch');
const { RandomForestRegression } = require('ml-random-forest');
const simpleStats = require('simple-statistics');

const app = express();
const port = 3000;

const baseUrl = 'https://data-api.cryptocompare.com/index/cc/v1/historical/days';
const params = {
    market: "cadli",
    instrument: "BTC-BRL",
    limit: 90,
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

// Função para obter os dados históricos
async function fetchHistoricalData() {
    try {
        const response = await fetch(url, options);
        const data = await response.json();

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

// Função para calcular a média móvel exponencial (EMA)
function calculateEMA(data, period = 10) {
    let ema = [];
    let multiplier = 2 / (period + 1);
    let previousEMA = data[0].close;

    ema.push(previousEMA); // Primeira EMA é o primeiro valor de fechamento

    for (let i = 1; i < data.length; i++) {
        let currentEMA = (data[i].close - previousEMA) * multiplier + previousEMA;
        ema.push(currentEMA);
        previousEMA = currentEMA;
    }

    return ema;
}

// Função para treinar o modelo com Random Forest
async function trainModel(data) {
    const featureData = data.map(item => [item.timestamp, item.close]); // Features
    const targetData = data.map(item => item.close); // Target (preço)

    // Definindo as opções para o Random Forest
    const options = {
        numTrees: 100,
        maxDepth: 10,
        minSamplesPerLeaf: 5
    };

    // Criar o modelo de RandomForest
    const rf = new RandomForestRegression(options);  // Usando RandomForestRegression

    // Treinando o modelo com os dados
    rf.train(featureData, targetData);
    return rf;
}

// Função para prever os próximos preços com Random Forest e adicionar a tendência (alta/baixa)
async function predictNextPrices(model, data, numPredictions = 48) {
    const predictions = [];
    const currentTimestamp = Math.floor(Date.now() / 1000);  // Timestamp atual (em segundos)
    let previousPrice = data[data.length - 1].close; // Preço anterior para comparação

    for (let i = 1; i <= numPredictions; i++) {
        const nextTimestamp = currentTimestamp + i * 3600;  // Incrementando 1 hora (3600 segundos)
        const prediction = model.predict([[nextTimestamp, data[data.length - 1].close]]);
        
        // Verificando a tendência
        const trend = prediction[0] > previousPrice ? 'alta' : 'baixa';
        
        // Atualizando o preço anterior para a próxima iteração
        previousPrice = prediction[0];

        predictions.push({
            predictedDate: new Date(nextTimestamp * 1000).toLocaleDateString('pt-BR'),
            predictedHour: new Date(nextTimestamp * 1000).toLocaleTimeString('pt-BR', { hour12: false }),
            predictedPrice: prediction[0],
            trend: trend  // Incluindo o campo de tendência
        });
    }

    return predictions;
}

// Função para formatar preço
function formatPrice(price) {
    return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL',
        minimumFractionDigits: 2
    }).format(price);
}

app.get('/predict', async (req, res) => {
    let historicalData = await fetchHistoricalData();

    if (historicalData.length === 0) {
        return res.status(500).json({ message: 'Sem dados históricos válidos para treinar o modelo.' });
    }

    // Calcular a média móvel exponencial (EMA) para suavizar os dados
    historicalData = historicalData.map((item, idx, arr) => {
        item.ema = calculateEMA(arr, 10)[idx];  // Adicionando EMA aos dados históricos
        return item;
    });

    // Treinando o modelo Random Forest
    const model = await trainModel(historicalData);
    
    // Fazendo previsões para as próximas 48 horas (1 previsão por hora)
    const predictions = await predictNextPrices(model, historicalData, 48);

    res.json({
        message: 'Previsões para as próximas 48 horas',
        predictions: predictions.map(prediction => ({
            predictedDate: prediction.predictedDate,
            predictedHour: prediction.predictedHour,
            predictedPrice: formatPrice(prediction.predictedPrice),
            trend: prediction.trend  // Incluindo a tendência
        }))
    });
});

app.listen(port, () => {
    console.log(`Servidor rodando em http://localhost:${port}`);
});
