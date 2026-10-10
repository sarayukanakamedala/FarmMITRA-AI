import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { getMarketSnapshot } from '../api/api';
import { apiError, formatDate, inr } from '../utils/helpers';
import WeatherGlyph, { weatherAdvice } from './ui/WeatherGlyph';
import Skeleton from './ui/Skeleton';
import Icon from './ui/Icon';

const SORTS = [
  { id: 'modal', label: 'Highest price' },
  { id: 'market', label: 'Market name' },
];

export default function MarketInsights({ farmer, onAsk }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [sort, setSort] = useState('modal');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await getMarketSnapshot(farmer.phone);
      setData(res.data);
    } catch (err) {
      setError(apiError(err, 'Could not load market data. Check that the backend is running.'));
    } finally {
      setLoading(false);
    }
  }, [farmer.phone]);

  useEffect(() => {
    load();
  }, [load]);

  const rows = useMemo(() => {
    const prices = data && data.prices && data.prices.found ? data.prices.records : [];
    const list = prices.map((p) => ({ ...p, min: Number(p.minPrice), max: Number(p.maxPrice), modal: Number(p.modalPrice) }));
    return sort === 'market' ? list.sort((a, b) => String(a.market).localeCompare(b.market)) : list.sort((a, b) => b.modal - a.modal);
  }, [data, sort]);

  const stats = useMemo(() => {
    if (rows.length === 0) return null;
    const modals = rows.map((r) => r.modal).filter(Number.isFinite);
    const best = rows.reduce((a, b) => (b.modal > a.modal ? b : a), rows[0]);
    return { best, avg: Math.round(modals.reduce((s, v) => s + v, 0) / modals.length), count: rows.length };
  }, [rows]);

  const scaleMin = rows.length ? Math.min(...rows.map((r) => r.min).filter(Number.isFinite)) : 0;
  const scaleMax = rows.length ? Math.max(...rows.map((r) => r.max).filter(Number.isFinite)) : 1;
  const pos = (v) => (scaleMax === scaleMin ? 50 : ((v - scaleMin) / (scaleMax - scaleMin)) * 100);

  const forecast = data && data.weather && data.weather.found ? data.weather.forecast : [];
  const advice = weatherAdvice(forecast);
  const maxRain = Math.max(5, ...forecast.map((d) => d.totalRainMm || 0));

  return (
    <div className="stack">
      <header className="page-intro">
        <div>
          <h2>Market and weather</h2>
          <p className="muted"><Icon name="pin" size={15} /> {farmer.district}, {farmer.state}{data && data.fetchedAt ? `. Updated ${new Date(data.fetchedAt).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })}` : ''}</p>
        </div>
        <div className="row">
          <button type="button" className="btn btn-ghost" onClick={load} disabled={loading}><Icon name="refresh" size={17} /> Refresh</button>
          <button type="button" className="btn btn-primary" onClick={() => onAsk('Should I sell my paddy now or wait for a better price?')}><Icon name="mic" size={17} /> Ask if I should sell</button>
        </div>
      </header>

      {error && (
        <div className="notice notice-error" role="alert"><Icon name="alert" size={18} /><div><strong>Data did not load</strong><p>{error}</p></div></div>
      )}

      <section className="stat-cards">
        {loading ? (
          [0, 1, 2].map((i) => <div className="panel" key={i}><Skeleton height={14} width="50%" /><Skeleton height={30} width="70%" style={{ marginTop: 12 }} /></div>)
        ) : stats ? (
          <>
            <div className="panel stat-card accent"><span>Highest modal price</span><strong>{inr(stats.best.modal)}</strong><em>{stats.best.market}, {stats.best.district}</em></div>
            <div className="panel stat-card"><span>Average modal price</span><strong>{inr(stats.avg)}</strong><em>per quintal across {stats.count} markets</em></div>
            <div className="panel stat-card"><span>Price coverage</span><strong>{data.prices.matchLevel === 'district' ? 'District' : 'State'}</strong><em>{data.prices.matchLevel === 'district' ? `Markets in ${farmer.district}` : `No ${farmer.district} data today, showing ${farmer.state}`}</em></div>
          </>
        ) : (
          <div className="panel stat-empty"><Icon name="trend" size={24} /><div><strong>No prices reported</strong><p className="muted">{data && data.prices ? data.prices.message : 'Prices will appear once the backend responds.'}</p></div></div>
        )}
      </section>

      <div className="grid-market">
        <section className="panel">
          <header className="panel-head tight">
            <h3>Mandi prices</h3>
            <div className="segmented segmented-sm" role="tablist" aria-label="Sort markets">
              {SORTS.map((s) => (<button key={s.id} role="tab" aria-selected={sort === s.id} className={sort === s.id ? 'on' : ''} type="button" onClick={() => setSort(s.id)}>{s.label}</button>))}
            </div>
          </header>
          {loading ? (
            <Skeleton height={180} />
          ) : rows.length === 0 ? (
            <p className="muted">No market has reported paddy prices today.</p>
          ) : (
            <div className="table-wrap">
              <table className="prices">
                <thead><tr><th>Market</th><th>Variety</th><th className="range-col">Min to max</th><th className="num">Modal</th></tr></thead>
                <tbody>
                  {rows.map((r, i) => (
                    <tr key={i} className={stats && r === stats.best ? 'best' : ''}>
                      <td><strong>{r.market}</strong><span>{r.district}{r.arrivalDate ? `, ${r.arrivalDate}` : ''}</span></td>
                      <td>{r.variety || '-'}</td>
                      <td className="range-col">
                        <div className="range" title={`${inr(r.min)} to ${inr(r.max)}`}>
                          <i style={{ left: `${pos(r.min)}%`, width: `${Math.max(2, pos(r.max) - pos(r.min))}%` }} />
                          <b style={{ left: `${pos(r.modal)}%` }} />
                        </div>
                        <small>{inr(r.min)} - {inr(r.max)}</small>
                      </td>
                      <td className="num"><strong>{inr(r.modal)}</strong></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <p className="muted small foot">Prices are rupees per quintal from Agmarknet. Modal is the most common trading price.</p>
        </section>

        <section className="panel">
          <header className="panel-head tight"><h3>5-day forecast</h3></header>
          {loading ? (
            <Skeleton height={180} />
          ) : forecast.length === 0 ? (
            <p className="muted">{data && data.weather ? data.weather.message : 'Forecast unavailable.'}</p>
          ) : (
            <>
              <ul className="forecast">
                {forecast.map((d) => (
                  <li key={d.date}>
                    <span className="day">{formatDate(d.date, { weekday: 'short', day: 'numeric' })}</span>
                    <WeatherGlyph condition={d.condition} size={24} />
                    <span className="cond">{d.condition}</span>
                    <div className="rain-bar" title={`${d.totalRainMm} mm rain`}><i style={{ width: `${Math.min(100, (d.totalRainMm / maxRain) * 100)}%` }} /></div>
                    <span className="rain">{d.totalRainMm} mm</span>
                    <strong>{d.avgTemp}°C</strong>
                  </li>
                ))}
              </ul>
              {advice && <p className={`advice advice-${advice.tone}`}>{advice.text}</p>}
            </>
          )}
        </section>
      </div>
    </div>
  );
}