package jforex;

import com.dukascopy.api.*;

import java.io.File;
import java.io.PrintWriter;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.Collections;
import java.util.List;

/**
 * JForex API feasibility export (GPT message 46): authenticated IHistory, XAU/USD, M1 BID and ASK
 * bars (Filter.NO_FILTER, i.e. every minute as served) and raw ticks, on a fixed day list. Writes
 * CSV files and per-request timings; changes nothing, trades nothing. Not a research source.
 */
@RequiresFullAccess
public class GtgHistoryExport implements IStrategy {
    // fixed before any result: the two F-012 mismatch days, the known disputed/recent days, two plain days
    private static final String[] DAYS = {"2013-02-14", "2015-06-30", "2025-12-10", "2026-03-04", "2026-07-07", "2026-07-14", "2026-09-22"};
    private static final String OUT = "C:/Users/alk/gtg-lab-work/captures/jforex_api";

    private IContext context;

    @Override
    public void onStart(IContext context) throws JFException {
        this.context = context;
        context.setSubscribedInstruments(Collections.singleton(Instrument.XAUUSD), true);
        IHistory h = context.getHistory();
        File dir = new File(OUT);
        dir.mkdirs();
        try (PrintWriter timing = new PrintWriter(new File(dir, "timings.csv"))) {
            timing.println("day,kind,ms,rows");
            for (String d : DAYS) {
                long from = LocalDate.parse(d).atStartOfDay(ZoneOffset.UTC).toInstant().toEpochMilli();
                long lastMinute = from + 86_400_000L - 60_000L;
                for (OfferSide side : new OfferSide[]{OfferSide.BID, OfferSide.ASK}) {
                    long t0 = System.currentTimeMillis();
                    List<IBar> bars = h.getBars(Instrument.XAUUSD, Period.ONE_MIN, side, Filter.NO_FILTER, from, lastMinute);
                    timing.println(d + ",bars_" + side + "," + (System.currentTimeMillis() - t0) + "," + bars.size());
                    try (PrintWriter w = new PrintWriter(new File(dir, d + "_" + side + "_m1.csv"))) {
                        w.println("t,o,h,l,c,v");
                        for (IBar b : bars) {
                            w.println(b.getTime() + "," + b.getOpen() + "," + b.getHigh() + "," + b.getLow() + "," + b.getClose() + "," + b.getVolume());
                        }
                    }
                }
                long t0 = System.currentTimeMillis();
                int n = 0;
                try (PrintWriter w = new PrintWriter(new File(dir, d + "_ticks.csv"))) {
                    w.println("t,ask,bid,askVol,bidVol");
                    for (int hr = 0; hr < 24; hr++) {
                        long a = from + hr * 3_600_000L;
                        for (ITick k : h.getTicks(Instrument.XAUUSD, a, a + 3_599_999L)) {
                            w.println(k.getTime() + "," + k.getAsk() + "," + k.getBid() + "," + k.getAskVolume() + "," + k.getBidVolume());
                            n++;
                        }
                    }
                }
                timing.println(d + ",ticks," + (System.currentTimeMillis() - t0) + "," + n);
                timing.flush();
                context.getConsole().getOut().println("GTG export " + d + " done");
            }
        } catch (Exception e) {
            context.getConsole().getErr().println("GTG export failed: " + e);
        }
        context.getConsole().getOut().println("GTG export finished");
        context.stop();
    }

    @Override public void onTick(Instrument instrument, ITick tick) {}
    @Override public void onBar(Instrument instrument, Period period, IBar askBar, IBar bidBar) {}
    @Override public void onMessage(IMessage message) {}
    @Override public void onAccount(IAccount account) {}
    @Override public void onStop() {}
}
