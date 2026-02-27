import { parentPort } from 'worker_threads';

/**
 * Heavy computation worker thread
 * Handles CPU-intensive tasks off the main thread
 */

parentPort.on('message', async (message) => {
  try {
    const { type, data, transformation, aggregation, operation } = message;
    let result;

    switch (type) {
      case 'transform':
        result = await transformData(data, transformation);
        break;
      
      case 'aggregate':
        result = await aggregateData(data, aggregation);
        break;
      
      case 'calculate':
        result = await performCalculation(data, operation);
        break;
      
      default:
        throw new Error(`Unknown task type: ${type}`);
    }

    parentPort.postMessage({ success: true, result });
  } catch (error) {
    parentPort.postMessage({ 
      success: false, 
      error: error.message 
    });
  }
});

/**
 * Data transformation (mapping, filtering, etc)
 */
async function transformData(data, transformation) {
  const { type, params } = transformation;

  switch (type) {
    case 'map':
      return data.map(item => applyTransformation(item, params));
    
    case 'filter':
      return data.filter(item => applyFilter(item, params));
    
    case 'group':
      return groupBy(data, params);
    
    case 'flatten':
      return data.flat(params.depth || 1);
    
    default:
      return data;
  }
}

/**
 * Aggregation (sum, avg, count, etc)
 */
async function aggregateData(data, aggregation) {
  const { type, field, groupBy: groupByField } = aggregation;

  if (!groupByField) {
    return simpleAggregate(data, type, field);
  }

  // Group by first, then aggregate
  const grouped = groupBy(data, groupByField);
  const result = {};

  for (const [key, items] of Object.entries(grouped)) {
    result[key] = simpleAggregate(items, type, field);
  }

  return result;
}

/**
 * Heavy calculations
 */
async function performCalculation(data, operation) {
  const { type, params } = operation;

  switch (type) {
    case 'stats':
      return calculateStats(data, params);
    
    case 'percentiles':
      return calculatePercentiles(data, params);
    
    case 'correlation':
      return calculateCorrelation(data, params);
    
    case 'forecast':
      return simpleForecast(data, params);
    
    default:
      return data;
  }
}

/**
 * Helper functions
 */

function applyTransformation(item, params) {
  const result = { ...item };
  
  if (params.fields) {
    return params.fields.reduce((acc, field) => {
      acc[field] = result[field];
      return acc;
    }, {});
  }

  if (params.compute) {
    for (const [key, formula] of Object.entries(params.compute)) {
      result[key] = eval(formula);
    }
  }

  return result;
}

function applyFilter(item, params) {
  if (params.field && params.operator && 'value' in params) {
    const itemValue = item[params.field];

    switch (params.operator) {
      case 'eq': return itemValue === params.value;
      case 'ne': return itemValue !== params.value;
      case 'gt': return itemValue > params.value;
      case 'gte': return itemValue >= params.value;
      case 'lt': return itemValue < params.value;
      case 'lte': return itemValue <= params.value;
      case 'in': return params.value.includes(itemValue);
      case 'contains': return String(itemValue).includes(params.value);
      default: return true;
    }
  }

  return true;
}

function groupBy(data, field) {
  return data.reduce((acc, item) => {
    const key = item[field];
    if (!acc[key]) acc[key] = [];
    acc[key].push(item);
    return acc;
  }, {});
}

function simpleAggregate(data, type, field) {
  const values = data.map(item => item[field]).filter(v => v !== null && v !== undefined);

  switch (type) {
    case 'sum': return values.reduce((a, b) => a + b, 0);
    case 'avg': return values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0;
    case 'min': return Math.min(...values);
    case 'max': return Math.max(...values);
    case 'count': return values.length;
    default: return values;
  }
}

function calculateStats(data, params) {
  const { field } = params;
  const values = data.map(item => item[field]).filter(v => typeof v === 'number');

  if (values.length === 0) return null;

  const sum = values.reduce((a, b) => a + b, 0);
  const avg = sum / values.length;
  const variance = values.reduce((acc, val) => acc + Math.pow(val - avg, 2), 0) / values.length;
  const stdDev = Math.sqrt(variance);

  return {
    count: values.length,
    sum,
    avg,
    min: Math.min(...values),
    max: Math.max(...values),
    median: values.sort((a, b) => a - b)[Math.floor(values.length / 2)],
    variance,
    stdDev
  };
}

function calculatePercentiles(data, params) {
  const { field, percentiles = [25, 50, 75, 90, 95, 99] } = params;
  const values = data.map(item => item[field]).filter(v => typeof v === 'number').sort((a, b) => a - b);

  if (values.length === 0) return {};

  return percentiles.reduce((acc, p) => {
    const index = Math.ceil((p / 100) * values.length) - 1;
    acc[`p${p}`] = values[Math.max(0, index)];
    return acc;
  }, {});
}

function calculateCorrelation(data, params) {
  const { field1, field2 } = params;
  const pairs = data
    .filter(item => item[field1] !== null && item[field2] !== null)
    .map(item => [item[field1], item[field2]]);

  if (pairs.length < 2) return 0;

  const n = pairs.length;
  const sum1 = pairs.reduce((sum, [a]) => sum + a, 0);
  const sum2 = pairs.reduce((sum, [_, b]) => sum + b, 0);
  const avg1 = sum1 / n;
  const avg2 = sum2 / n;

  const sumProducts = pairs.reduce((sum, [a, b]) => sum + (a - avg1) * (b - avg2), 0);
  const sumSq1 = pairs.reduce((sum, [a]) => sum + Math.pow(a - avg1, 2), 0);
  const sumSq2 = pairs.reduce((sum, [_, b]) => sum + Math.pow(b - avg2, 2), 0);

  return sumProducts / Math.sqrt(sumSq1 * sumSq2);
}

function simpleForecast(data, params) {
  const { field, periods = 12 } = params;
  const values = data.map(item => item[field]).filter(v => typeof v === 'number');

  if (values.length < 2) return [];

  // Simple exponential smoothing
  const alpha = 0.3;
  const forecast = [values[0]];

  for (let i = 1; i < values.length; i++) {
    forecast.push(alpha * values[i] + (1 - alpha) * forecast[i - 1]);
  }

  // Extend forecast
  const lastValue = forecast[forecast.length - 1];
  for (let i = 0; i < periods; i++) {
    forecast.push(lastValue);
  }

  return forecast.slice(values.length);
}
