package jforex;

import com.dukascopy.api.*;

import java.io.*;
import java.nio.file.Files;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.Collections;
import java.util.zip.GZIPOutputStream;

/**
 * Tick Audit export (TRADE_CONTRACT §2.3, v0.2.3; GPT message 57): IHistory raw ticks of XAU/USD
 * for the pre-registered audit days listed in tick_audit/days.txt (one ISO day per line), one
 * gzip CSV per day: t, ask, bid, askVol, bidVol. Reads only; no order, no account change.
 */
@RequiresFullAccess
public class GtgTickExport implements IStrategy {
    private static final String DIR = "C:/Users/alk/gtg-lab-work/captures/tick_audit";

    @Override
    public void onStart(IContext context) throws JFException {
        context.setSubscribedInstruments(Collections.singleton(Instrument.XAUUSD), true);
        IHistory h = context.getHistory();
        try (PrintWriter log = new PrintWriter(new FileWriter(new File(DIR, "tick_export_log.csv"), true))) {
            log.println("day,ticks,ms,exported_at_utc");
            for (String line : Files.readAllLines(new File(DIR, "days.txt").toPath())) {
                String d = line.trim();
                if (d.isEmpty()) continue;
                long day0 = LocalDate.parse(d).atStartOfDay(ZoneOffset.UTC).toInstant().toEpochMilli();
                long t0 = System.currentTimeMillis();
                int n = 0;
                try (PrintWriter w = new PrintWriter(new OutputStreamWriter(new GZIPOutputStream(new FileOutputStream(new File(DIR, d + "_ticks.csv.gz"))), "UTF-8"))) {
                    w.println("t,ask,bid,askVol,bidVol");
                    for (int hr = 0; hr < 24; hr++) {
                        long a = day0 + hr * 3_600_000L;
                        for (ITick k : h.getTicks(Instrument.XAUUSD, a, a + 3_599_999L)) {
                            w.println(k.getTime() + "," + k.getAsk() + "," + k.getBid() + "," + k.getAskVolume() + "," + k.getBidVolume());
                            n++;
                        }
                    }
                }
                log.println(d + "," + n + "," + (System.currentTimeMillis() - t0) + "," + Instant.now());
                log.flush();
                context.getConsole().getOut().println("GTG ticks " + d + " " + n);
            }
            context.getConsole().getOut().println("GTG tick export finished");
        } catch (Exception e) {
            context.getConsole().getErr().println("GTG tick export failed: " + e);
        }
        context.stop();
    }

    @Override public void onTick(Instrument instrument, ITick tick) {}
    @Override public void onBar(Instrument instrument, Period period, IBar askBar, IBar bidBar) {}
    @Override public void onMessage(IMessage message) {}
    @Override public void onAccount(IAccount account) {}
    @Override public void onStop() {}
}
