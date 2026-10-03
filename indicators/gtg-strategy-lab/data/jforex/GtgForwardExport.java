package jforex;

import com.dukascopy.api.*;

import java.io.*;
import java.nio.file.*;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.time.ZonedDateTime;
import java.util.*;

/**
 * Pristine Forward price exporter for GTG Strategy Lab.
 *
 * Canonical source: authenticated Dukascopy JForex IHistory.
 * Read-only. No orders. No trading outcomes. No GTG computation.
 *
 * Exports full settled UTC days from the v0.2.3 freeze day onward.
 * The freeze-day file intentionally contains the full day; later OOS decoding
 * must keep only timestamps strictly after T_freeze.
 */
@RequiresFullAccess
public class GtgForwardExport implements IStrategy {
    private static final String BASE =
        "C:/Users/alk/gtg-lab-work/captures/jforex_forward";
    private static final LocalDate FREEZE_DAY = LocalDate.parse("2026-09-30");
    private static final int SETTLE_LAG_HOURS = 3;
    private static final long CHECK_INTERVAL_MS = 60_000L;

    private IContext context;
    private IHistory history;
    private long nextCheckMs = 0L;

    @Override
    public void onStart(IContext context) throws JFException {
        this.context = context;
        this.history = context.getHistory();

        context.setSubscribedInstruments(
            Collections.singleton(Instrument.XAUUSD), true
        );

        try {
            exportPending(Instant.now());
        } catch (Exception e) {
            context.getConsole().getErr().println(
                "GTG forward export initial pass failed: " + e
            );
        }

        nextCheckMs = System.currentTimeMillis() + CHECK_INTERVAL_MS;
        context.getConsole().getOut().println(
            "GTG forward collector active; source=JForex API/IHistory"
        );
    }

    private int exportPending(Instant now) throws Exception {
        LocalDate lastSettled = lastSettledDay(now);
        File root = new File(BASE);
        root.mkdirs();

        File logFile = new File(root, "forward_export_log.csv");
        boolean newLog = !logFile.exists();
        int exported = 0;

        try (PrintWriter log = new PrintWriter(
                new FileWriter(logFile, true))) {
            if (newLog) {
                log.println(
                    "day,bid_rows,ask_rows,exported_at_utc,source,api"
                );
            }

            for (LocalDate day = FREEZE_DAY;
                 !day.isAfter(lastSettled);
                 day = day.plusDays(1)) {

                File dir = dayDir(root, day);
                File done = new File(dir, "FORWARD_COMPLETE.json");

                if (done.exists()) {
                    continue;
                }

                dir.mkdirs();
                long day0 = day.atStartOfDay(ZoneOffset.UTC)
                               .toInstant().toEpochMilli();
                long end = day0 + 86_400_000L - 60_000L;

                int bidRows = exportSide(
                    history, day0, end, dir, OfferSide.BID);
                int askRows = exportSide(
                    history, day0, end, dir, OfferSide.ASK);

                writeDoneMarker(done, day, bidRows, askRows);

                log.println(
                    day + "," + bidRows + "," + askRows + "," +
                    Instant.now() +
                    ",JForex API/IHistory,jforex-api 4.8.13"
                );
                log.flush();
                exported += 1;

                context.getConsole().getOut().println(
                    "GTG forward export " + day +
                    " BID=" + bidRows + " ASK=" + askRows
                );
            }
        }

        if (exported > 0) {
            context.getConsole().getOut().println(
                "GTG forward export caught up through " + lastSettled
            );
        }
        return exported;
    }

    private static LocalDate lastSettledDay(Instant now) {
        ZonedDateTime z = now.atZone(ZoneOffset.UTC);
        LocalDate today = z.toLocalDate();
        if (z.getHour() < SETTLE_LAG_HOURS) {
            return today.minusDays(2);
        }
        return today.minusDays(1);
    }

    private static File dayDir(File root, LocalDate day) {
        return new File(
            root,
            String.format(
                Locale.ROOT,
                "XAUUSD/%04d/%02d/%02d",
                day.getYear(),
                day.getMonthValue() - 1,
                day.getDayOfMonth()
            )
        );
    }

    private static int exportSide(
            IHistory history,
            long day0,
            long end,
            File dir,
            OfferSide side) throws Exception {

        List<IBar> bars = history.getBars(
            Instrument.XAUUSD,
            Period.ONE_MIN,
            side,
            Filter.NO_FILTER,
            day0,
            end
        );

        String name =
            (side == OfferSide.BID ? "BID" : "ASK") +
            "_candles_min_1.bi5";

        Path target = new File(dir, name).toPath();
        Path part = new File(dir, name + ".part").toPath();

        try (DataOutputStream out = new DataOutputStream(
                new BufferedOutputStream(
                    Files.newOutputStream(
                        part,
                        StandardOpenOption.CREATE,
                        StandardOpenOption.TRUNCATE_EXISTING)))) {

            for (IBar b : bars) {
                out.writeInt((int) ((b.getTime() - day0) / 1000L));
                out.writeInt((int) Math.round(b.getOpen() * 1000));
                out.writeInt((int) Math.round(b.getClose() * 1000));
                out.writeInt((int) Math.round(b.getLow() * 1000));
                out.writeInt((int) Math.round(b.getHigh() * 1000));
                out.writeFloat((float) b.getVolume());
            }
        }

        try {
            Files.move(
                part,
                target,
                StandardCopyOption.REPLACE_EXISTING,
                StandardCopyOption.ATOMIC_MOVE
            );
        } catch (AtomicMoveNotSupportedException e) {
            Files.move(
                part,
                target,
                StandardCopyOption.REPLACE_EXISTING
            );
        }

        return bars.size();
    }

    private static void writeDoneMarker(
            File done,
            LocalDate day,
            int bidRows,
            int askRows) throws IOException {

        File part = new File(done.getParentFile(), done.getName() + ".part");
        String json =
            "{\n" +
            "  \"day\": \"" + day + "\",\n" +
            "  \"bid_rows\": " + bidRows + ",\n" +
            "  \"ask_rows\": " + askRows + ",\n" +
            "  \"source\": \"JForex API/IHistory\",\n" +
            "  \"api\": \"jforex-api 4.8.13\",\n" +
            "  \"completed_utc\": \"" + Instant.now() + "\"\n" +
            "}\n";

        Files.write(
            part.toPath(),
            json.getBytes("UTF-8"),
            StandardOpenOption.CREATE,
            StandardOpenOption.TRUNCATE_EXISTING
        );

        try {
            Files.move(
                part.toPath(),
                done.toPath(),
                StandardCopyOption.REPLACE_EXISTING,
                StandardCopyOption.ATOMIC_MOVE
            );
        } catch (AtomicMoveNotSupportedException e) {
            Files.move(
                part.toPath(),
                done.toPath(),
                StandardCopyOption.REPLACE_EXISTING
            );
        }
    }

    @Override
    public void onTick(Instrument instrument, ITick tick) {
        if (instrument != Instrument.XAUUSD) {
            return;
        }

        long nowMs = System.currentTimeMillis();
        if (nowMs < nextCheckMs) {
            return;
        }
        nextCheckMs = nowMs + CHECK_INTERVAL_MS;

        try {
            exportPending(Instant.ofEpochMilli(nowMs));
        } catch (Exception e) {
            context.getConsole().getErr().println(
                "GTG forward export periodic pass failed: " + e
            );
        }
    }

    @Override public void onBar(
        Instrument instrument, Period period, IBar askBar, IBar bidBar) {}
    @Override public void onMessage(IMessage message) {}
    @Override public void onAccount(IAccount account) {}
    @Override public void onStop() {}
}
