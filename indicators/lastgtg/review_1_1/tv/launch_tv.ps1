# Runbook E-23: start the Store build of TradingView Desktop with the CDP port (127.0.0.1:9222).
Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
[ComImport, Guid("2e941141-7f97-4756-ba1d-9decde894a3d"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
public interface IApplicationActivationManager {
  int ActivateApplication([MarshalAs(UnmanagedType.LPWStr)] string appUserModelId, [MarshalAs(UnmanagedType.LPWStr)] string arguments, int options, out uint processId);
  int ActivateForFile(IntPtr a, IntPtr b, IntPtr c, out uint d);
  int ActivateForProtocol(IntPtr a, IntPtr b, out uint c);
}
[ComImport, Guid("45BA127D-10A8-46EA-8AB7-56EA9078943C")]
public class ApplicationActivationManager { }
public static class TvLaunch {
  public static uint Start(string aumid, string args) {
    var m = (IApplicationActivationManager)new ApplicationActivationManager();
    uint pid; int hr = m.ActivateApplication(aumid, args, 0, out pid);
    if (hr != 0) throw new Exception("ActivateApplication hr=0x" + hr.ToString("X"));
    return pid;
  }
}
"@
if (Get-Process -Name TradingView -ErrorAction SilentlyContinue) { "TradingView already running: stop (graceful close needed first)"; exit 1 }
$pid2 = [TvLaunch]::Start('TradingView.Desktop_n534cwy3pjxzj!TradingView.Desktop', '--remote-debugging-port=9222')
"started pid $pid2"
Start-Sleep 20
Get-NetTCPConnection -LocalPort 9222 -State Listen -ErrorAction SilentlyContinue | Select-Object LocalAddress,LocalPort,OwningProcess | Format-Table -AutoSize | Out-String
