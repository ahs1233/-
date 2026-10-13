package jforex;

import com.dukascopy.api.*;
import com.dukascopy.api.indicators.*;

import java.awt.*;
import java.io.File;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.util.*;
import java.util.List;

/**
 * lastgtg chart view for JForex 4 (read-only, no orders).
 *
 * JForex 4 gives strategies no chart handle, so gtglast.java cannot draw. This indicator, added to an
 * XAU/USD chart, reads C:/Users/alk/gtg-live/state/draw.txt (written by the Node runner) and draws, for
 * the chart's timeframe (1 / 5 / 15 / 60 / 240 minutes):
 *  - the four zones R1, R2, S1, S2 over the last bars (edge lines + filled boxes),
 *  - the COMPACT panel in the top-right corner: traffic light line, four zone rows, dollar row.
 * It computes nothing itself; the panel is the runner's closed-bar result.
 */
@RequiresFullAccess
public class gtglastview implements IIndicator, IDrawingIndicator {
    private static final String DRAW = "C:/Users/alk/gtg-live/state/draw.txt";
    private static final int PANEL = 8;
    private static final String[] EDGE = {"R1 low", "R1 high", "R2 low", "R2 high", "S1 low", "S1 high", "S2 low", "S2 high"};
    private static final Color RES = new Color(220, 60, 60), SUP = new Color(40, 120, 230);

    private IndicatorInfo info;
    private InputParameterInfo[] inputInfos;
    private OptInputParameterInfo[] optInfos;
    private OutputParameterInfo[] outputInfos;
    private IIndicatorContext ctx;
    private final IBar[][] inputs = new IBar[1][];
    private final double[][] outputs = new double[9][];
    private int show = 60;

    private final Map<String, String[]> byTf = new HashMap<>();
    private long fileMtime = -1, fileChecked = 0;

    @Override
    public void onStart(IIndicatorContext context) {
        ctx = context;
        info = new IndicatorInfo("GTGLAST", "gtglast", "Custom", true, false, true, 1, 1, 9);
        info.setRecalculateAll(true);
        inputInfos = new InputParameterInfo[] {new InputParameterInfo("Price", InputParameterInfo.Type.BAR)};
        optInfos = new OptInputParameterInfo[] {
            new OptInputParameterInfo("Bars to show", OptInputParameterInfo.Type.OTHER, new IntegerRangeDescription(60, 5, 500, 1))};
        outputInfos = new OutputParameterInfo[9];
        for (int k = 0; k < 8; k++) {
            OutputParameterInfo o = new OutputParameterInfo(EDGE[k], OutputParameterInfo.Type.DOUBLE, OutputParameterInfo.DrawingStyle.DASH_LINE);
            o.setColor(k < 4 ? RES : SUP);
            o.setGapAtNaN(true);
            o.setShowValueOnChart(false);
            outputInfos[k] = o;
        }
        OutputParameterInfo panel = new OutputParameterInfo("Panel", OutputParameterInfo.Type.DOUBLE, OutputParameterInfo.DrawingStyle.LINE);
        panel.setDrawnByIndicator(true);
        panel.setShowValueOnChart(false);
        panel.setShowPopupInfo(false);
        outputInfos[PANEL] = panel;
    }

    @Override
    public IndicatorResult calculate(int startIndex, int endIndex) {
        if (startIndex > endIndex) return new IndicatorResult(0, 0);
        IBar[] b = inputs[0];
        long periodMs = periodMs(b);
        String[] p = lineFor(periodMs);
        long cutoff = b[b.length - 1].getTime() - (long) show * periodMs;
        int n = endIndex - startIndex + 1;
        for (int i = 0; i < n; i++) {
            IBar bar = b[startIndex + i];
            boolean on = p != null && bar.getTime() >= cutoff;
            for (int k = 0; k < 8; k++) outputs[k][i] = on ? num(p[8 + k]) : Double.NaN;
            outputs[PANEL][i] = bar.getClose();
        }
        return new IndicatorResult(startIndex, n);
    }

    @Override
    public Point drawOutput(Graphics g, int outputIdx, Object values, Color color, Stroke stroke,
                            IIndicatorDrawingSupport s, List<Shape> shapes, Map<Color, List<Point>> handles) {
        if (outputIdx != PANEL) return null;
        Graphics2D g2 = (Graphics2D) g.create();
        try {
            g2.setRenderingHint(RenderingHints.KEY_ANTIALIASING, RenderingHints.VALUE_ANTIALIAS_ON);
            g2.setRenderingHint(RenderingHints.KEY_TEXT_ANTIALIASING, RenderingHints.VALUE_TEXT_ANTIALIAS_ON);
            Period period = s.getPeriod();
            long periodMs = period == null ? -1 : period.getInterval();
            String[] p = lineFor(periodMs);
            int w = s.getChartWidth();

            if (p != null) {
                IBar[] c = s.getCandles();
                long last = c != null && c.length > 0 ? c[c.length - 1].getTime() : System.currentTimeMillis();
                int x1 = Math.max(0, s.getXForTime(last - (long) show * periodMs));
                for (int k = 0; k < 4; k++) {
                    double lo = num(p[8 + 2 * k]), hi = num(p[9 + 2 * k]);
                    if (Double.isNaN(lo) || Double.isNaN(hi)) continue;
                    int y1 = Math.round(s.getYForValue(hi)), y2 = Math.round(s.getYForValue(lo));
                    Color base = k < 2 ? RES : SUP;
                    g2.setColor(new Color(base.getRed(), base.getGreen(), base.getBlue(), k % 2 == 0 ? 60 : 30));
                    g2.fillRect(x1, Math.min(y1, y2), Math.max(1, w - x1), Math.max(2, Math.abs(y2 - y1)));
                }
            }

            String[] lines;
            Color[] colors;
            if (p == null) {
                lines = new String[] {"lastgtg • هذا الإطار غير مدعوم (1 / 5 / 15 / 60 / 240 دقيقة)"};
                colors = new Color[] {Color.LIGHT_GRAY};
            } else {
                int lamp = (int) num(p[1]);
                Color lampColor = lamp == 2 ? new Color(30, 170, 60) : lamp == 1 ? new Color(230, 190, 20) : new Color(210, 50, 50);
                lines = new String[] {p[2], p[3], p[4], p[5], p[6], p[7]};
                colors = new Color[] {lampColor, new Color(235, 90, 90), new Color(210, 130, 130),
                    new Color(60, 200, 230), new Color(110, 170, 190), Color.LIGHT_GRAY};
            }
            Font head = new Font("Tahoma", Font.BOLD, 15), body = new Font("Tahoma", Font.BOLD, 13);
            int boxW = 0;
            for (int i = 0; i < lines.length; i++) {
                boxW = Math.max(boxW, g2.getFontMetrics(i == 0 ? head : body).stringWidth(lines[i]));
            }
            boxW += 20;
            int rowH = 20, boxH = lines.length * rowH + 12;
            int bx = Math.max(0, w - boxW - 10), by = 10;
            g2.setColor(new Color(15, 15, 20, 200));
            g2.fillRoundRect(bx, by, boxW, boxH, 10, 10);
            for (int i = 0; i < lines.length; i++) {
                Font f = i == 0 ? head : body;
                g2.setFont(f);
                g2.setColor(colors[i]);
                int tw = g2.getFontMetrics(f).stringWidth(lines[i]);
                g2.drawString(lines[i], bx + boxW - 10 - tw, by + 6 + (i + 1) * rowH - 5);
            }
        } catch (Throwable ignored) {
        } finally {
            g2.dispose();
        }
        return null;
    }

    // Chart timeframe in ms: the context first, else the spacing of the last bars.
    private long periodMs(IBar[] b) {
        try {
            Period p = ctx.getPeriod();
            if (p != null && p.getInterval() > 0) return p.getInterval();
        } catch (Throwable ignored) { }
        long best = Long.MAX_VALUE;
        for (int i = Math.max(1, b.length - 30); i < b.length; i++) {
            long d = b[i].getTime() - b[i - 1].getTime();
            if (d > 0 && d < best) best = d;
        }
        return best == Long.MAX_VALUE ? -1 : best;
    }

    // draw.txt: tf|lamp|head|r1|r2|s1|s2|dxy|R1lo|R1hi|R2lo|R2hi|S1lo|S1hi|S2lo|S2hi
    private synchronized String[] lineFor(long periodMs) {
        long now = System.currentTimeMillis();
        if (now - fileChecked > 1000) {
            fileChecked = now;
            File f = new File(DRAW);
            long m = f.lastModified();
            if (m != fileMtime) {
                try {
                    Map<String, String[]> next = new HashMap<>();
                    for (String l : Files.readAllLines(f.toPath(), StandardCharsets.UTF_8)) {
                        String[] p = l.split("\\|", -1);
                        if (p.length >= 16) next.put(p[0], p);
                    }
                    byTf.clear();
                    byTf.putAll(next);
                    fileMtime = m;
                } catch (Throwable ignored) { }
            }
        }
        String tf = periodMs == 60_000L ? "M1" : periodMs == 300_000L ? "M5" : periodMs == 900_000L ? "M15"
            : periodMs == 3_600_000L ? "H1" : periodMs == 14_400_000L ? "H4" : null;
        return tf == null ? null : byTf.get(tf);
    }

    private static double num(String s) {
        try { return s == null || s.isEmpty() ? Double.NaN : Double.parseDouble(s); } catch (NumberFormatException e) { return Double.NaN; }
    }

    @Override public IndicatorInfo getIndicatorInfo() { return info; }
    @Override public InputParameterInfo getInputParameterInfo(int index) { return inputInfos[index]; }
    @Override public OptInputParameterInfo getOptInputParameterInfo(int index) { return optInfos[index]; }
    @Override public OutputParameterInfo getOutputParameterInfo(int index) { return outputInfos[index]; }
    @Override public void setInputParameter(int index, Object array) { inputs[index] = (IBar[]) array; }
    @Override public void setOptInputParameter(int index, Object value) { show = (Integer) value; }
    @Override public void setOutputParameter(int index, Object array) { outputs[index] = (double[]) array; }
    @Override public int getLookback() { return 0; }
    @Override public int getLookforward() { return 0; }
}
