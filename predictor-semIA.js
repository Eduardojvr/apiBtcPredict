const axios = require('axios');

// Função para buscar os preços do histórico de Bitcoin
async function getBitcoinPrices() {
  try {
    const response = await axios.get('https://api.coindesk.com/v1/bpi/historical/close.json');
    const prices = Object.values(response.data.bpi);
    return prices;
  } catch (error) {
    console.error('Erro ao buscar os dados de preços:', error);
    return [];
  }
}

// Função para buscar a taxa de câmbio USD para BRL
async function getUSDBRLRate() {
  try {
    const response = await axios.get('https://api.exchangerate-api.com/v4/latest/USD');
    return response.data.rates.BRL; // Retorna a taxa de câmbio de USD para BRL
  } catch (error) {
    console.error('Erro ao buscar a taxa de câmbio:', error);
    return 1; // Retorna 1 como fallback em caso de erro, para evitar divisão por zero
  }
}

// Função para calcular médias móveis simples (SMA)
function calculateSMA(data, period) {
  let sma = [];
  for (let i = 0; i <= data.length - period; i++) {
    let sum = 0;
    for (let j = 0; j < period; j++) {
      sum += data[i + j];
    }
    sma.push(sum / period);
  }
  return sma;
}

// Função para gerar sinais preditivos de compra e venda
async function generateSignals() {
  const pricesUSD = await getBitcoinPrices();
  const usdToBrlRate = await getUSDBRLRate();
  
  if (pricesUSD.length === 0) {
    console.log('Nenhum dado de preço disponível.');
    return;
  }

  // Converte os preços de USD para BRL
  const pricesBRL = pricesUSD.map(price => price * usdToBrlRate);

  // Configuração dos parâmetros de médias móveis
  const shortPeriod = 5; // Curto prazo
  const longPeriod = 10; // Longo prazo

  // Calcula as médias móveis manualmente
  const shortSMA = calculateSMA(pricesBRL, shortPeriod);
  const longSMA = calculateSMA(pricesBRL, longPeriod);

  // Analisa os sinais de compra e venda com base nas médias móveis
  let signals = [];
  const offset = longPeriod - shortPeriod; // Ajusta o índice devido à diferença de tamanho dos arrays
  for (let i = 1; i < shortSMA.length; i++) {
    if (shortSMA[i] > longSMA[i - offset] && shortSMA[i - 1] <= longSMA[i - 1 - offset]) {
      signals.push({ signal: 'BUY', price: pricesBRL[i + longPeriod - 1], index: i });
    } else if (shortSMA[i] < longSMA[i - offset] && shortSMA[i - 1] >= longSMA[i - 1 - offset]) {
      signals.push({ signal: 'SELL', price: pricesBRL[i + longPeriod - 1], index: i });
    }
  }

  console.log('Sinais preditivos gerados (em BRL):', signals);
}

// Executa a função principal
generateSignals();
