using HallBackend.Application.Dtos;
using HallBackend.Domain.Entities;

namespace HallBackend.Application.Mapping;

public static class ApiMapping
{
    public static StudentDto ToDto(this Student student)
    {
        return new StudentDto(
            student.Id,
            student.StudentName,
            student.StudentId,
            student.RollNumber,
            student.Gender,
            student.Department,
            student.HallId,
            student.MobileNumber,
            student.Level,
            student.HallName,
            student.RoomNo,
            student.Status,
            student.LoginAccessEnabled,
            student.ReactivationEligible,
            student.PermanentDeleteEligible,
            student.JoinDate);
    }
}
