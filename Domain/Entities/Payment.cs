using HallBackend.Domain.Common;

namespace HallBackend.Domain.Entities;

public sealed class Payment : Entity
{
    public Guid StudentId { get; set; }
    public Student? Student { get; set; }
    public Guid BillId { get; set; }
    public Bill? Bill { get; set; }
    public string PaymentNo { get; set; } = string.Empty;
    public string Method { get; set; } = string.Empty;
    public decimal Amount { get; set; }
    public DateOnly SubmittedAt { get; set; }
    public string Status { get; set; } = "pending";
    public string Reference { get; set; } = string.Empty;
}
