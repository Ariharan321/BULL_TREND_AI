// prediction.js - Technical Stock Projection Engine

/**
 * Calculates Simple Moving Average
 */
function calculateSMA(prices, period) {
  if (prices.length < period) return null;
  let sum = 0;
  for (let i = prices.length - period; i < prices.length; i++) {
    sum += prices[i];
  }
  return sum / period;
}

/**
 * Calculates Relative Strength Index (RSI 14)
 */
function calculateRSI(prices, period = 14) {
  if (prices.length < period + 1) return null;
  let gains = 0;
  let losses = 0;
  
  for (let i = prices.length - period; i < prices.length; i++) {
    const diff = prices[i] - prices[i - 1];
    if (diff >= 0) {
      gains += diff;
    } else {
      losses -= diff;
    }
  }
  
  const avgGain = gains / period;
  const avgLoss = losses / period;
  
  if (gains === 0 && losses === 0) return 50;
  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - (100 / (1 + rs));
}

/**
 * Calculates Linear Regression Slope and Intercept
 */
function calculateRegression(prices) {
  const n = prices.length;
  if (n < 3) return null;
  
  let sumX = 0;
  let sumY = 0;
  let sumXY = 0;
  let sumXX = 0;
  
  for (let i = 0; i < n; i++) {
    sumX += i;
    sumY += prices[i];
    sumXY += i * prices[i];
    sumXX += i * i;
  }
  
  const denominator = n * sumXX - sumX * sumX;
  if (denominator === 0) return null;
  
  const slope = (n * sumXY - sumX * sumY) / denominator;
  const intercept = (sumY - slope * sumX) / n;
  
  return { slope, intercept };
}

/**
 * Calculates Historical Volatility (Standard Deviation of Log Returns)
 */
function calculateVolatility(prices) {
  if (prices.length < 5) return null;
  const logReturns = [];
  
  for (let i = 1; i < prices.length; i++) {
    if (prices[i - 1] > 0 && prices[i] > 0) {
      logReturns.push(Math.log(prices[i] / prices[i - 1]));
    }
  }
  
  if (logReturns.length < 2) return null;
  
  const mean = logReturns.reduce((sum, val) => sum + val, 0) / logReturns.length;
  const variance = logReturns.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / (logReturns.length - 1);
  return Math.sqrt(variance);
}

/**
 * Generates predictions and technical signal analyses for the stock
 * @param {Object} quote Current stock quote object
 * @param {Array} chartPoints Historic chart points {time, price}
 * @param {number} days Target projection horizon in days (7, 30, or 90)
 */
function runStockPrediction(quote, chartPoints, days = 30) {
  const generatedAt = new Date().toISOString();
  const prices = chartPoints.map(p => p.price).filter(p => p > 0);
  const currentPrice = quote.price;
  
  const horizonLabels = {
    7: "7 days",
    30: "30 days",
    90: "90 days"
  };
  const horizonLabel = horizonLabels[days] || `${days} days`;

  // Standard fallback if there is not enough history
  if (prices.length < 5) {
    return {
      symbol: quote.symbol,
      currentPrice: currentPrice,
      predictedPrice: currentPrice,
      expectedChange: 0,
      confidence: 50,
      direction: "flat",
      horizonLabel: horizonLabel,
      rangeLow: currentPrice * 0.95,
      rangeHigh: currentPrice * 1.05,
      signals: [
        {
          name: "Data Sufficiency",
          value: "Insufficient",
          verdict: "neutral",
          detail: "Not enough price history to compute technical metrics."
        }
      ],
      reliable: false,
      generatedAt: generatedAt
    };
  }

  // 1. Linear regression trend projection
  const recentPoints = prices.slice(-Math.min(prices.length, 60));
  const regression = calculateRegression(recentPoints);
  const slope = regression ? regression.slope : 0;
  
  // Apply a decay factor to long-term projections to keep them realistic
  const decay = days > 30 ? 1.0 : (days > 10 ? 0.3 : 0.15);
  const trendAdjustment = slope * days * decay;
  let predictedPrice = currentPrice + trendAdjustment;

  // 2. Relative Strength Index (RSI 14) Mean Reversion Adjustment
  const rsi = calculateRSI(prices, 14);
  let rsiAdjustment = 0;
  if (rsi !== null) {
    if (rsi > 70) {
      // Overbought -> expect a downward drag
      rsiAdjustment = -currentPrice * 0.015;
    } else if (rsi < 30) {
      // Oversold -> expect an upward bounce
      rsiAdjustment = currentPrice * 0.015;
    }
  }
  predictedPrice += rsiAdjustment;

  // 3. Simple Moving Average Alignment
  const sma20 = calculateSMA(prices, Math.min(20, prices.length));
  const sma50 = calculateSMA(prices, Math.min(50, prices.length));
  let smaAdjustment = 0;
  if (sma20 !== null && sma50 !== null) {
    if (sma20 > sma50) {
      // Bullish alignment
      smaAdjustment = currentPrice * 0.005;
    } else {
      // Bearish alignment
      smaAdjustment = -currentPrice * 0.005;
    }
  }
  predictedPrice += smaAdjustment;

  // Cap predictions to +/- 25% of current price to stay reasonable
  const maxChangeBound = currentPrice * 0.25;
  predictedPrice = Math.max(currentPrice - maxChangeBound, Math.min(currentPrice + maxChangeBound, predictedPrice));
  predictedPrice = Number(predictedPrice.toFixed(2));

  // Compute expected change metrics
  const expectedChange = Number(((predictedPrice - currentPrice) / currentPrice * 100).toFixed(2));
  const direction = Math.abs(expectedChange) < 0.5 ? "flat" : (expectedChange > 0 ? "up" : "down");

  // 4. Calculate Confidence Score
  let confidence = 50;
  if (regression) {
    // High slope relative to price increases confidence in the trend
    const strength = Math.min(1.0, Math.abs(slope * recentPoints.length) / (currentPrice * 0.1));
    confidence += strength * 15;
  }
  // Data history multiplier
  confidence += Math.min(15, prices.length / 100 * 15);
  if (rsi !== null) confidence += 5;
  if (sma20 !== null && sma50 !== null) confidence += 5;
  confidence = Math.max(35, Math.min(88, Math.round(confidence)));

  // 5. High/Low Volatility Confidence Bands (Standard Deviation * sqrt(horizon))
  const vol = calculateVolatility(prices);
  const multiplier = vol !== null ? (vol * Math.sqrt(days) * 2.0) : 0.06;
  const rangeLow = Number((Math.min(currentPrice, predictedPrice) * (1 - multiplier)).toFixed(2));
  const rangeHigh = Number((Math.max(currentPrice, predictedPrice) * (1 + multiplier)).toFixed(2));

  // 6. Build Technical Signals
  const signals = [];
  
  if (regression) {
    const slopePct = slope / currentPrice;
    const trendVerdict = slopePct > 0.0005 ? "bullish" : (slopePct < -0.0005 ? "bearish" : "neutral");
    signals.push({
      name: "Trend (Linear Regression)",
      value: slope >= 0 ? "Upward" : "Downward",
      verdict: trendVerdict,
      detail: `Slope ${slope >= 0 ? '+' : ''}${slope.toFixed(4)} per session over last ${recentPoints.length} trading data points.`
    });
  }

  if (rsi !== null) {
    const rsiVerdict = rsi > 70 ? "bearish" : (rsi < 30 ? "bullish" : "neutral");
    signals.push({
      name: "RSI (14)",
      value: rsi.toFixed(1),
      verdict: rsiVerdict,
      detail: rsi > 70 ? "Overbought zone — momentum may consolidate downwards." : 
              (rsi < 30 ? "Oversold zone — oversold condition favors rebound." : "Neutral momentum zone.")
    });
  }

  if (sma20 !== null && sma50 !== null) {
    const isBullish = sma20 > sma50;
    signals.push({
      name: "MA Alignment (20/50)",
      value: isBullish ? "Bullish" : "Bearish",
      verdict: isBullish ? "bullish" : "bearish",
      detail: `SMA20 is aligned ${isBullish ? 'above' : 'below'} SMA50.`
    });
  }

  if (vol !== null) {
    const volVerdict = vol > 0.04 ? "bearish" : "neutral";
    signals.push({
      name: "Volatility",
      value: `${(vol * 100).toFixed(1)}%`,
      verdict: volVerdict,
      detail: vol > 0.04 ? "Elevated volatility expands confidence bands." : "Moderate/stable volatility index."
    });
  }

  return {
    symbol: quote.symbol,
    currentPrice: currentPrice,
    predictedPrice: predictedPrice,
    expectedChange: expectedChange,
    confidence: confidence,
    direction: direction,
    horizonLabel: horizonLabel,
    rangeLow: rangeLow,
    rangeHigh: rangeHigh,
    signals: signals,
    reliable: true,
    generatedAt: generatedAt
  };
}
