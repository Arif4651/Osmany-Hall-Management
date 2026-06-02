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
            student.Department,
            student.HallId,
            student.MobileNumber,
            student.Level,
            student.HallName,
            student.RoomNo,
            student.Status,
            student.HasDue,
            student.DueAmount,
            student.LoginAccessEnabled,
            student.ReactivationEligible,
            student.PermanentDeleteEligible);
    }

    public static BillDto ToDto(this Bill bill)
    {
        return new BillDto(bill.Id, bill.BillNo, bill.Period, bill.MealCost, bill.Utility, bill.Service, bill.Total, bill.Status, bill.DueDate);
    }

    public static PaymentDto ToDto(this Payment payment)
    {
        return new PaymentDto(payment.Id, payment.PaymentNo, payment.Student?.StudentName ?? string.Empty, payment.Bill?.BillNo ?? string.Empty, payment.Amount, payment.Method, payment.SubmittedAt, payment.Status, payment.Reference);
    }
}
