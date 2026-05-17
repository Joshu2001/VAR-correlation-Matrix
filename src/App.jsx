import React, { useState, useMemo } from 'react';
import {
  Activity,
  Cpu,
  AlertTriangle,
  Plus,
  Trash2,
  Zap,
  Brain,
  HelpCircle,
  ChevronDown,
  ChevronUp,
  Info
} from 'lucide-react';

const Tooltip = ({ text, children, hideIcon }) => (
  <div className="group relative inline-flex items-center gap-1.5 cursor-help">
    {children}
    {!hideIcon && <Info className="w-3.5 h-3.5 text-slate-400 hover:text-indigo-500 transition-colors" />}
    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-56 p-3 bg-slate-800 text-slate-50 text-xs rounded-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50 shadow-xl font-normal normal-case tracking-normal leading-relaxed text-center pointer-events-none">
      {text}
      <div className="absolute top-full left-1/2 -translate-x-1/2 border-[6px] border-transparent border-t-slate-800"></div>
    </div>
  </div>
);

const INITIAL_ASSETS = ['SPY', 'TLT', 'GLD', 'CASH'];

const ASSET_INFO = {
  SPY: 'SPDR S&P 500 ETF Trust',
  TLT: 'iShares 20+ Year Treasury Bond ETF',
  GLD: 'SPDR Gold Shares',
  CASH: 'US Dollar Cash'
};

const INITIAL_VOLATILITIES = {
  SPY: 0.16,
  TLT: 0.12,
  GLD: 0.15,
  CASH: 0.01
};

const INITIAL_CORRELATION_MATRIX = {
  SPY: { SPY: 1.0, TLT: -0.35, GLD: 0.05, CASH: 0.0 },
  TLT: { SPY: -0.35, TLT: 1.0, GLD: 0.15, CASH: 0.0 },
  GLD: { SPY: 0.05, TLT: 0.15, GLD: 1.0, CASH: 0.0 },
  CASH: { SPY: 0.0, TLT: 0.0, GLD: 0.0, CASH: 1.0 }
};

const CONFIDENCE_LEVELS = {
  '90%': { z: 1.282, pdf: 0.1758, alpha: 0.9 },
  '95%': { z: 1.645, pdf: 0.1031, alpha: 0.95 },
  '99%': { z: 2.326, pdf: 0.0267, alpha: 0.99 }
};

const STRESS_SCENARIOS = {
  '2008 Crash': { SPY: -0.5, TLT: 0.25, GLD: 0.05, CASH: 0.0 },
  'COVID Shock': { SPY: -0.34, TLT: 0.12, GLD: -0.05, CASH: 0.0 },
  '2022 Rate Hike': { SPY: -0.19, TLT: -0.29, GLD: -0.01, CASH: 0.02 },
  'Dot-Com Bubble': { SPY: -0.49, TLT: 0.15, GLD: -0.05, CASH: 0.05 },
  'Black Monday (1987)': { SPY: -0.22, TLT: 0.05, GLD: 0.02, CASH: 0.0 },
  '2011 Debt Downgrade': { SPY: -0.16, TLT: 0.1, GLD: 0.12, CASH: 0.0 }
};

const EXPECTED_RETURNS = {
  SPY: 0.09,
  TLT: 0.04,
  GLD: 0.05,
  CASH: 0.02
};

export default function App() {
  const [assets, setAssets] = useState(INITIAL_ASSETS);
  const [volatilities, setVolatilities] = useState(INITIAL_VOLATILITIES);
  const [correlationMatrix, setCorrelationMatrix] = useState(INITIAL_CORRELATION_MATRIX);
  const [showHelp, setShowHelp] = useState(true);

  const [newTicker, setNewTicker] = useState('');
  const [newVol, setNewVol] = useState(15);

  const [weights, setWeights] = useState({
    SPY: 60,
    TLT: 30,
    GLD: 5,
    CASH: 5
  });

  const [confidence, setConfidence] = useState('95%');
  const portfolioValue = 1000000;
  const [selectedScenario, setSelectedScenario] = useState('2008 Crash');

  const handleAddAsset = () => {
    if (!newTicker || assets.includes(newTicker.toUpperCase())) return;
    const ticker = newTicker.toUpperCase();

    setAssets([...assets, ticker]);
    setVolatilities({ ...volatilities, [ticker]: newVol / 100 });

    const newMatrix = { ...correlationMatrix };
    newMatrix[ticker] = { [ticker]: 1.0 };
    assets.forEach((a) => {
      newMatrix[a][ticker] = 0.0;
      newMatrix[ticker][a] = 0.0;
    });
    setCorrelationMatrix(newMatrix);

    setWeights({ ...weights, [ticker]: 0 });
    setNewTicker('');
  };

  const handleRemoveAsset = (tickerToRemove) => {
    const newAssets = assets.filter((a) => a !== tickerToRemove);
    setAssets(newAssets);

    const newVol = { ...volatilities };
    delete newVol[tickerToRemove];
    setVolatilities(newVol);

    const newMatrix = { ...correlationMatrix };
    delete newMatrix[tickerToRemove];
    newAssets.forEach((a) => {
      delete newMatrix[a][tickerToRemove];
    });
    setCorrelationMatrix(newMatrix);

    const weightToDistribute = weights[tickerToRemove] || 0;
    const newWeights = { ...weights };
    delete newWeights[tickerToRemove];

    if (newAssets.length > 0 && weightToDistribute > 0) {
      const evenSplit = weightToDistribute / newAssets.length;
      newAssets.forEach((a) => {
        newWeights[a] += evenSplit;
      });
    }
    setWeights(newWeights);
  };

  const handleWeightChange = (asset, newWeightStr) => {
    const newWeight = parseFloat(newWeightStr) || 0;
    if (newWeight < 0 || newWeight > 100) return;

    setWeights((prev) => {
      const diff = newWeight - (prev[asset] || 0);
      const otherAssets = assets.filter((a) => a !== asset);

      if (otherAssets.length === 0) return { [asset]: 100 };

      const newWeights = { ...prev, [asset]: newWeight };
      let remainingToDistribute = -diff;

      const totalOtherWeights = otherAssets.reduce((sum, a) => sum + (prev[a] || 0), 0);

      if (totalOtherWeights > 0) {
        otherAssets.forEach((a) => {
          const currentOtherWeight = prev[a] || 0;
          const proportion = currentOtherWeight / totalOtherWeights;
          let amountToChange = diff * proportion;

          if (newWeights[a] - amountToChange < 0) {
            amountToChange = newWeights[a];
          }
          newWeights[a] -= amountToChange;
          remainingToDistribute += amountToChange;
        });
      }

      if (Math.abs(remainingToDistribute) > 0.01) {
        const evenSplit = remainingToDistribute / otherAssets.length;
        otherAssets.forEach((a) => {
          newWeights[a] = Math.max(0, (newWeights[a] || 0) + evenSplit);
        });
      }

      const sum = Object.values(newWeights).reduce((a, b) => a + b, 0);
      if (Math.abs(sum - 100) > 0.1 && otherAssets.length > 0) {
        newWeights[otherAssets[0]] += 100 - sum;
      }

      return newWeights;
    });
  };

  const updateCorrelation = (asset1, asset2, value) => {
    const val = parseFloat(value);
    if (isNaN(val) || val < -1 || val > 1) return;

    setCorrelationMatrix((prev) => ({
      ...prev,
      [asset1]: { ...prev[asset1], [asset2]: val },
      [asset2]: { ...prev[asset2], [asset1]: val }
    }));
  };

  const metrics = useMemo(() => {
    let portfolioVariance = 0;
    let weightedAverageVol = 0;
    let expectedReturn = 0;

    const w = assets.map((a) => (weights[a] || 0) / 100);
    const v = assets.map((a) => volatilities[a]);

    for (let i = 0; i < assets.length; i++) {
      weightedAverageVol += w[i] * v[i];
      const ret = EXPECTED_RETURNS[assets[i]] !== undefined ? EXPECTED_RETURNS[assets[i]] : 0.06;
      expectedReturn += w[i] * ret;

      for (let j = 0; j < assets.length; j++) {
        const correlation = correlationMatrix[assets[i]]?.[assets[j]] || 0;
        const covariance = correlation * v[i] * v[j];
        portfolioVariance += w[i] * w[j] * covariance;
      }
    }

    const portfolioVol = Math.sqrt(portfolioVariance);

    const riskFreeRate = 0.02;
    const sharpeRatio = portfolioVol > 0 ? (expectedReturn - riskFreeRate) / portfolioVol : 0;

    const downsideDeviation = portfolioVol / Math.sqrt(2);
    const sortinoRatio = downsideDeviation > 0 ? (expectedReturn - riskFreeRate) / downsideDeviation : 0;

    const divBenefit =
      weightedAverageVol > 0 ? ((weightedAverageVol - portfolioVol) / weightedAverageVol) * 100 : 0;

    const dailyVol = portfolioVol / Math.sqrt(252);

    const confParams = CONFIDENCE_LEVELS[confidence];
    const dailyVaR = portfolioValue * dailyVol * confParams.z;

    const cvarMultiplier = confParams.pdf / (1 - confParams.alpha);
    const dailyCVaR = portfolioValue * dailyVol * cvarMultiplier;

    const isHighRisk = dailyVaR / portfolioValue > 0.05;

    return {
      portfolioVolatility: (portfolioVol * 100).toFixed(2),
      dailyVaR,
      dailyCVaR,
      divBenefit: divBenefit.toFixed(1),
      isHighRisk,
      weightedAverageVol: (weightedAverageVol * 100).toFixed(2),
      sharpeRatio: sharpeRatio.toFixed(2),
      sortinoRatio: sortinoRatio.toFixed(2)
    };
  }, [assets, weights, volatilities, correlationMatrix, confidence]);

  const stressTestImpact = useMemo(() => {
    const scenario = STRESS_SCENARIOS[selectedScenario];
    let impact = 0;
    assets.forEach((asset) => {
      const assetWeight = (weights[asset] || 0) / 100;
      const assetReturn = scenario[asset] || 0;
      impact += assetWeight * assetReturn;
    });
    return impact * 100;
  }, [assets, weights, selectedScenario]);

  return (
    <div className="min-h-screen bg-[#F8F9FA] text-slate-900 font-sans p-4 md:p-8 selection:bg-indigo-100">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between pb-4 gap-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-indigo-600 rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-200">
              <Brain className="w-7 h-7 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
                Gia <span className="text-slate-400 font-normal">Risk</span>
              </h1>
              <p className="text-xs font-semibold text-slate-400 tracking-widest uppercase mt-1">
                Portfolio Intelligence
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4 bg-white p-2 rounded-2xl shadow-sm border border-slate-100">
            <Tooltip text="Sets the probability level for the risk calculation. A 95% confidence means there's only a 5% chance daily losses will exceed the VaR estimate.">
              <span className="text-xs font-bold text-slate-400 uppercase pl-2">Confidence</span>
            </Tooltip>
            <div className="flex gap-1">
              {Object.keys(CONFIDENCE_LEVELS).map((lvl) => (
                <button
                  key={lvl}
                  onClick={() => setConfidence(lvl)}
                  className={`px-4 py-2 text-sm font-semibold rounded-xl transition-all ${
                    confidence === lvl
                      ? 'bg-indigo-600 text-white shadow-md shadow-indigo-200'
                      : 'text-slate-500 hover:bg-slate-50'
                  }`}
                >
                  {lvl}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden mb-2">
          <button
            onClick={() => setShowHelp(!showHelp)}
            className="w-full flex items-center justify-between p-4 bg-indigo-50/50 hover:bg-indigo-50 transition-colors"
          >
            <div className="flex items-center gap-2">
              <HelpCircle className="w-5 h-5 text-indigo-600" />
              <span className="font-bold text-indigo-900 text-sm tracking-wide uppercase">
                How to use this tool
              </span>
            </div>
            {showHelp ? (
              <ChevronUp className="w-5 h-5 text-indigo-400" />
            ) : (
              <ChevronDown className="w-5 h-5 text-indigo-400" />
            )}
          </button>

          {showHelp && (
            <div className="p-6 border-t border-slate-100 grid grid-cols-1 md:grid-cols-3 gap-6 bg-white">
              <div>
                <h4 className="font-bold text-slate-800 text-sm mb-2 flex items-center gap-2">
                  1. Set Allocation
                </h4>
                <p className="text-sm text-slate-600 leading-relaxed">
                  Adjust the sliders to build your portfolio (e.g., mixing Stocks and Treasury Bonds). The
                  tool balances weights to 100%. Watch the top KPIs update in real-time.
                </p>
              </div>
              <div>
                <h4 className="font-bold text-slate-800 text-sm mb-2 flex items-center gap-2">
                  2. Check Correlations
                </h4>
                <p className="text-sm text-slate-600 leading-relaxed">
                  The Matrix shows how assets move together. Negative numbers (like SPY and TLT) mean they
                  act as natural hedges, significantly reducing your overall portfolio risk.
                </p>
              </div>
              <div>
                <h4 className="font-bold text-slate-800 text-sm mb-2 flex items-center gap-2">
                  3. Stress Test
                </h4>
                <p className="text-sm text-slate-600 leading-relaxed">
                  Click on historical scenarios (like the 2008 Crash) to see how your specific allocation
                  would have performed during major market panic events.
                </p>
              </div>
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <div
            className={`relative bg-white border rounded-[2rem] p-6 shadow-sm transition-all duration-500 ${
              metrics.isHighRisk
                ? 'border-l-4 border-l-rose-500 border-rose-200 bg-rose-50'
                : 'border-slate-100'
            }`}
          >
            {metrics.isHighRisk && (
              <div className="absolute top-6 right-6">
                <AlertTriangle className="w-5 h-5 text-rose-500" />
              </div>
            )}
            <div className="mb-2">
              <Tooltip text="Value at Risk: The maximum expected loss over 1 trading day at your selected confidence level.">
                <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  1-Day VaR ({confidence})
                </div>
              </Tooltip>
            </div>
            <div
              className={`text-3xl font-bold font-mono tracking-tight ${
                metrics.isHighRisk ? 'text-rose-600' : 'text-slate-900'
              }`}
            >
              ${metrics.dailyVaR.toLocaleString(undefined, {
                minimumFractionDigits: 0,
                maximumFractionDigits: 0
              })}
            </div>
          </div>

          <div className="bg-white border border-slate-100 rounded-[2rem] p-6 shadow-sm">
            <div className="mb-2">
              <Tooltip text="Conditional VaR (Expected Shortfall): The average expected loss IF the VaR threshold is breached. Measures extreme 'tail risk'.">
                <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  Exp. Shortfall (CVaR)
                </div>
              </Tooltip>
            </div>
            <div className="text-3xl font-bold font-mono tracking-tight text-slate-900">
              ${metrics.dailyCVaR.toLocaleString(undefined, {
                minimumFractionDigits: 0,
                maximumFractionDigits: 0
              })}
            </div>
          </div>

          <div className="bg-white border border-slate-100 rounded-[2rem] p-6 shadow-sm">
            <div className="mb-2">
              <Tooltip text="The annualized standard deviation of the portfolio's returns. Higher volatility means larger potential price swings.">
                <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  Portfolio Volatility (sigma)
                </div>
              </Tooltip>
            </div>
            <div className="text-3xl font-bold font-mono tracking-tight text-indigo-600">
              {metrics.portfolioVolatility}%
            </div>
          </div>

          <div className="bg-white border border-slate-100 rounded-[2rem] p-6 shadow-sm">
            <div className="mb-2">
              <Tooltip text="The percentage of risk eliminated by holding assets that do not perfectly correlate (move in tandem) with each other.">
                <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  Diversification Benefit
                </div>
              </Tooltip>
            </div>
            <div className="text-3xl font-bold font-mono tracking-tight text-emerald-500">
              {metrics.divBenefit}%
            </div>
          </div>

          <div className="bg-white border border-slate-100 rounded-[2rem] p-6 shadow-sm">
            <div className="mb-2">
              <Tooltip text="Measures risk-adjusted return. (Expected Return - Risk-Free Rate) / Volatility. A higher ratio indicates better performance for the risk taken.">
                <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  Sharpe Ratio
                </div>
              </Tooltip>
            </div>
            <div className="text-3xl font-bold font-mono tracking-tight text-indigo-600">
              {metrics.sharpeRatio}
            </div>
          </div>

          <div className="bg-white border border-slate-100 rounded-[2rem] p-6 shadow-sm">
            <div className="mb-2">
              <Tooltip text="Similar to the Sharpe Ratio, but only penalizes downside volatility. A higher ratio indicates better protection against negative swings.">
                <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  Sortino Ratio
                </div>
              </Tooltip>
            </div>
            <div className="text-3xl font-bold font-mono tracking-tight text-indigo-600">
              {metrics.sortinoRatio}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="space-y-4">
            <div className="flex items-center gap-2 mb-2 px-2">
              <Activity className="w-5 h-5 text-indigo-600" />
              <h3 className="text-sm font-bold text-slate-600 uppercase tracking-wider">Asset Allocation</h3>
              <span className="ml-auto text-xs font-bold text-indigo-600 bg-indigo-50 px-3 py-1 rounded-full">
                Sum: 100%
              </span>
            </div>

            <div className="space-y-3 max-h-[450px] overflow-y-auto custom-scrollbar pr-2 pb-10">
              {assets.map((asset) => (
                <div
                  key={asset}
                  className="group relative bg-white p-5 rounded-[2rem] shadow-sm border border-slate-100 hover:shadow-md transition-all"
                >
                  <button
                    onClick={() => handleRemoveAsset(asset)}
                    className="absolute right-4 top-4 p-2 bg-rose-50 text-rose-500 rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-rose-100"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>

                  <div className="flex justify-between items-start mb-4">
                    <div className="flex flex-col gap-2">
                      <span className="text-xl font-bold text-slate-900">
                        {ASSET_INFO[asset] ? `${ASSET_INFO[asset]} (${asset})` : asset}
                      </span>
                      <div className="flex items-center gap-2">
                        <Tooltip
                          text="Annualized volatility (standard deviation) for this specific asset. Edit to simulate riskier market environments."
                          hideIcon={true}
                        >
                          <div className="flex items-center gap-1 bg-indigo-50 px-3 py-1 rounded-full text-[11px] font-bold text-indigo-700 hover:bg-indigo-100 transition-colors cursor-help">
                            <span>Vol (sigma):</span>
                            <input
                              type="number"
                              className="bg-transparent w-10 text-indigo-700 font-mono outline-none text-center cursor-text"
                              value={(volatilities[asset] * 100).toFixed(1)}
                              onChange={(e) => {
                                const newV = parseFloat(e.target.value);
                                if (!isNaN(newV)) {
                                  setVolatilities({ ...volatilities, [asset]: newV / 100 });
                                }
                              }}
                            />
                            <span>%</span>
                          </div>
                        </Tooltip>
                      </div>
                    </div>

                    <div className="flex flex-col items-end mr-8">
                      <div className="flex items-baseline gap-1">
                        <input
                          type="number"
                          className="bg-transparent text-right text-3xl font-bold font-mono text-slate-900 w-20 outline-none focus:text-indigo-600 transition-all"
                          value={(weights[asset] || 0).toFixed(1)}
                          onChange={(e) => handleWeightChange(asset, e.target.value)}
                        />
                        <span className="text-slate-400 font-bold">%</span>
                      </div>
                    </div>
                  </div>

                  <div className="relative h-2 bg-slate-100 rounded-full overflow-hidden mt-2">
                    <div
                      className="absolute top-0 left-0 h-full bg-indigo-500 rounded-full transition-all duration-300"
                      style={{ width: `${weights[asset] || 0}%` }}
                    />
                    <input
                      type="range"
                      min="0"
                      max="100"
                      step="0.1"
                      value={weights[asset] || 0}
                      onChange={(e) => handleWeightChange(asset, e.target.value)}
                      className="absolute top-0 left-0 w-full h-full opacity-0 cursor-pointer"
                    />
                  </div>
                </div>
              ))}

              <div className="flex gap-2 mt-4 items-center justify-center pt-2">
                <div className="flex gap-2 bg-white p-2 rounded-full shadow-sm border border-slate-100">
                  <input
                    type="text"
                    placeholder="TICKER"
                    value={newTicker}
                    onChange={(e) => setNewTicker(e.target.value.toUpperCase())}
                    className="bg-slate-50 border-none rounded-full px-4 py-2 text-sm font-bold text-slate-900 uppercase outline-none focus:ring-2 focus:ring-indigo-100 w-28 placeholder:text-slate-400"
                  />
                  <div className="flex items-center bg-slate-50 rounded-full px-4 py-2">
                    <span className="text-xs font-bold text-slate-400 mr-2">VOL</span>
                    <input
                      type="number"
                      value={newVol}
                      onChange={(e) => setNewVol(parseFloat(e.target.value) || 0)}
                      className="bg-transparent w-12 outline-none text-sm font-bold font-mono text-slate-900 text-center"
                    />
                    <span className="text-xs font-bold text-slate-400 ml-1">%</span>
                  </div>
                  <button
                    onClick={handleAddAsset}
                    className="bg-indigo-600 text-white hover:bg-indigo-700 shadow-md shadow-indigo-200 rounded-full p-3 transition-all flex items-center justify-center w-12 h-12"
                  >
                    <Plus className="w-6 h-6" />
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="bg-white border border-slate-100 rounded-[2rem] p-6 shadow-sm">
              <div className="flex items-center gap-2 mb-6">
                <Cpu className="w-5 h-5 text-indigo-600" />
                <h3 className="text-sm font-bold text-slate-600 uppercase tracking-wider">
                  Correlation Matrix
                </h3>
              </div>

              <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100 overflow-x-auto custom-scrollbar">
                <div className="min-w-max">
                  <div className="flex mb-2">
                    <div className="w-16"></div>
                    {assets.map((col) => (
                      <div
                        key={`header-${col}`}
                        className="w-16 text-center text-xs font-bold text-slate-400 uppercase"
                      >
                        {col}
                      </div>
                    ))}
                  </div>

                  {assets.map((row, i) => (
                    <div key={`row-${row}`} className="flex mb-1.5 items-center">
                      <div className="w-16 text-xs font-bold text-slate-600 text-right pr-4 uppercase">
                        {row}
                      </div>
                      {assets.map((col, j) => {
                        const val = correlationMatrix[row]?.[col] || 0;
                        const isDiagonal = i === j;

                        let bgColor = 'bg-white';
                        let textColor = 'text-slate-600';
                        if (!isDiagonal) {
                          if (val > 0.5) {
                            bgColor = 'bg-rose-50 border-rose-200';
                            textColor = 'text-rose-700';
                          } else if (val > 0) {
                            bgColor = 'bg-rose-50/50';
                            textColor = 'text-rose-500';
                          } else if (val < -0.2) {
                            bgColor = 'bg-emerald-50 border-emerald-200';
                            textColor = 'text-emerald-700';
                          } else if (val < 0) {
                            bgColor = 'bg-emerald-50/50';
                            textColor = 'text-emerald-600';
                          }
                        }

                        return (
                          <div key={`cell-${row}-${col}`} className="w-16 px-1">
                            {isDiagonal ? (
                              <div className="w-full text-center text-xs font-mono font-semibold py-2 text-slate-400 bg-slate-100 rounded-xl">
                                1.00
                              </div>
                            ) : (
                              <input
                                type="number"
                                step="0.05"
                                min="-1"
                                max="1"
                                value={val.toFixed(2)}
                                onChange={(e) => updateCorrelation(row, col, e.target.value)}
                                className={`w-full text-center text-xs font-mono font-semibold py-2 rounded-xl outline-none transition-colors border border-transparent ${bgColor} ${textColor} focus:ring-2 focus:ring-indigo-100 focus:border-indigo-300 shadow-sm`}
                              />
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ))}
                </div>
              </div>

              <p className="text-[11px] text-slate-500 mt-4 font-medium leading-relaxed bg-slate-50 p-3 rounded-xl">
                <span className="font-bold text-indigo-600">Note:</span> Negative correlations (e.g. SPY and
                TLT) provide natural hedging. TLT represents Treasury Bonds. Adjust correlations to simulate
                market panics where assets correlate closer to 1.00.
              </p>
            </div>

            <div className="bg-white border border-slate-100 rounded-[2rem] p-6 shadow-sm">
              <div className="flex items-center gap-2 mb-6">
                <Zap className="w-5 h-5 text-indigo-600" />
                <h3 className="text-sm font-bold text-slate-600 uppercase tracking-wider">
                  Historical Stress Test
                </h3>
              </div>

              <div className="flex flex-col gap-6">
                <div className="flex flex-wrap gap-2">
                  {Object.keys(STRESS_SCENARIOS).map((scenario) => (
                    <button
                      key={scenario}
                      onClick={() => setSelectedScenario(scenario)}
                      className={`px-4 py-2.5 text-sm font-bold rounded-xl border transition-all ${
                        selectedScenario === scenario
                          ? 'bg-indigo-600 border-indigo-600 text-white shadow-md shadow-indigo-200'
                          : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      {scenario}
                    </button>
                  ))}
                </div>

                <div className="bg-slate-50 rounded-2xl p-5 border border-slate-100 flex items-center justify-between shadow-inner">
                  <div>
                    <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">
                      Projected Drawdown
                    </div>
                    <div className="text-xs text-slate-500 font-medium">
                      Estimated impact on current portfolio
                    </div>
                  </div>
                  <div
                    className={`text-4xl font-bold font-mono tracking-tight ${
                      stressTestImpact < 0 ? 'text-rose-500' : 'text-emerald-500'
                    }`}
                  >
                    {stressTestImpact > 0 ? '+' : ''}
                    {stressTestImpact.toFixed(2)}%
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
