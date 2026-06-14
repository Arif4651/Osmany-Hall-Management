using System.Diagnostics;
using System.Runtime.InteropServices;

namespace HallBackend;

public static class PortHelper
{
    public static void FreePortsFromEnvironment()
    {
        try
        {
            var urls = Environment.GetEnvironmentVariable("ASPNETCORE_URLS");
            if (string.IsNullOrEmpty(urls))
            {
                // Fall back to default development ports
                FreePort(5012);
                FreePort(7077);
                return;
            }

            var urlList = urls.Split(new[] { ';', ',' }, StringSplitOptions.RemoveEmptyEntries);
            foreach (var url in urlList)
            {
                var lastColon = url.LastIndexOf(':');
                if (lastColon >= 0)
                {
                    var portStr = url.Substring(lastColon + 1).TrimEnd('/', ' ');
                    if (int.TryParse(portStr, out int port))
                    {
                        FreePort(port);
                    }
                }
            }
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[PortHelper] Warning: Failed to parse ASPNETCORE_URLS: {ex.Message}");
        }
    }

    public static void FreePort(int port)
    {
        if (port <= 0) return;

        try
        {
            if (RuntimeInformation.IsOSPlatform(OSPlatform.Windows))
            {
                FreePortWindows(port);
            }
            else
            {
                FreePortUnix(port);
            }
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[PortHelper] Error freeing port {port}: {ex.Message}");
        }
    }

    private static void FreePortWindows(int port)
    {
        var startInfo = new ProcessStartInfo
        {
            FileName = "cmd.exe",
            Arguments = $"/c netstat -ano | findstr LISTENING | findstr :{port}",
            RedirectStandardOutput = true,
            UseShellExecute = false,
            CreateNoWindow = true
        };

        using var process = Process.Start(startInfo);
        if (process == null) return;

        string output = process.StandardOutput.ReadToEnd();
        process.WaitForExit();

        var lines = output.Split(new[] { "\r\n", "\n" }, StringSplitOptions.RemoveEmptyEntries);
        var currentPid = Process.GetCurrentProcess().Id;

        foreach (var line in lines)
        {
            var parts = line.Split(new[] { ' ' }, StringSplitOptions.RemoveEmptyEntries);
            if (parts.Length >= 5)
            {
                var pidStr = parts[parts.Length - 1];
                if (int.TryParse(pidStr, out int pid) && pid > 4 && pid != currentPid)
                {
                    try
                    {
                        using var procToKill = Process.GetProcessById(pid);
                        Console.WriteLine($"[PortHelper] Detected orphaned process {procToKill.ProcessName} (PID {pid}) on port {port}. Terminating...");
                        procToKill.Kill();
                        procToKill.WaitForExit(3000);
                        Console.WriteLine($"[PortHelper] Successfully terminated PID {pid}.");
                    }
                    catch (Exception ex)
                    {
                        Console.WriteLine($"[PortHelper] Failed to terminate PID {pid}: {ex.Message}");
                    }
                }
            }
        }
    }

    private static void FreePortUnix(int port)
    {
        var startInfo = new ProcessStartInfo
        {
            FileName = "sh",
            Arguments = $"-c \"lsof -t -i:{port}\"",
            RedirectStandardOutput = true,
            UseShellExecute = false,
            CreateNoWindow = true
        };

        using var process = Process.Start(startInfo);
        if (process == null) return;

        string output = process.StandardOutput.ReadToEnd();
        process.WaitForExit();

        var lines = output.Split(new[] { "\n" }, StringSplitOptions.RemoveEmptyEntries);
        var currentPid = Process.GetCurrentProcess().Id;

        foreach (var line in lines)
        {
            if (int.TryParse(line.Trim(), out int pid) && pid != currentPid)
            {
                try
                {
                    using var procToKill = Process.GetProcessById(pid);
                    Console.WriteLine($"[PortHelper] Detected orphaned process {procToKill.ProcessName} (PID {pid}) on port {port}. Terminating...");
                    procToKill.Kill();
                    procToKill.WaitForExit(3000);
                    Console.WriteLine($"[PortHelper] Successfully terminated PID {pid}.");
                }
                catch (Exception ex)
                {
                    Console.WriteLine($"[PortHelper] Failed to terminate PID {pid}: {ex.Message}");
                }
            }
        }
    }
}
