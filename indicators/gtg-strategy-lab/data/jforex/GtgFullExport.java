package jforex;

import com.dukascopy.api.*;

import java.io.*;
import java.nio.file.Files;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.Collections;
import java.util.List;
import java.util.Locale;

/**
 * Canonical price export, TRADE_CONTRACT v0.2.3 §2.2: IHistory M1 BID and ASK bars
 * (Filter.NO_FILTER) of XAU/USD, one file per UTC day and side, written in the datafeed
 * record layout (big-endian: sec-in-day, open, close, low, high as points ×1000, volume
 * float32) and path layout (XAUUSD/yyyy/mm0/dd/{BID,ASK}_candles_min_1.bi5, uncompressed),
 * so the lab's tested builder reads them unchanged. Bars of the freeze day stop before the
 * minute that contains T_freeze. Reads only; no order, no account change.
 * Optional range.txt next to the output root: "from to outRoot" (re-export for finalization).
 */
@RequiresFullAccess
public class GtgFullExport implements IStrategy {
    private static final String BASE = "C:/Users/alk/gtg-lab-work/captures/jforex_export";
    private static final long FREEZE_MS = Instant.parse("2026-09-30T13:40:49Z").toEpochMilli();

    @Override
    public void onStart(IContext context) throws JFException {
        context.setSubscribedInstruments(Collections.singleton(Instrument.XAUUSD), true);
        IHistory h = context.getHistory();
        String from = "2018-03-01", to = "2026-09-30", out = BASE + "/canonical";
        try {
            File rf = new File(BASE, "range.txt");
            if (rf.exists()) {
                String[] p = new String(Files.readAllBytes(rf.toPath())).trim().split("\\s+");
                from = p[0]; to = p[1]; out = p[2];
            }
            File root = new File(out);
            root.mkdirs();
            long lastBar = FREEZE_MS / 60_000L * 60_000L - 60_000L;
            try (PrintWriter log = new PrintWriter(new FileWriter(new File(root, "export_log.csv"), true))) {
                log.println("day,side,rows,ms,exported_at_utc,from,to");
                for (LocalDate d = LocalDate.parse(from); !d.isAfter(LocalDate.parse(to)); d = d.plusDays(1)) {
                    long day0 = d.atStartOfDay(ZoneOffset.UTC).toInstant().toEpochMilli();
                    long end = Math.min(day0 + 86_400_000L - 60_000L, lastBar);
                    if (end < day0) break;
                    File dir = new File(root, String.format(Locale.ROOT, "XAUUSD/%04d/%02d/%02d", d.getYear(), d.getMonthValue() - 1, d.getDayOfMonth()));
                    dir.mkdirs();
                    for (OfferSide side : new OfferSide[]{OfferSide.BID, OfferSide.ASK}) {
                        long t0 = System.currentTimeMillis();
                        List<IBar> bars = h.getBars(Instrument.XAUUSD, Period.ONE_MIN, side, Filter.NO_FILTER, day0, end);
                        File f = new File(dir, (side == OfferSide.BID ? "BID" : "ASK") + "_candles_min_1.bi5");
                        try (DataOutputStream o = new DataOutputStream(new BufferedOutputStream(new FileOutputStream(f)))) {
                            for (IBar b : bars) {
                                o.writeInt((int) ((b.getTime() - day0) / 1000L));
                                o.writeInt((int) Math.round(b.getOpen() * 1000));
                                o.writeInt((int) Math.round(b.getClose() * 1000));
                                o.writeInt((int) Math.round(b.getLow() * 1000));
                                o.writeInt((int) Math.round(b.getHigh() * 1000));
                                o.writeFloat((float) b.getVolume());
                            }
                        }
                        log.println(d + "," + side + "," + bars.size() + "," + (System.currentTimeMillis() - t0) + "," + Instant.now() + "," + from + "," + to);
                    }
                    if (d.getDayOfMonth() == 1) {
                        log.flush();
                        context.getConsole().getOut().println("GTG export " + d);
                    }
                }
            }
            context.getConsole().getOut().println("GTG export finished " + from + " -> " + to);
        } catch (Exception e) {
            context.getConsole().getErr().println("GTG export failed: " + e);
        }
        context.stop();
    }

    @Override public void onTick(Instrument instrument, ITick tick) {}
    @Override public void onBar(Instrument instrument, Period period, IBar askBar, IBar bidBar) {}
    @Override public void onMessage(IMessage message) {}
    @Override public void onAccount(IAccount account) {}
    @Override public void onStop() {}
}
