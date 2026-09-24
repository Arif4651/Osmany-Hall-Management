using System.Text.RegularExpressions;

namespace HallBackend.Tests;

public sealed class AuditLoggingUsageTests
{
    [Fact]
    public void ControllersDoNotFireAndForgetAuditLogWrites()
    {
        var controllersDir = FindBackendDirectory("Controllers");
        var offenders = Directory.EnumerateFiles(controllersDir, "*.cs", SearchOption.AllDirectories)
            .SelectMany(file => File.ReadLines(file)
                .Select((line, index) => new { File = file, LineNumber = index + 1, Line = line }))
            .Where(x => Regex.IsMatch(x.Line, @"_\s*=\s*audit\.LogAsync\s*\("))
            .Select(x => $"{Path.GetRelativePath(controllersDir, x.File)}:{x.LineNumber}: {x.Line.Trim()}")
            .ToList();

        Assert.True(offenders.Count == 0,
            "Audit logging uses scoped HallDbContext and must be awaited inside the request scope. Offenders: "
            + string.Join(Environment.NewLine, offenders));
    }

    private static string FindBackendDirectory(string childDirectory)
    {
        for (var dir = new DirectoryInfo(AppContext.BaseDirectory); dir is not null; dir = dir.Parent)
        {
            var candidate = Path.Combine(dir.FullName, childDirectory);
            if (Directory.Exists(candidate) && File.Exists(Path.Combine(dir.FullName, "HallBackend.csproj")))
            {
                return candidate;
            }
        }

        throw new DirectoryNotFoundException($"Could not find Hall_Backend/{childDirectory} from {AppContext.BaseDirectory}.");
    }
}