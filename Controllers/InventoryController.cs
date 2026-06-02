using HallBackend.Application.Dtos;
using HallBackend.Domain.Constants;
using HallBackend.Infrastructure.Data;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace HallBackend.Controllers;

[ApiController]
[Authorize(Roles = Roles.Admin)]
[Route("api/inventory")]
public sealed class InventoryController(HallDbContext db) : ControllerBase
{
    [HttpGet]
    public async Task<IReadOnlyList<InventoryItemDto>> Get(CancellationToken cancellationToken)
    {
        return await db.InventoryItems.AsNoTracking().OrderBy(x => x.Item).Select(x => new InventoryItemDto(x.Id, x.Item, x.Category, x.Stock, x.Threshold, x.Status)).ToListAsync(cancellationToken);
    }
}
