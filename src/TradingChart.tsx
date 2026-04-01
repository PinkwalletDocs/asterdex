import { useEffect, useRef, useState } from "react";
import {
  CandlestickSeries,
  ColorType,
  createChart,
  CrosshairMode,
  HistogramSeries,
  LineSeries,
  LineStyle,
  type CandlestickData,
  type HistogramData,
  type IChartApi,
  type ISeriesApi,
  type LineData,
  type Time,
  type UTCTimestamp,
} from "lightweight-charts";

export const TIMEFRAME_TO_BINANCE: Record<string, string> = {
  "5m": "5m",
  "15m": "15m",
  "1H": "1h",
  "4H": "4h",
  "1D": "1d",
  "1W": "1w",
};

type Row = CandlestickData<Time> & { vol: number };

type LegendState = {
  o: number;
  h: number;
  l: number;
  c: number;
  ma7?: number;
  ma30?: number;
  ma99?: number;
  vol?: number;
  volMa9?: number;
};

function parseKlines(raw: unknown[][]): Row[] {
  return raw.map((k) => {
    const t = Math.floor(Number(k[0]) / 1000) as UTCTimestamp;
    const open = parseFloat(String(k[1]));
    const high = parseFloat(String(k[2]));
    const low = parseFloat(String(k[3]));
    const close = parseFloat(String(k[4]));
    const vol = parseFloat(String(k[5]));
    return { time: t, open, high, low, close, vol };
  });
}

function maFromRows(rows: Row[], period: number): LineData<Time>[] {
  const out: LineData<Time>[] = [];
  for (let i = period - 1; i < rows.length; i++) {
    let s = 0;
    for (let j = 0; j < period; j++) s += rows[i - j].close;
    out.push({ time: rows[i].time, value: s / period });
  }
  return out;
}

function volMaFromRows(rows: Row[], period: number): LineData<Time>[] {
  const out: LineData<Time>[] = [];
  for (let i = period - 1; i < rows.length; i++) {
    let s = 0;
    for (let j = 0; j < period; j++) s += rows[i - j].vol;
    out.push({ time: rows[i].time, value: s / period });
  }
  return out;
}

function rowAtTime(rows: Row[], t: Time): Row | undefined {
  return rows.find((r) => r.time === t);
}

function buildLegendFromRow(
  rows: Row[],
  d: CandlestickData<Time>,
  m7?: LineData<Time>,
  m30?: LineData<Time>,
  m99?: LineData<Time>,
  hv?: HistogramData<Time>,
  vma?: LineData<Time>,
): LegendState {
  const o = d.open ?? d.close;
  const h = d.high ?? d.close;
  const l = d.low ?? d.close;
  const c = d.close;
  const row = rowAtTime(rows, d.time);
  return {
    o,
    h,
    l,
    c,
    ma7: m7?.value,
    ma30: m30?.value,
    ma99: m99?.value,
    vol: hv != null && typeof hv.value === "number" ? hv.value : row?.vol,
    volMa9: vma?.value,
  };
}

function ChartLegend({
  data,
  maExpanded,
  onToggleMa,
}: {
  data: LegendState | null;
  maExpanded: boolean;
  onToggleMa: () => void;
}) {
  if (!data) {
    return <div className="chart-legend-inner chart-legend-loading">加载 K 线…</div>;
  }
  const chg = data.c - data.o;
  const pct = data.o !== 0 ? (chg / data.o) * 100 : 0;
  const chgStr = `${chg >= 0 ? "+" : ""}${chg.toFixed(1)}`;
  const pctStr = `${pct >= 0 ? "+" : ""}${pct.toFixed(2)}%`;

  return (
    <div className="chart-legend-inner">
      <div className="legend-ohlc-line">
        <span className="legend-ohlc-pair">
          开=<b>{data.o.toFixed(1)}</b> 高=<b>{data.h.toFixed(1)}</b> 低=<b>{data.l.toFixed(1)}</b> 收=<b>{data.c.toFixed(1)}</b>
        </span>
        <span className={chg >= 0 ? "legend-delta up" : "legend-delta down"}>
          {" "}
          {chgStr} ({pctStr})
        </span>
      </div>
      <div className="legend-ma-block">
        <button type="button" className="legend-ma-toggle" onClick={onToggleMa} aria-expanded={maExpanded}>
          <span className="chev-legend">{maExpanded ? "▲" : "▼"}</span>
        </button>
        {maExpanded ? (
          <div className="legend-ma-lines">
            <div className="legend-ma-item ma7">
              MA 7 close 0 SMA 9 {data.ma7 != null ? data.ma7.toFixed(1) : "—"}
            </div>
            <div className="legend-ma-item ma30">
              MA 30 close 0 SMA 9 {data.ma30 != null ? data.ma30.toFixed(1) : "—"}
            </div>
            <div className="legend-ma-item ma99">
              MA 99 close 0 SMA 9 {data.ma99 != null ? data.ma99.toFixed(1) : "—"}
            </div>
          </div>
        ) : null}
      </div>
      <div className="legend-vol-line">
        成交量(Volume) SMA 9 {data.volMa9 != null ? Math.round(data.volMa9) : "—"}
      </div>
    </div>
  );
}

type Props = {
  timeframe: string;
  lastPrice?: number;
  className?: string;
};

export function TradingChart({ timeframe, lastPrice, className }: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const volRef = useRef<ISeriesApi<"Histogram"> | null>(null);
  const volMaRef = useRef<ISeriesApi<"Line"> | null>(null);
  const ma7Ref = useRef<ISeriesApi<"Line"> | null>(null);
  const ma30Ref = useRef<ISeriesApi<"Line"> | null>(null);
  const ma99Ref = useRef<ISeriesApi<"Line"> | null>(null);
  const rowsRef = useRef<Row[]>([]);
  const [legend, setLegend] = useState<LegendState | null>(null);
  const [maExpanded, setMaExpanded] = useState(true);

  useEffect(() => {
    const el = hostRef.current;
    if (!el) return;

    const chart = createChart(el, {
      width: el.clientWidth,
      height: el.clientHeight,
      layout: {
        attributionLogo: true,
        background: { type: ColorType.Solid, color: "#131722" },
        textColor: "#787b86",
        fontSize: 11,
        fontFamily: "Trebuchet MS, Roboto, Ubuntu, sans-serif",
      },
      grid: {
        vertLines: { color: "rgba(42, 46, 57, 0.5)", style: LineStyle.SparseDotted, visible: true },
        horzLines: { color: "rgba(42, 46, 57, 0.6)", style: LineStyle.Dotted, visible: true },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: {
          color: "rgba(224, 227, 235, 0.4)",
          width: 1,
          style: LineStyle.Dotted,
          labelBackgroundColor: "#363a45",
        },
        horzLine: {
          color: "rgba(224, 227, 235, 0.4)",
          width: 1,
          style: LineStyle.Dotted,
          labelBackgroundColor: "#363a45",
        },
      },
      rightPriceScale: {
        borderColor: "#2a2e39",
        scaleMargins: { top: 0.05, bottom: 0.2 },
        entireTextOnly: false,
      },
      timeScale: {
        borderColor: "#2a2e39",
        timeVisible: true,
        secondsVisible: false,
        rightOffset: 6,
        barSpacing: 6,
        fixLeftEdge: false,
        fixRightEdge: false,
      },
      localization: {
        priceFormatter: (p: number) =>
          p.toLocaleString("en-US", { minimumFractionDigits: 1, maximumFractionDigits: 1 }),
        timeFormatter: (t: Time) => {
          const sec = typeof t === "number" ? t : 0;
          const d = new Date(sec * 1000);
          const y = d.getFullYear();
          const mo = String(d.getMonth() + 1).padStart(2, "0");
          const day = String(d.getDate()).padStart(2, "0");
          const h = String(d.getHours()).padStart(2, "0");
          const mi = String(d.getMinutes()).padStart(2, "0");
          return `${y}-${mo}-${day} ${h}:${mi}`;
        },
      },
    });

    const candle = chart.addSeries(CandlestickSeries, {
      upColor: "#0ecb81",
      downColor: "#f6465d",
      borderUpColor: "#0ecb81",
      borderDownColor: "#f6465d",
      wickUpColor: "#0ecb81",
      wickDownColor: "#f6465d",
    });

    const vol = chart.addSeries(HistogramSeries, {
      priceFormat: { type: "volume" },
      priceScaleId: "",
    });
    vol.priceScale().applyOptions({
      scaleMargins: { top: 0.82, bottom: 0 },
    });

    const volMa = chart.addSeries(
      LineSeries,
      {
        color: "#f0a500",
        lineWidth: 1,
        priceLineVisible: false,
        lastValueVisible: true,
        crosshairMarkerVisible: false,
        priceScaleId: "",
        lineStyle: LineStyle.Solid,
      },
    );
    volMa.priceScale().applyOptions({
      scaleMargins: { top: 0.82, bottom: 0 },
    });

    const ma7 = chart.addSeries(LineSeries, {
      color: "#9b59b6",
      lineWidth: 1,
      priceLineVisible: false,
      lastValueVisible: true,
      crosshairMarkerVisible: false,
    });
    const ma30 = chart.addSeries(LineSeries, {
      color: "#f0b90b",
      lineWidth: 1,
      priceLineVisible: false,
      lastValueVisible: true,
      crosshairMarkerVisible: false,
    });
    const ma99 = chart.addSeries(LineSeries, {
      color: "#4285f4",
      lineWidth: 1,
      priceLineVisible: false,
      lastValueVisible: true,
      crosshairMarkerVisible: false,
    });

    chartRef.current = chart;
    candleRef.current = candle;
    volRef.current = vol;
    volMaRef.current = volMa;
    ma7Ref.current = ma7;
    ma30Ref.current = ma30;
    ma99Ref.current = ma99;

    chart.subscribeCrosshairMove((param) => {
      const c = candleRef.current;
      const v = volRef.current;
      const vma = volMaRef.current;
      const m7 = ma7Ref.current;
      const m30 = ma30Ref.current;
      const m99 = ma99Ref.current;
      const rows = rowsRef.current;
      if (!c || !rows.length) return;

      if (!param.time) {
        const last = rows[rows.length - 1];
        const i = rows.length - 1;
        const ma7d = i >= 6 ? maFromRows(rows.slice(0, i + 1), 7).at(-1) : undefined;
        const ma30d = i >= 29 ? maFromRows(rows.slice(0, i + 1), 30).at(-1) : undefined;
        const ma99d = i >= 98 ? maFromRows(rows.slice(0, i + 1), 99).at(-1) : undefined;
        const vma9d = i >= 8 ? volMaFromRows(rows.slice(0, i + 1), 9).at(-1) : undefined;
        setLegend({
          o: last.open,
          h: last.high,
          l: last.low,
          c: last.close,
          ma7: ma7d?.value,
          ma30: ma30d?.value,
          ma99: ma99d?.value,
          vol: last.vol,
          volMa9: vma9d?.value,
        });
        return;
      }

      const d = param.seriesData.get(c) as CandlestickData<Time> | undefined;
      if (!d || typeof d.close !== "number") return;

      const hv = v ? (param.seriesData.get(v) as HistogramData<Time> | undefined) : undefined;
      const vm = vma ? (param.seriesData.get(vma) as LineData<Time> | undefined) : undefined;
      const v7 = m7 ? (param.seriesData.get(m7) as LineData<Time> | undefined) : undefined;
      const v30 = m30 ? (param.seriesData.get(m30) as LineData<Time> | undefined) : undefined;
      const v99 = m99 ? (param.seriesData.get(m99) as LineData<Time> | undefined) : undefined;

      setLegend(buildLegendFromRow(rows, d, v7, v30, v99, hv, vm));
    });

    const ro = new ResizeObserver(() => {
      if (!hostRef.current || !chartRef.current) return;
      chartRef.current.applyOptions({
        width: hostRef.current.clientWidth,
        height: hostRef.current.clientHeight,
      });
    });
    ro.observe(el);

    return () => {
      ro.disconnect();
      chart.remove();
      chartRef.current = null;
      candleRef.current = null;
      volRef.current = null;
      volMaRef.current = null;
      ma7Ref.current = null;
      ma30Ref.current = null;
      ma99Ref.current = null;
    };
  }, []);

  useEffect(() => {
    const chart = chartRef.current;
    const candle = candleRef.current;
    const vol = volRef.current;
    const volMa = volMaRef.current;
    const ma7 = ma7Ref.current;
    const ma30 = ma30Ref.current;
    const ma99 = ma99Ref.current;
    if (!chart || !candle || !vol || !volMa || !ma7 || !ma30 || !ma99) return;

    const binanceIv = TIMEFRAME_TO_BINANCE[timeframe] ?? "4h";
    let cancelled = false;

    (async () => {
      try {
        const res = await fetch(
          `https://fapi.binance.com/fapi/v1/klines?symbol=BTCUSDT&interval=${binanceIv}&limit=500`,
        );
        if (!res.ok || cancelled) return;
        const raw = (await res.json()) as unknown[][];
        const rows = parseKlines(raw);
        if (cancelled || !rows.length) return;
        const c0 = candleRef.current;
        const v0 = volRef.current;
        const vma0 = volMaRef.current;
        const m7b = ma7Ref.current;
        const m30b = ma30Ref.current;
        const m99b = ma99Ref.current;
        const ch = chartRef.current;
        if (!c0 || !v0 || !vma0 || !m7b || !m30b || !m99b || !ch) return;
        rowsRef.current = rows;

        const candles: CandlestickData<Time>[] = rows.map(({ time, open, high, low, close }) => ({
          time,
          open,
          high,
          low,
          close,
        }));
        c0.setData(candles);

        v0.setData(
          rows.map((r) => ({
            time: r.time,
            value: r.vol,
            color: r.close >= r.open ? "rgba(14, 203, 129, 0.55)" : "rgba(246, 70, 93, 0.55)",
          })),
        );

        const vmaData = volMaFromRows(rows, 9);
        vma0.setData(vmaData);

        m7b.setData(maFromRows(rows, 7));
        m30b.setData(maFromRows(rows, 30));
        m99b.setData(maFromRows(rows, 99));

        ch.timeScale().fitContent();

        const last = rows[rows.length - 1];
        const a7 = maFromRows(rows, 7).at(-1)?.value;
        const a30 = maFromRows(rows, 30).at(-1)?.value;
        const a99 = maFromRows(rows, 99).at(-1)?.value;
        const av9 = vmaData.at(-1)?.value;
        setLegend({
          o: last.open,
          h: last.high,
          l: last.low,
          c: last.close,
          ma7: a7,
          ma30: a30,
          ma99: a99,
          vol: last.vol,
          volMa9: av9,
        });
      } catch {
        /* ignore */
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [timeframe]);

  useEffect(() => {
    if (lastPrice == null || !Number.isFinite(lastPrice)) return;
    const rows = rowsRef.current;
    const candle = candleRef.current;
    if (!rows.length || !candle) return;
    const last = rows[rows.length - 1];
    if (!last) return;
    const updated: Row = {
      ...last,
      close: lastPrice,
      high: Math.max(last.high, lastPrice),
      low: Math.min(last.low, lastPrice),
    };
    rows[rows.length - 1] = updated;
    candle.update({
      time: updated.time,
      open: updated.open,
      high: updated.high,
      low: updated.low,
      close: updated.close,
    });
    setLegend((prev) =>
      prev
        ? { ...prev, h: updated.high, l: updated.low, c: updated.close }
        : prev,
    );
  }, [lastPrice]);

  return (
    <div className={`chart-host ${className ?? ""}`}>
      <div className="chart-legend-overlay">
        <ChartLegend data={legend} maExpanded={maExpanded} onToggleMa={() => setMaExpanded((e) => !e)} />
      </div>
      <div ref={hostRef} className="chart-canvas-wrap" />
    </div>
  );
}
