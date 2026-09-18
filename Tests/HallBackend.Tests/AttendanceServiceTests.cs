using HallBackend.Application.Services;

namespace HallBackend.Tests;

public sealed class AttendanceServiceTests
{
    [Fact]
    public void CalculateDistanceMeters_ReturnsZeroForSamePoint()
    {
        var distance = AttendanceService.CalculateDistanceMeters(23.7808875, 90.2792371, 23.7808875, 90.2792371);

        Assert.InRange(distance, 0, 0.001);
    }

    [Fact]
    public void CalculateDistanceMeters_DetectsNearbyPointInsideTypicalHallRadius()
    {
        var distance = AttendanceService.CalculateDistanceMeters(23.7808875, 90.2792371, 23.7812475, 90.2792371);

        Assert.InRange(distance, 39, 41);
        Assert.True(distance < 100);
    }

    [Fact]
    public void CalculateDistanceMeters_DetectsFarPointOutsideTypicalHallRadius()
    {
        var distance = AttendanceService.CalculateDistanceMeters(23.7808875, 90.2792371, 23.7908875, 90.2792371);

        Assert.InRange(distance, 1100, 1120);
        Assert.True(distance > 100);
    }
}
