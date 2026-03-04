function linearRegression(x, y) {
  const n = x.length;

  const mean = arr => arr.reduce((a, b) => a + b, 0) / arr.length;
  const xBar = mean(x);
  const yBar = mean(y);

  let Sxx = 0, Sxy = 0, Syy = 0;
  for (let i = 0; i < n; i++) {
    const dx = x[i] - xBar;
    const dy = y[i] - yBar;
    Sxx += dx * dx;
    Sxy += dx * dy;
    Syy += dy * dy;
  }

  const slope = Sxy / Sxx;
  const intercept = yBar - slope * xBar;

  // Predictions + residuals
  const yHat = x.map(v => intercept + slope * v);
  let SSE = 0; // sum of squared errors
  for (let i = 0; i < n; i++) {
    const e = y[i] - yHat[i];
    SSE += e * e;
  }
  const SST = Syy;
  const SSR = SST - SSE;

  const r2 = SST === 0 ? 1 : SSR / SST;

  // Standard error of regression: sqrt(SSE/(n-2))
  const se = Math.sqrt(SSE / (n - 2));

  // Standard errors of coefficients:
  // se(slope) = se / sqrt(Sxx)
  // se(intercept) = se * sqrt(1/n + xBar^2/Sxx)
  const seSlope = se / Math.sqrt(Sxx);
  const seIntercept = se * Math.sqrt((1 / n) + (xBar * xBar) / Sxx);

  const tSlope = slope / seSlope;
  const tIntercept = intercept / seIntercept;

  return {
    n,
    coefficients: {
      intercept,
      slope
    },
    metrics: {
      r2,
      standardError: se,
      SSE,
      SSR,
      SST
    },
    coefficientTable: [
      { term: "Intercept", estimate: intercept, stdError: seIntercept, t: tIntercept },
      { term: "X", estimate: slope, stdError: seSlope, t: tSlope }
    ]
  };
}

module.exports = { linearRegression };