package jforex;

import com.dukascopy.api.*;
import com.dukascopy.api.drawings.*;

import java.awt.Color;
import java.awt.Font;
import java.io.*;
import java.nio.charset.StandardCharsets;
import java.nio.file.*;
import java.util.*;

/**
 * lastgtg live — read-only bridge between JForex and the lastgtg engine (indicators/lastgtg/live).
 *
 * 1. Price feed: on start writes the last closed BID bars of XAU/USD for M1, M5, M15, H1, H4, D, W
 *    (and the dollar index H1/H4 when the platform offers it) to C:/Users/alk/gtg-live/feed as
 *    CSV "t,o,h,l,c,v" (t = bar open, ms UTC), then appends every closed bar from onBar.
 *    Flat zero-volume bars (market breaks) are skipped, as TradingView shows none.
 * 2. Drawing: the Node runner writes C:/Users/alk/gtg-live/state/draw.txt; every few seconds this
 *    strategy redraws, on each open XAU/USD chart, the panel (traffic light + four zone rows +
 *    dollar row) and the four zones of the chart's own timeframe.
 * No order, no position, no account change.
 */
@RequiresFullAccess
public class GtgLive implements IStrategy {
    private static final String BASE = "C:/Users/alk/gtg-live";
    private static final String FEED = BASE + "/feed";
    private static final String DRAW = BASE + "/state/draw.txt";
    private static final String STATUS = BASE + "/state/java_status.txt";
    private static final Instrument GOLD = Instrument.XAUUSD;

    private IContext ctx;
    private IHistory history;
    private IConsole console;
    private Instrument dxy;
    private final Map<String, Period> periods = new LinkedHashMap<>();
    private final Map<Period, String> names = new HashMap<>();
    private final Map<String, Integer> counts = new HashMap<>();
    private final Map<String, Long> lastWritten = new HashMap<>();
    private long lastDrawMtime = -1;
    private long lastDrawCheck = 0;
    private final Map<IChart, List<String>> drawn = new HashMap<>();

    @Override
    public void onStart(IContext context) throws JFException {
        ctx = context;
        history = context.getHistory();
        console = context.getConsole();
        put("M1", Period.ONE_MIN, 3200);
        put("M5", Period.FIVE_MINS, 2800);
        put("M15", Period.FIFTEEN_MINS, 3400);
        put("H1", Period.ONE_HOUR, 4400);
        put("H4", Period.FOUR_HOURS, 6700);
        put("D", Period.DAILY, 2000);
        put("W", Period.WEEKLY, 400);

        Set<Instrument> subs = new HashSet<>();
        subs.add(GOLD);
        try { dxy = Instrument.fromString("DOLLAR.IDX/USD"); } catch (Throwable t) { dxy = null; }
        if (dxy != null) subs.add(dxy);
        context.setSubscribedInstruments(subs, true);

        new File(FEED).mkdirs();
        new File(BASE + "/state").mkdirs();
        for (Map.Entry<String, Period> e : periods.entrySet()) {
            writeHistory(GOLD, "XAUUSD", e.getKey(), e.getValue(), counts.get(e.getKey()));
        }
        if (dxy != null) {
            try {
                writeHistory(dxy, "DXY", "H1", Period.ONE_HOUR, 400);
                writeHistory(dxy, "DXY", "H4", Period.FOUR_HOURS, 400);
            } catch (Throwable t) {
                console.getErr().println("lastgtg: dollar index not available: " + t);
                dxy = null;
            }
        }
        status("started dxy=" + (dxy != null));
        console.getOut().println("lastgtg live started (read-only). Feed: " + FEED);
    }

    private void put(String name, Period p, int n) {
        periods.put(name, p);
        names.put(p, name);
        counts.put(name, n);
    }

    private void writeHistory(Instrument inst, String sym, String tf, Period period, int n) throws JFException {
        long lastTick = history.getLastTick(inst).getTime();
        long lastClosed = history.getPreviousBarStart(period, history.getBarStart(period, lastTick));
        List<IBar> bars = history.getBars(inst, period, OfferSide.BID, Filter.WEEKENDS, n, lastClosed, 0);
        File out = new File(FEED, sym + "_" + tf + ".csv");
        File tmp = new File(FEED, sym + "_" + tf + ".csv.tmp");
        long last = -1;
        try (Writer w = new OutputStreamWriter(new FileOutputStream(tmp), StandardCharsets.US_ASCII)) {
            w.write("t,o,h,l,c,v\n");
            for (IBar b : bars) {
                if (isFlat(b)) continue;
                w.write(line(b));
                last = b.getTime();
            }
        } catch (IOException e) {
            throw new JFException("lastgtg: cannot write " + tmp + ": " + e);
        }
        try {
            Files.move(tmp.toPath(), out.toPath(), StandardCopyOption.REPLACE_EXISTING);
        } catch (IOException e) {
            throw new JFException("lastgtg: cannot replace " + out + ": " + e);
        }
        lastWritten.put(sym + "_" + tf, last);
    }

    private static boolean isFlat(IBar b) {
        return b.getVolume() == 0 && b.getOpen() == b.getClose() && b.getHigh() == b.getLow() && b.getOpen() == b.getHigh();
    }

    private static String line(IBar b) {
        return b.getTime() + "," + b.getOpen() + "," + b.getHigh() + "," + b.getLow() + "," + b.getClose() + "," + b.getVolume() + "\n";
    }

    private void append(String key, IBar b) {
        Long last = lastWritten.get(key);
        if (last != null && b.getTime() <= last) return;
        if (isFlat(b)) return;
        try (Writer w = new OutputStreamWriter(new FileOutputStream(new File(FEED, key + ".csv"), true), StandardCharsets.US_ASCII)) {
            w.write(line(b));
            lastWritten.put(key, b.getTime());
        } catch (IOException e) {
            console.getErr().println("lastgtg: append failed " + key + ": " + e);
        }
    }

    @Override
    public void onBar(Instrument instrument, Period period, IBar askBar, IBar bidBar) throws JFException {
        String tf = names.get(period);
        if (tf == null) return;
        if (instrument == GOLD) {
            append("XAUUSD_" + tf, bidBar);
            if (period == Period.ONE_MIN) status("bar " + bidBar.getTime());
        } else if (dxy != null && instrument == dxy && (period == Period.ONE_HOUR || period == Period.FOUR_HOURS)) {
            append("DXY_" + tf, bidBar);
        }
    }

    @Override
    public void onTick(Instrument instrument, ITick tick) throws JFException {
        if (instrument != GOLD) return;
        long now = System.currentTimeMillis();
        if (now - lastDrawCheck < 3000) return;
        lastDrawCheck = now;
        File f = new File(DRAW);
        if (!f.exists()) return;
        long m = f.lastModified();
        if (m == lastDrawMtime) return;
        lastDrawMtime = m;
        try {
            redraw(Files.readAllLines(f.toPath(), StandardCharsets.UTF_8), tick.getTime());
        } catch (Throwable t) {
            console.getErr().println("lastgtg: draw failed: " + t);
        }
    }

    // draw.txt: one line per timeframe
    // tf|lamp|head|r1|r2|s1|s2|dxy|R1lo|R1hi|R2lo|R2hi|S1lo|S1hi|S2lo|S2hi
    private void redraw(List<String> lines, long now) {
        Map<String, String[]> byTf = new HashMap<>();
        for (String l : lines) {
            String[] p = l.split("\\|", -1);
            if (p.length >= 16) byTf.put(p[0], p);
        }
        Set<IChart> charts = ctx.getCharts(GOLD);
        if (charts == null) return;
        for (IChart chart : charts) {
            clear(chart);
            List<String> keys = new ArrayList<>();
            drawn.put(chart, keys);
            Period cp = chart.getSelectedPeriod();
            String tf = cp == null ? null : names.get(cp);
            String[] p = tf == null ? null : byTf.get(tf);
            IChartObjectFactory f = chart.getChartObjectFactory();
            if (p == null) {
                keys.add(screen(chart, f, "gtg_head", "lastgtg • هذا الإطار غير مدعوم (1 / 5 / 15 / 60 / 240 دقيقة)", Color.LIGHT_GRAY, 10));
                chart.repaint();
                continue;
            }
            int lamp = Integer.parseInt(p[1]);
            Color lampColor = lamp == 2 ? new Color(30, 170, 60) : lamp == 1 ? new Color(230, 190, 20) : new Color(210, 50, 50);
            keys.add(screen(chart, f, "gtg_head", p[2], lampColor, 10));
            keys.add(screen(chart, f, "gtg_r1", p[3], new Color(230, 70, 70), 32));
            keys.add(screen(chart, f, "gtg_r2", p[4], new Color(200, 110, 110), 52));
            keys.add(screen(chart, f, "gtg_s1", p[5], new Color(40, 190, 220), 72));
            keys.add(screen(chart, f, "gtg_s2", p[6], new Color(90, 160, 180), 92));
            keys.add(screen(chart, f, "gtg_dxy", p[7], Color.LIGHT_GRAY, 112));
            long barMs = cp.getInterval();
            long t1 = now - 60 * barMs, t2 = now + 6 * barMs;
            String[] zn = {"R1", "R2", "S1", "S2"};
            for (int k = 0; k < 4; k++) {
                double lo = num(p[8 + 2 * k]), hi = num(p[9 + 2 * k]);
                if (Double.isNaN(lo) || Double.isNaN(hi)) continue;
                boolean res = k < 2;
                Color c = res ? new Color(220, 60, 60) : new Color(40, 120, 230);
                IRectangleChartObject r = f.createRectangle("gtg_z" + zn[k], t1, hi, t2, lo);
                r.setColor(c);
                r.setFillColor(c);
                r.setFillOpacity(k % 2 == 0 ? 0.22f : 0.10f);
                r.setOpacity(0.8f);
                r.setMenuEnabled(false);
                r.setLocked(true);
                chart.add(r);
                keys.add("gtg_z" + zn[k]);
            }
            chart.repaint();
        }
    }

    private String screen(IChart chart, IChartObjectFactory f, String key, String text, Color color, int y) {
        IScreenLabelChartObject s = f.createScreenLabel(key);
        s.setCorner(IScreenLabelChartObject.Corner.TOP_RIGHT);
        s.setxDistance(12);
        s.setyDistance(y);
        s.setText(text, new Font("Tahoma", Font.BOLD, 13));
        s.setColor(color);
        s.setMenuEnabled(false);
        chart.add(s);
        return key;
    }

    private void clear(IChart chart) {
        List<String> keys = drawn.remove(chart);
        if (keys == null) return;
        for (String k : keys) {
            try { chart.remove(k); } catch (Throwable ignored) { }
        }
    }

    private static double num(String s) {
        try { return s == null || s.isEmpty() ? Double.NaN : Double.parseDouble(s); } catch (NumberFormatException e) { return Double.NaN; }
    }

    private void status(String s) {
        try {
            Files.write(Paths.get(STATUS), (System.currentTimeMillis() + " " + s + "\n").getBytes(StandardCharsets.UTF_8));
        } catch (IOException ignored) { }
    }

    @Override
    public void onMessage(IMessage message) throws JFException { }

    @Override
    public void onAccount(IAccount account) throws JFException { }

    @Override
    public void onStop() throws JFException {
        for (IChart chart : new ArrayList<>(drawn.keySet())) {
            clear(chart);
            try { chart.repaint(); } catch (Throwable ignored) { }
        }
        status("stopped");
    }
}
