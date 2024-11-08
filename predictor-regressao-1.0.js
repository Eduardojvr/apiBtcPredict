const regression = require('regression');  // Biblioteca para regressão linear
const fetch = require('node-fetch'); // Importando a biblioteca node-fetch

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

    console.log("Modelo de regressão linear:", result);

    return result;
}

// Função para prever os próximos preços
function predictNextPrices(model, numPredictions = 12) {
    const predictions = [];
    const lastTimestamp = model.points[model.points.length - 1][0];

    // Gerar as previsões para as próximas 12 horas
    for (let i = 1; i <= numPredictions; i++) {
        const nextTimestamp = lastTimestamp + i * 3600; // Incrementando 1 hora (em segundos)
        const predictedPrice = model.predict(nextTimestamp)[1];  // Preço previsto

        predictions.push({
            hour: i + 30,  // Considerando as próximas 12 horas a partir do último ponto (30 já representaria o último dia)
            predictedPrice
        });
    }

    return predictions;
}

// Função principal para rodar o processo
async function run() {
    const historicalData = await fetchHistoricalData();

    if (historicalData.length === 0) {
        console.log('Sem dados históricos válidos para treinar o modelo.');
        return;
    }

    const model = trainModel(historicalData);
    const predictions = predictNextPrices(model);

    console.log('Previsões para as próximas 12 horas:', predictions);
}

// Rodar o processo
run();
