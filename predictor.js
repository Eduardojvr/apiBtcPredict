const express = require('express');  // Biblioteca para criar a API
const regression = require('regression');  // Biblioteca para regressão linear
const fetch = require('node-fetch'); // Importando a biblioteca node-fetch

const app = express();
const port = 3000;  // Porta onde a API irá rodar

const baseUrl = 'https://data-api.cryptocompare.com/index/cc/v1/historical/days';
const params = {
    market: "cadli",
    instrument: "BTC-BRL",
    limit: 30,  // Obter os últimos 30 dias
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

// Função para treinar o modelo de regressão linear
function trainModel(data) {
    // Convertendo para um formato adequado para a regressão (x: timestamp, y: preço de fechamento)
    const trainingData = data.map(item => [item.timestamp, item.close]);

    // Aplicando a regressão linear
    const result = regression.linear(trainingData);

    return result;
}

// Função para prever os próximos preços
function predictNextPrices(model, numPredictions = 24) {
    const predictions = [];
    const lastTimestamp = model.points[model.points.length - 1][0];

    // Gerar as previsões para as próximas 24 horas
    for (let i = 1; i <= numPredictions; i++) {
        const nextTimestamp = lastTimestamp + i * 3600; // Incrementando 1 hora (em segundos)
        const predictedPrice = model.predict(nextTimestamp)[1];  // Preço previsto

        // Converter o timestamp de previsão para formato legível (data e hora)
        const predictedDate = new Date(nextTimestamp * 1000);
        const predictedDay = predictedDate.toLocaleDateString('pt-BR');  // Formato dd/mm/yyyy
        const predictedHour = predictedDate.toLocaleTimeString('pt-BR', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: false
        });

        predictions.push({
            predictedDate,  // Data da previsão
            predictedHour,  // Hora da previsão
            predictedPrice  // Preço previsto
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

    const model = trainModel(historicalData);
    const predictions = predictNextPrices(model, 24);  // Alterado para 24 horas

    return res.json({
        message: 'Previsões para as próximas 24 horas',
        predictions
    });
});

// Rodar o servidor na porta 3000
app.listen(port, () => {
    console.log(`API rodando em http://localhost:${port}`);
});
