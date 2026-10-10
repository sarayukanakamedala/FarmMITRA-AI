import React, { useCallback, useEffect, useState } from 'react';
import { getMarketSnapshot, getTasks } from '../api/api';
import { CROP_DAYS, CROP_STAGES, daysBetween, formatDate, greeting, inr, relativeDue, stageAt } from '../utils/helpers';
import WeatherGlyph, { weatherAdvice } from './ui/WeatherGlyph';
import Skeleton from './ui/Skeleton';
import Icon from './ui/Icon';
import { completeTask } from '../api/api';
import { useToast } from '../context/Toast';

function SeasonRibbon({ day }) {
  const clamped = Math.max(0, Math.min(CROP_DAYS, day));
  const markerLeft = `${(clamped / CROP_DAYS) * 100}%`;
  return (
    <div className="ribbon" role="img" aria-label={`Day ${Math.max(day, 0)} of ${CROP_DAYS}`}>
      <div className="ribbon-track">
        {CROP_STAGES.map((s) => {
          const len = s.end - s.start;
          const filled = Math.max(0, Math.min(len, clamped - s.start));
          const active = clamped >= s.start && clamped < s.end;
          return (
            <div key={s.name} className={`ribbon-seg ${active ? 'active' : ''}`} style={{ flex: len }}>
              <i style={{ width: `${(filled / len) * 100}%` }} />
              <span>{s.name}</span>
            </div>
          );
        })}
        {day >= 0 && <b className="ribbon-marker" style={{ left: markerLeft }}><em>Today</em></b>}
      </div>
      <div className="ribbon-scale"><span>Sowing</span><span>Day 60</span><span>Harvest</span></div>
    </div>
  );
}

export default function Dashboard({ farmer, onNavigate, refreshKey, onChanged }) {
  const { notify } = useToast();
  const [tasks, setTasks] = useState(null);
  const [market, setMarket] = useState(null);
  const [marketError, setMarketError] = useState(false);

  const load = useCallback(async () => {
    getTasks(farmer.phone).then((r) => setTasks(r.data.tasks)).catch(() => setTasks([]));
    setMarketError(false);
    getMarketSnapshot(farmer.phone).then((r) => setMarket(r.data)).catch(() => { setMarket({}); setMarketError(true); });
  }, [farmer.phone]);

  useEffect(() => {
    load();
  }, [load, refreshKey]);

  const day = daysBetween(farmer.plantingDate, new Date());
  const stage = stageAt(day);
  const daysToStart = -day;
  const upcoming = (tasks || []).filter((t) => t.status !== 'done').slice(0, 4);
  const overdueCount = (tasks || []).filter((t) => t.status === 'overdue').length;

  const prices = market && market.prices && market.prices.found ? [...market.prices.records].sort((a, b) => b.modalPrice - a.modalPrice) : [];
  const forecast = market && market.weather && market.weather.found ? market.weather.forecast : [];
  const advice = weatherAdvice(forecast);

  const finish = async (t) => {
    setTasks((prev) => prev.map((x) => (x._id === t._id ? { ...x, status: 'done' } : x)));
    try {
      await completeTask(t._id);
      notify('Task marked done.', 'success');
      onChanged && onChanged();
    } catch (e) {
      notify('Could not update the task.', 'error');
      load();
    }
  };

  return (
    <div className="stack">
      <section className="panel hero">
        <div className="hero-top">
          <div>
            <h2>{greeting()}, {farmer.name.split(' ')[0]}</h2>
            <p className="muted">
              {day < 0
                ? `Your season starts in ${daysToStart} day${daysToStart === 1 ? '' : 's'} on ${formatDate(farmer.plantingDate)}.`
                : day >= CROP_DAYS
                ? 'Your crop has reached the end of the standard 120-day cycle.'
                : `Day ${day} of ${CROP_DAYS}. Your paddy is in the ${stage ? stage.name.toLowerCase() : 'growing'} stage.`}
            </p>
          </div>
          <span className="place"><Icon name="pin" size={16} /> {farmer.district}, {farmer.state}</span>
        </div>
        <SeasonRibbon day={day} />
      </section>

      <div className="grid-2">
        <section className="panel">
          <header className="panel-head tight">
            <h3>Next tasks</h3>
            <button type="button" className="link" onClick={() => onNavigate('calendar')}>Open calendar</button>
          </header>
          {overdueCount > 0 && (
            <p className="inline-warn"><Icon name="alert" size={16} /> {overdueCount} task{overdueCount > 1 ? 's are' : ' is'} overdue</p>
          )}
          {tasks === null ? (
            <><Skeleton height={44} /><Skeleton height={44} style={{ marginTop: 8 }} /><Skeleton height={44} style={{ marginTop: 8 }} /></>
          ) : upcoming.length === 0 ? (
            <p className="muted">All tasks are finished. Well done.</p>
          ) : (
            <ul className="mini-tasks">
              {upcoming.map((t) => (
                <li key={t._id}>
                  <button type="button" className="check" onClick={() => finish(t)} aria-label={`Mark "${t.title}" as done`} />
                  <div>
                    <strong>{t.title}</strong>
                    <span className={t.status === 'overdue' ? 'due-bad' : ''}>{relativeDue(t.dueDate, t.status)}, {formatDate(t.dueDate, { day: 'numeric', month: 'short' })}</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="panel">
          <header className="panel-head tight">
            <h3>Weather in {farmer.district}</h3>
            <button type="button" className="link" onClick={() => onNavigate('market')}>Full forecast</button>
          </header>
          {market === null ? (
            <Skeleton height={96} />
          ) : forecast.length === 0 ? (
            <p className="muted">{marketError ? 'Forecast unavailable. Check the backend and your OpenWeather key.' : (market.weather && market.weather.message) || 'No forecast available.'}</p>
          ) : (
            <>
              <ul className="wx-strip">
                {forecast.slice(0, 4).map((d) => (
                  <li key={d.date}>
                    <span>{formatDate(d.date, { weekday: 'short' })}</span>
                    <WeatherGlyph condition={d.condition} />
                    <strong>{d.avgTemp}°</strong>
                    <em>{d.totalRainMm} mm</em>
                  </li>
                ))}
              </ul>
              {advice && <p className={`advice advice-${advice.tone}`}>{advice.text}</p>}
            </>
          )}
        </section>
      </div>

      <section className="panel">
        <header className="panel-head tight">
          <h3>Paddy prices near you</h3>
          <button type="button" className="link" onClick={() => onNavigate('market')}>All markets</button>
        </header>
        {market === null ? (
          <Skeleton height={64} />
        ) : prices.length === 0 ? (
          <p className="muted">{marketError ? 'Prices unavailable. Check the backend and your data.gov.in key.' : (market.prices && market.prices.message) || 'No price data reported today.'}</p>
        ) : (
          <div className="price-cards">
            {prices.slice(0, 3).map((p, i) => (
              <div key={i} className={`price-card ${i === 0 ? 'best' : ''}`}>
                {i === 0 && <span className="tag">Highest today</span>}
                <strong>{inr(p.modalPrice)}</strong>
                <span className="unit">per quintal</span>
                <span className="market">{p.market}, {p.district}</span>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="quick">
        <button type="button" onClick={() => onNavigate('ask')}><Icon name="mic" size={22} /><strong>Ask a question</strong><span>Speak or type, get advice</span></button>
        <button type="button" onClick={() => onNavigate('disease')}><Icon name="leaf" size={22} /><strong>Check a leaf</strong><span>Photo to disease and remedy</span></button>
        <button type="button" onClick={() => onNavigate('calendar')}><Icon name="calendar" size={22} /><strong>Play reminder</strong><span>Hear today's tasks aloud</span></button>
      </section>
    </div>
  );
}